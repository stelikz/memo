import * as Crypto from "expo-crypto";
import { getDeviceId } from "./device-id";
import { getCardsByLemma, createCard } from "../db/queries";
import { type DrizzleDB, nowUnix } from "../db/types";

// TODO: move to env config
const EDGE_FUNCTION_URL = "https://<project-ref>.supabase.co/functions/v1/ai-proxy";
const APP_SECRET_TOKEN = ""; // set via app config / env

// ── Types ────────────────────────────────────────────────────────────────────

export interface AICardResponse {
  lemma: string;
  encountered_form: string;
  part_of_speech: string;
  pronunciation_ipa: string;
  grammar: Record<string, any>;
  primary_definition_target: string;
  primary_definition_native: string;
  example_sentence: string;
  total_common_meanings: number;
  is_new_sense: boolean | null;
  other_meanings: Array<{
    definition_target: string;
    definition_native: string;
    example_sentence: string;
  }>;
  synonyms: Array<{
    word: string;
    register: string;
  }>;
  antonym: { word: string } | null;
  irregular_forms: string | null;
}

export interface GenerateCardParams {
  word: string;
  sentence?: string;
  targetLanguage: string;
  nativeLanguage?: string;
  existingMeanings?: Array<{
    definition_target: string;
    definition_native: string;
  }>;
}

export type AddWordResult =
  | { status: "created"; response: AICardResponse }
  | { status: "duplicate"; existingCardId: string }
  | { status: "new_sense"; response: AICardResponse; existingSenseIds: string[] }
  | { status: "pending"; cardId: string };

// ── Errors ───────────────────────────────────────────────────────────────────

export class OfflineError extends Error {
  constructor() {
    super("No internet connection");
    this.name = "OfflineError";
  }
}

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

// ── API call ─────────────────────────────────────────────────────────────────

export async function generateCard(
  db: DrizzleDB,
  params: GenerateCardParams,
): Promise<AICardResponse> {
  const deviceId = getDeviceId(db);

  let response: Response;
  try {
    response = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-token": APP_SECRET_TOKEN,
        "x-device-id": deviceId,
      },
      body: JSON.stringify({
        word: params.word,
        sentence: params.sentence,
        target_language: params.targetLanguage,
        native_language: params.nativeLanguage ?? "en",
        existing_meanings: params.existingMeanings,
      }),
    });
  } catch (error: unknown) {
    throw new OfflineError();
  }

  if (response.status === 429) {
    const data = await response.json();
    throw new RateLimitError(data.error ?? "Daily limit reached.");
  }

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? `AI request failed (${response.status})`);
  }

  return response.json();
}

// ── Polysemy detection ───────────────────────────────────────────────────────

type ExistingMeaning = { definition_target: string; definition_native: string };

function extractMeanings(
  cards: ReturnType<typeof getCardsByLemma>,
): ExistingMeaning[] {
  return cards
    .filter((c) => c.status === "complete")
    .map((c) => ({
      definition_target: c.primaryDefinitionTarget,
      definition_native: c.primaryDefinitionNative,
    }));
}

export function getExistingMeanings(
  db: DrizzleDB,
  lemma: string,
): ExistingMeaning[] {
  return extractMeanings(getCardsByLemma(db, lemma));
}

export function nextSenseId(db: DrizzleDB, lemma: string): string {
  const existing = getCardsByLemma(db, lemma);
  return `${lemma}_${existing.length + 1}`;
}

// ── Pending card (offline queue) ─────────────────────────────────────────────

export function savePendingCard(
  db: DrizzleDB,
  params: { word: string; sentence?: string; targetLanguage: string },
): string {
  const id = Crypto.randomUUID();
  createCard(db, {
    id,
    status: "pending",
    targetLanguage: params.targetLanguage,
    lemma: params.word.toLowerCase(),
    senseId: `pending_${id}`,
    encounteredForm: params.word,
    partOfSpeech: "",
    pronunciationIpa: "",
    grammarJson: "{}",
    primaryDefinitionTarget: "",
    primaryDefinitionNative: "",
    userSentencesJson: params.sentence ? JSON.stringify([params.sentence]) : "[]",
    exampleSentence: "",
    totalCommonMeanings: 0,
    otherMeaningsJson: "[]",
    synonymsJson: "[]",
    antonym: null,
    irregularForms: null,
    due: nowUnix(),
    stability: 0,
    difficulty: 0,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    state: 0,
    lastReview: null,
    learningSteps: 0,
  });

  return id;
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

async function generateCardOrSavePending(
  db: DrizzleDB,
  params: GenerateCardParams,
): Promise<AICardResponse | { pendingCardId: string }> {
  try {
    return await generateCard(db, params);
  } catch (error) {
    if (error instanceof OfflineError) {
      return { pendingCardId: savePendingCard(db, params) };
    }
    throw error;
  }
}

export async function addWord(
  db: DrizzleDB,
  params: {
    word: string;
    sentence?: string;
    targetLanguage: string;
    nativeLanguage?: string;
  },
): Promise<AddWordResult> {
  const guessedLemma = params.word.toLowerCase();
  const guessedMeanings = getExistingMeanings(db, guessedLemma);

  const firstResult = await generateCardOrSavePending(
    db,
    { ...params, existingMeanings: guessedMeanings.length > 0 ? guessedMeanings : undefined },
  );
  if ("pendingCardId" in firstResult) {
    return { status: "pending", cardId: firstResult.pendingCardId };
  }
  let aiResponse = firstResult;

  const realLemma = aiResponse.lemma;
  const existingCards = getCardsByLemma(db, realLemma).filter(
    (c) => c.status === "complete",
  );

  // The guessed lemma (lowercased input) may differ from the real lemma
  // (e.g. "vais" → "aller"). If so, re-fetch with the real lemma's meanings.
  if (existingCards.length > 0 && guessedMeanings.length === 0) {
    const realMeanings = extractMeanings(existingCards);

    const retryResult = await generateCardOrSavePending(
      db,
      { ...params, existingMeanings: realMeanings },
    );
    if ("pendingCardId" in retryResult) {
      return { status: "pending", cardId: retryResult.pendingCardId };
    }
    aiResponse = retryResult;
  }

  if (existingCards.length === 0) {
    return { status: "created", response: aiResponse };
  }

  if (aiResponse.is_new_sense === false) {
    return { status: "duplicate", existingCardId: existingCards[0].id };
  }

  // is_new_sense is true or null (AI couldn't determine) — surface as
  // new_sense so the UI can let the user disambiguate.
  return {
    status: "new_sense",
    response: aiResponse,
    existingSenseIds: existingCards.map((c) => c.id),
  };
}
