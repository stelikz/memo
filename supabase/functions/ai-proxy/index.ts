import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// --- Language-specific grammar configs ---

interface GrammarConfig {
  fields: string[];
  promptDescription: string;
}

const GRAMMAR_CONFIGS: Record<string, GrammarConfig> = {
  fr: {
    fields: ["gender", "verb_auxiliary", "is_pronominal"],
    promptDescription: `- "gender": "masculine" | "feminine" | null (null for non-gendered parts of speech)
- "verb_auxiliary": "être" | "avoir" | null (null for non-verbs)
- "is_pronominal": boolean (true if the verb is pronominal, e.g. se laver; null for non-verbs)`,
  },
  de: {
    fields: ["gender", "case_government", "plural_form"],
    promptDescription: `- "gender": "masculine" | "feminine" | "neuter" | null (null for non-gendered parts of speech)
- "case_government": "nominative" | "accusative" | "dative" | "genitive" | null (the case this word governs when used as a preposition or verb)
- "plural_form": string | null (the plural form of nouns, null otherwise)`,
  },
  es: {
    fields: ["gender", "verb_irregularity_type"],
    promptDescription: `- "gender": "masculine" | "feminine" | null (null for non-gendered parts of speech)
- "verb_irregularity_type": string | null (e.g. "stem-changing e→ie", "irregular preterite"; null for regular verbs or non-verbs)`,
  },
  ja: {
    fields: ["reading", "pitch_accent", "jlpt_level"],
    promptDescription: `- "reading": string (hiragana reading, e.g. "たべる")
- "pitch_accent": string (pitch accent pattern number, e.g. "0" for flat)
- "jlpt_level": "N5" | "N4" | "N3" | "N2" | "N1" | null`,
  },
};

// --- Request / Response types ---

interface RequestBody {
  word: string;
  sentence?: string;
  target_language: string;
  native_language?: string;
  existing_meanings?: Array<{
    definition_target: string;
    definition_native: string;
  }>;
}

// --- CORS headers ---

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-app-token, x-device-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// --- Main handler ---

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Validate shared secret
  const appToken = req.headers.get("x-app-token");
  const expectedToken = Deno.env.get("APP_SECRET_TOKEN");
  if (!expectedToken || appToken !== expectedToken) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Rate limiting
  const deviceId = req.headers.get("x-device-id");
  if (!deviceId) {
    return new Response(
      JSON.stringify({ error: "Missing x-device-id header" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const today = new Date().toISOString().split("T")[0];

  const { data: rateLimit, error: rateLimitError } = await supabase
    .from("rate_limits")
    .select("request_count")
    .eq("device_id", deviceId)
    .eq("date", today)
    .maybeSingle();

  if (rateLimitError) {
    console.error("Rate limit check failed:", rateLimitError);
    return new Response(
      JSON.stringify({ error: "Internal error checking rate limit" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const currentCount = rateLimit?.request_count ?? 0;

  if (currentCount >= 50) {
    return new Response(
      JSON.stringify({ error: "Daily limit reached. You can add up to 50 words per day." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Increment the counter (upsert)
  const { error: upsertError } = await supabase
    .from("rate_limits")
    .upsert(
      { device_id: deviceId, date: today, request_count: currentCount + 1 },
      { onConflict: "device_id,date" },
    );

  if (upsertError) {
    console.error("Rate limit upsert failed:", upsertError);
  }

  // Parse request
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const { word, sentence, target_language, native_language = "en", existing_meanings } = body;

  if (!word || !target_language) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: word, target_language" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const grammarConfig = GRAMMAR_CONFIGS[target_language];
  if (!grammarConfig) {
    return new Response(
      JSON.stringify({ error: `Unsupported target language: ${target_language}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Build the prompt
  const existingMeaningsBlock = existing_meanings?.length
    ? `\nThe user already has cards for this lemma with these meanings:\n${existing_meanings.map((m, i) => `${i + 1}. ${m.definition_target} (${m.definition_native})`).join("\n")}\n\nSet "is_new_sense" to true if the meaning in the provided sentence is clearly different from all existing meanings, or false if it matches one of them.`
    : `\nNo existing meanings are provided. Set "is_new_sense" to null.`;

  const sentenceBlock = sentence
    ? `Sentence where the word was encountered: "${sentence}"`
    : "No sentence was provided. Determine the most common meaning of the word.";

  const systemPrompt = `You are a multilingual lexicography assistant for a vocabulary learning app. Given a word and optionally a sentence, you analyze the word and return structured data.

You MUST respond with a single JSON object matching the schema below. No other text.

JSON Schema:
{
  "lemma": string,                    // base/dictionary form of the word
  "encountered_form": string,         // the word exactly as provided by the user
  "part_of_speech": "noun" | "verb" | "adjective" | "adverb" | "preposition" | "conjunction" | "pronoun" | "interjection",
  "pronunciation_ipa": string,        // IPA pronunciation of the lemma
  "grammar": {                        // language-specific grammar metadata
${grammarConfig.promptDescription}
  },
  "primary_definition_target": string, // concise definition in the target language
  "primary_definition_native": string, // idiomatic translation in ${native_language}
  "example_sentence": string,          // a natural example sentence using the word in the target language
  "total_common_meanings": number,     // how many commonly used distinct meanings this word has
  "is_new_sense": boolean | null,      // whether this is a different sense from existing meanings
  "other_meanings": [                  // other common meanings (excluding the primary one)
    {
      "definition_target": string,
      "definition_native": string,
      "example_sentence": string
    }
  ],
  "synonyms": [                        // 2-3 synonyms
    {
      "word": string,
      "register": string              // register label appropriate for the target language
    }
  ],
  "antonym": {                         // 1 antonym if one naturally exists, otherwise null
    "word": string
  } | null,
  "irregular_forms": string | null     // notable irregular forms worth memorizing (e.g. "plural: yeux", "past participle: été")
}

Rules:
- The lemma must be the dictionary/base form (unconjugated verbs, singular nouns, masculine singular adjectives for gendered languages).
- The primary definition should be based on the context of the provided sentence. If no sentence, use the most common meaning.
- Provide 2-3 synonyms with register labels. Use register labels natural to the target language.
- Only include an antonym if one naturally and commonly exists. Otherwise set to null.
- For other_meanings, include other commonly used senses (not obscure ones). Exclude the primary meaning.
- The example_sentence should be different from the user's sentence and demonstrate natural usage.
- irregular_forms should only include forms that are worth memorizing (truly irregular, not regular conjugation patterns).`;

  const userPrompt = `Word: "${word}"
${sentenceBlock}
Target language: ${target_language}
Native language: ${native_language}
${existingMeaningsBlock}`;

  // Call Gemini API
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiApiKey) {
    return new Response(
      JSON.stringify({ error: "Server misconfiguration: missing API key" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: userPrompt }],
            },
          ],
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.3,
          },
        }),
      },
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Gemini API error:", geminiResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI service error", details: geminiResponse.status }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const geminiData = await geminiResponse.json();
    const textContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textContent) {
      return new Response(
        JSON.stringify({ error: "Empty response from AI" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Parse the JSON response from Gemini
    let aiResult;
    try {
      aiResult = JSON.parse(textContent);
    } catch {
      console.error("Failed to parse AI response as JSON:", textContent);
      return new Response(
        JSON.stringify({ error: "AI returned invalid JSON" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify(aiResult),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Request to Gemini API failed:", err);
    return new Response(
      JSON.stringify({ error: "Failed to reach AI service" }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
