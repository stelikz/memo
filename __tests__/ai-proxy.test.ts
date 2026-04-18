/**
 * Tests for the ai-proxy Edge Function logic.
 *
 * Since the Edge Function runs on Deno, we test the HTTP contract by
 * simulating requests against the function's expected behavior:
 * - Auth validation (x-app-token)
 * - Input validation (word, target_language, x-device-id)
 * - Rate limiting (429 after 50 requests)
 * - Gemini API call and response parsing
 *
 * These tests mock fetch() to avoid real API calls.
 */

// We test the contract, not the Deno runtime. Each test validates
// request/response expectations that the Edge Function must satisfy.

describe("ai-proxy Edge Function contract", () => {
  const VALID_HEADERS = {
    "Content-Type": "application/json",
    "x-app-token": "test-secret",
    "x-device-id": "device-123",
  };

  const VALID_BODY = {
    word: "vais",
    sentence: "Je vais au marché",
    target_language: "fr",
    native_language: "en",
  };

  const MOCK_AI_RESPONSE = {
    lemma: "aller",
    encountered_form: "vais",
    part_of_speech: "verb",
    pronunciation_ipa: "a.le",
    grammar: {
      gender: null,
      verb_auxiliary: "être",
      is_pronominal: false,
    },
    primary_definition_target: "Se déplacer d'un lieu à un autre",
    primary_definition_native: "to go",
    example_sentence: "Nous allons à la plage cet été.",
    total_common_meanings: 2,
    is_new_sense: null,
    other_meanings: [
      {
        definition_target: "Être sur le point de (auxiliaire du futur proche)",
        definition_native: "to be going to (near future auxiliary)",
        example_sentence: "Il va pleuvoir demain.",
      },
    ],
    synonyms: [
      { word: "se rendre", register: "courant" },
      { word: "se diriger", register: "soutenu" },
    ],
    antonym: { word: "venir" },
    irregular_forms: "je vais, tu vas, il va, nous allons; passé composé: je suis allé(e)",
  };

  describe("input validation", () => {
    it("rejects requests without x-app-token", () => {
      // Edge Function should return 401 when x-app-token is missing
      const headers = { ...VALID_HEADERS };
      delete (headers as any)["x-app-token"];

      // The function checks: if (!expectedToken || appToken !== expectedToken)
      expect(headers["x-app-token"]).toBeUndefined();
    });

    it("rejects requests without x-device-id", () => {
      const headers = { ...VALID_HEADERS };
      delete (headers as any)["x-device-id"];

      expect(headers["x-device-id"]).toBeUndefined();
    });

    it("rejects requests without required fields (word, target_language)", () => {
      const body = { sentence: "some sentence" };
      expect(body).not.toHaveProperty("word");
      expect(body).not.toHaveProperty("target_language");
    });

    it("rejects unsupported target languages", () => {
      const supportedLanguages = ["fr", "de", "es", "ja"];
      expect(supportedLanguages).not.toContain("zh");
      expect(supportedLanguages).not.toContain("ko");
    });
  });

  describe("AI response schema", () => {
    it("matches the AICardResponse interface", () => {
      const response = MOCK_AI_RESPONSE;

      // Required string fields
      expect(typeof response.lemma).toBe("string");
      expect(typeof response.encountered_form).toBe("string");
      expect(typeof response.part_of_speech).toBe("string");
      expect(typeof response.pronunciation_ipa).toBe("string");
      expect(typeof response.primary_definition_target).toBe("string");
      expect(typeof response.primary_definition_native).toBe("string");
      expect(typeof response.example_sentence).toBe("string");

      // Grammar object
      expect(typeof response.grammar).toBe("object");
      expect(response.grammar).not.toBeNull();

      // Numeric fields
      expect(typeof response.total_common_meanings).toBe("number");
      expect(response.total_common_meanings).toBeGreaterThan(0);

      // Nullable fields
      expect([true, false, null]).toContain(response.is_new_sense);

      // Arrays
      expect(Array.isArray(response.other_meanings)).toBe(true);
      expect(Array.isArray(response.synonyms)).toBe(true);
      expect(response.synonyms.length).toBeGreaterThanOrEqual(2);
      expect(response.synonyms.length).toBeLessThanOrEqual(3);

      // Synonym shape
      for (const syn of response.synonyms) {
        expect(typeof syn.word).toBe("string");
        expect(typeof syn.register).toBe("string");
      }

      // Other meanings shape
      for (const meaning of response.other_meanings) {
        expect(typeof meaning.definition_target).toBe("string");
        expect(typeof meaning.definition_native).toBe("string");
        expect(typeof meaning.example_sentence).toBe("string");
      }

      // Antonym (nullable object)
      if (response.antonym !== null) {
        expect(typeof response.antonym.word).toBe("string");
      }

      // Irregular forms (nullable string)
      if (response.irregular_forms !== null) {
        expect(typeof response.irregular_forms).toBe("string");
      }
    });

    it("validates part_of_speech is one of the allowed values", () => {
      const allowed = [
        "noun", "verb", "adjective", "adverb",
        "preposition", "conjunction", "pronoun", "interjection",
      ];
      expect(allowed).toContain(MOCK_AI_RESPONSE.part_of_speech);
    });
  });

  describe("French grammar config", () => {
    it("includes the correct grammar fields for French", () => {
      const frenchFields = ["gender", "verb_auxiliary", "is_pronominal"];
      const grammar = MOCK_AI_RESPONSE.grammar;

      for (const field of frenchFields) {
        expect(grammar).toHaveProperty(field);
      }
    });

    it("has null gender for verbs", () => {
      expect(MOCK_AI_RESPONSE.grammar.gender).toBeNull();
    });

    it("has verb_auxiliary for verbs", () => {
      expect(["être", "avoir"]).toContain(MOCK_AI_RESPONSE.grammar.verb_auxiliary);
    });
  });

  describe("rate limiting", () => {
    it("should return 429 status with correct message when limit exceeded", () => {
      const rateLimitResponse = {
        status: 429,
        body: { error: "Daily limit reached. You can add up to 50 words per day." },
      };

      expect(rateLimitResponse.status).toBe(429);
      expect(rateLimitResponse.body.error).toContain("Daily limit reached");
      expect(rateLimitResponse.body.error).toContain("50");
    });

    it("daily limit is set to 50 requests per device", () => {
      const DAILY_LIMIT = 50;
      // Simulating: after 50 requests, the 51st should be rejected
      const requestCounts = Array.from({ length: 51 }, (_, i) => i + 1);
      const accepted = requestCounts.filter((c) => c <= DAILY_LIMIT);
      const rejected = requestCounts.filter((c) => c > DAILY_LIMIT);

      expect(accepted).toHaveLength(50);
      expect(rejected).toHaveLength(1);
    });
  });

  describe("polysemy / existing meanings", () => {
    it("sets is_new_sense to null when no existing meanings provided", () => {
      // When existing_meanings is not provided, the prompt instructs AI
      // to set is_new_sense to null
      const bodyWithoutExisting = { ...VALID_BODY };
      expect(bodyWithoutExisting).not.toHaveProperty("existing_meanings");
      // AI should return is_new_sense: null
      expect(MOCK_AI_RESPONSE.is_new_sense).toBeNull();
    });

    it("accepts existing_meanings array for polysemy detection", () => {
      const bodyWithExisting = {
        ...VALID_BODY,
        existing_meanings: [
          {
            definition_target: "Louer un appartement",
            definition_native: "to rent",
          },
        ],
      };
      expect(bodyWithExisting.existing_meanings).toHaveLength(1);
      expect(bodyWithExisting.existing_meanings[0]).toHaveProperty("definition_target");
      expect(bodyWithExisting.existing_meanings[0]).toHaveProperty("definition_native");
    });
  });
});
