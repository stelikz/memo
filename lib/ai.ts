import { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { getDeviceId } from "./device-id";

type DrizzleDB = BaseSQLiteDatabase<"sync", any, any>;

// TODO: move to env config
const EDGE_FUNCTION_URL = "https://<project-ref>.supabase.co/functions/v1/ai-proxy";
const APP_SECRET_TOKEN = ""; // set via app config / env

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

export async function generateCard(
  db: DrizzleDB,
  params: GenerateCardParams,
): Promise<AICardResponse> {
  const deviceId = getDeviceId(db);

  const response = await fetch(EDGE_FUNCTION_URL, {
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

  if (response.status === 429) {
    const data = await response.json();
    throw new Error(data.error ?? "Daily limit reached.");
  }

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? `AI request failed (${response.status})`);
  }

  return response.json();
}
