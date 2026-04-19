import * as Crypto from "expo-crypto";
import { db } from "../db/client";
import { createCard, getCardsByLemma } from "../db/queries";
import { nowUnix } from "../db/types";
import {
  addWord,
  type AICardResponse,
  type AddWordResult,
  nextSenseId,
} from "./ai";

// ── Mock AI (remove when backend is live) ───────────────────────────────────

export const USE_MOCK_AI = true;

function mockAIResponse(word: string, sentence?: string): AICardResponse {
  const w = word.toLowerCase();
  return {
    lemma: w,
    encountered_form: word,
    part_of_speech: "verb",
    pronunciation_ipa: `/${w}/`,
    grammar: { verb_auxiliary: "avoir", is_pronominal: false },
    primary_definition_target: `Faire l'action de « ${w} ». Utilisé dans divers contextes.`,
    primary_definition_native: `To ${w}. Used in various contexts.`,
    example_sentence: sentence || `Je ${w} tous les jours.`,
    corrected_sentence: sentence || null,
    total_common_meanings: 2,
    is_new_sense: null,
    other_meanings: [
      {
        definition_target: `Autre sens de « ${w} »`,
        definition_native: `Another meaning of "${w}"`,
        example_sentence: `Il faut ${w} avec soin.`,
      },
    ],
    synonyms: [
      { word: "essayer", register: "courant" },
      { word: "tenter", register: "soutenu" },
    ],
    antonym: { word: "arrêter" },
    irregular_forms: null,
  };
}

export async function mockAddWord(params: {
  word: string;
  sentence?: string;
}): Promise<AddWordResult> {
  await new Promise((resolve) => setTimeout(resolve, 3000));
  const response = mockAIResponse(params.word, params.sentence);
  const lemma = response.lemma;
  const existingCards = getCardsByLemma(db, lemma).filter(
    (c) => c.status === "complete",
  );

  if (existingCards.length === 0) {
    return { status: "created", response };
  }

  return {
    status: "new_sense",
    response: { ...response, is_new_sense: true },
    existingSenseIds: existingCards.map((c) => c.id),
  };
}

// ── Save card ───────────────────────────────────────────────────────────────

export function saveCardFromAI(
  response: AICardResponse,
  userSentence: string | undefined,
  targetLanguage: string,
) {
  const senseId = nextSenseId(db, response.lemma);
  createCard(db, {
    id: Crypto.randomUUID(),
    status: "complete",
    targetLanguage,
    lemma: response.lemma,
    senseId,
    encounteredForm: response.encountered_form,
    partOfSpeech: response.part_of_speech,
    pronunciationIpa: response.pronunciation_ipa,
    grammarJson: JSON.stringify(response.grammar),
    primaryDefinitionTarget: response.primary_definition_target,
    primaryDefinitionNative: response.primary_definition_native,
    userSentencesJson: userSentence ? JSON.stringify([userSentence]) : "[]",
    exampleSentence: response.example_sentence,
    totalCommonMeanings: response.total_common_meanings,
    otherMeaningsJson: JSON.stringify(response.other_meanings),
    synonymsJson: JSON.stringify(response.synonyms),
    antonym: response.antonym?.word ?? null,
    irregularForms: response.irregular_forms,
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
}

// ── Submit flow ─────────────────────────────────────────────────────────────

export async function submitWord(params: {
  word: string;
  sentence?: string;
  targetLanguage: string;
  nativeLanguage: string;
}): Promise<AddWordResult> {
  if (USE_MOCK_AI) {
    return mockAddWord({
      word: params.word,
      sentence: params.sentence,
    });
  }
  return addWord(db, {
    word: params.word,
    sentence: params.sentence,
    targetLanguage: params.targetLanguage,
    nativeLanguage: params.nativeLanguage,
  });
}
