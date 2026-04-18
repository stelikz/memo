import { createTestDb } from "./helpers/test-db";
import { createCard } from "../db/queries";
import {
  generateCard,
  getExistingMeanings,
  nextSenseId,
  savePendingCard,
  addWord,
  OfflineError,
  RateLimitError,
} from "../lib/ai";

// ── Mock fetch & device-id ──────────────────────────────────────────────────

const mockFetch = jest.fn();
(globalThis as any).fetch = mockFetch;

jest.mock("../lib/device-id", () => ({
  getDeviceId: () => "test-device-id",
}));

// ── Helpers ─────────────────────────────────────────────────────────────────

const MOCK_AI_RESPONSE = {
  lemma: "aller",
  encountered_form: "vais",
  part_of_speech: "verb",
  pronunciation_ipa: "a.le",
  grammar: { gender: null, verb_auxiliary: "être", is_pronominal: false },
  primary_definition_target: "Se déplacer d'un lieu à un autre",
  primary_definition_native: "to go",
  example_sentence: "Nous allons à la plage cet été.",
  total_common_meanings: 2,
  is_new_sense: null,
  other_meanings: [
    {
      definition_target: "Être sur le point de",
      definition_native: "to be going to",
      example_sentence: "Il va pleuvoir demain.",
    },
  ],
  synonyms: [
    { word: "se rendre", register: "courant" },
    { word: "se diriger", register: "soutenu" },
  ],
  antonym: { word: "venir" },
  irregular_forms: "je vais, tu vas, il va",
};

function mockSuccessResponse(body: any = MOCK_AI_RESPONSE) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  });
}

function mockErrorResponse(status: number, body: any) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: () => Promise.resolve(body),
  });
}

function insertCompleteCard(
  db: any,
  overrides: Partial<Parameters<typeof createCard>[1]> = {},
) {
  const now = Math.floor(Date.now() / 1000);
  createCard(db, {
    id: `card-${Math.random().toString(36).slice(2, 8)}`,
    status: "complete",
    targetLanguage: "fr",
    lemma: "louer",
    senseId: `louer_1`,
    encounteredForm: "loue",
    partOfSpeech: "verb",
    pronunciationIpa: "lu.e",
    grammarJson: "{}",
    primaryDefinitionTarget: "Donner en location",
    primaryDefinitionNative: "to rent",
    userSentencesJson: '["Je loue un appartement."]',
    exampleSentence: "Elle loue sa maison.",
    totalCommonMeanings: 2,
    otherMeaningsJson: "[]",
    synonymsJson: "[]",
    antonym: null,
    irregularForms: null,
    due: now,
    stability: 0,
    difficulty: 0,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    state: 0,
    lastReview: null,
    learningSteps: 0,
    ...overrides,
  });
}

beforeEach(() => {
  mockFetch.mockReset();
});

// ── Tests: generateCard ─────────────────────────────────────────────────────

describe("generateCard", () => {
  it("calls the edge function and returns AICardResponse", async () => {
    const { db } = createTestDb();
    mockSuccessResponse();

    const result = await generateCard(db as any, {
      word: "vais",
      sentence: "Je vais au marché",
      targetLanguage: "fr",
    });

    expect(result.lemma).toBe("aller");
    expect(result.encountered_form).toBe("vais");
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("ai-proxy");
    const body = JSON.parse(options.body);
    expect(body.word).toBe("vais");
    expect(body.target_language).toBe("fr");
  });

  it("sends existing_meanings when provided", async () => {
    const { db } = createTestDb();
    mockSuccessResponse();

    await generateCard(db as any, {
      word: "loue",
      targetLanguage: "fr",
      existingMeanings: [
        { definition_target: "Donner en location", definition_native: "to rent" },
      ],
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.existing_meanings).toHaveLength(1);
    expect(body.existing_meanings[0].definition_native).toBe("to rent");
  });

  it("throws OfflineError when fetch fails with a network error", async () => {
    const { db } = createTestDb();
    mockFetch.mockRejectedValueOnce(new TypeError("Network request failed"));

    await expect(
      generateCard(db as any, { word: "test", targetLanguage: "fr" }),
    ).rejects.toThrow(OfflineError);
  });

  it("throws RateLimitError on 429 response", async () => {
    const { db } = createTestDb();
    mockErrorResponse(429, { error: "Daily limit reached. You can add up to 50 words per day." });

    await expect(
      generateCard(db as any, { word: "test", targetLanguage: "fr" }),
    ).rejects.toThrow(RateLimitError);
  });

  it("throws generic Error on other HTTP errors", async () => {
    const { db } = createTestDb();
    mockErrorResponse(502, { error: "AI service error" });

    await expect(
      generateCard(db as any, { word: "test", targetLanguage: "fr" }),
    ).rejects.toThrow("AI service error");
  });
});

// ── Tests: getExistingMeanings ──────────────────────────────────────────────

describe("getExistingMeanings", () => {
  it("returns empty array when no cards exist for lemma", () => {
    const { db } = createTestDb();
    const meanings = getExistingMeanings(db as any, "aller");
    expect(meanings).toEqual([]);
  });

  it("returns meanings from complete cards only", () => {
    const { db } = createTestDb();
    insertCompleteCard(db, { lemma: "louer", senseId: "louer_1" });
    insertCompleteCard(db, {
      lemma: "louer",
      senseId: "louer_pending",
      status: "pending",
      primaryDefinitionTarget: "",
      primaryDefinitionNative: "",
    });

    const meanings = getExistingMeanings(db as any, "louer");
    expect(meanings).toHaveLength(1);
    expect(meanings[0].definition_target).toBe("Donner en location");
    expect(meanings[0].definition_native).toBe("to rent");
  });

  it("returns multiple meanings for polysemous words", () => {
    const { db } = createTestDb();
    insertCompleteCard(db, {
      lemma: "louer",
      senseId: "louer_1",
      primaryDefinitionTarget: "Donner en location",
      primaryDefinitionNative: "to rent",
    });
    insertCompleteCard(db, {
      lemma: "louer",
      senseId: "louer_2",
      primaryDefinitionTarget: "Faire l'éloge de",
      primaryDefinitionNative: "to praise",
    });

    const meanings = getExistingMeanings(db as any, "louer");
    expect(meanings).toHaveLength(2);
  });
});

// ── Tests: nextSenseId ──────────────────────────────────────────────────────

describe("nextSenseId", () => {
  it("returns lemma_1 for a new lemma", () => {
    const { db } = createTestDb();
    expect(nextSenseId(db as any, "aller")).toBe("aller_1");
  });

  it("increments for existing lemmas", () => {
    const { db } = createTestDb();
    insertCompleteCard(db, { lemma: "louer", senseId: "louer_1" });
    expect(nextSenseId(db as any, "louer")).toBe("louer_2");
  });
});

// ── Tests: savePendingCard ──────────────────────────────────────────────────

describe("savePendingCard", () => {
  it("creates a card with status pending and empty AI fields", () => {
    const { db, sqlite } = createTestDb();

    const id = savePendingCard(db as any, {
      word: "manger",
      sentence: "Je mange une pomme",
      targetLanguage: "fr",
    });

    expect(id).toBeTruthy();

    const row = sqlite
      .prepare("SELECT * FROM cards WHERE id = ?")
      .get(id) as any;

    expect(row.status).toBe("pending");
    expect(row.encountered_form).toBe("manger");
    expect(row.lemma).toBe("manger");
    expect(row.primary_definition_target).toBe("");
    expect(row.primary_definition_native).toBe("");
    expect(JSON.parse(row.user_sentences_json)).toEqual(["Je mange une pomme"]);
  });

  it("saves with empty sentences array when no sentence provided", () => {
    const { db, sqlite } = createTestDb();

    const id = savePendingCard(db as any, {
      word: "bonjour",
      targetLanguage: "fr",
    });

    const row = sqlite
      .prepare("SELECT user_sentences_json FROM cards WHERE id = ?")
      .get(id) as any;
    expect(JSON.parse(row.user_sentences_json)).toEqual([]);
  });
});

// ── Tests: addWord (orchestrator) ───────────────────────────────────────────

describe("addWord", () => {
  it("returns 'created' for a brand new word", async () => {
    const { db } = createTestDb();
    mockSuccessResponse();

    const result = await addWord(db as any, {
      word: "vais",
      sentence: "Je vais au marché",
      targetLanguage: "fr",
    });

    expect(result.status).toBe("created");
    if (result.status === "created") {
      expect(result.response.lemma).toBe("aller");
    }
  });

  it("returns 'pending' when offline", async () => {
    const { db, sqlite } = createTestDb();
    mockFetch.mockRejectedValue(new TypeError("Network request failed"));

    const result = await addWord(db as any, {
      word: "manger",
      sentence: "Je mange une pomme",
      targetLanguage: "fr",
    });

    expect(result.status).toBe("pending");
    if (result.status === "pending") {
      const row = sqlite
        .prepare("SELECT status FROM cards WHERE id = ?")
        .get(result.cardId) as any;
      expect(row.status).toBe("pending");
    }
  });

  it("passes existing meanings for polysemy detection when lemma matches", async () => {
    const { db } = createTestDb();
    insertCompleteCard(db, { lemma: "louer", senseId: "louer_1" });

    const newSenseResponse = {
      ...MOCK_AI_RESPONSE,
      lemma: "louer",
      encountered_form: "loue",
      is_new_sense: true,
      primary_definition_target: "Faire l'éloge de",
      primary_definition_native: "to praise",
    };
    mockSuccessResponse(newSenseResponse);

    const result = await addWord(db as any, {
      word: "louer",
      sentence: "Il faut louer ses efforts",
      targetLanguage: "fr",
    });

    // Verify existing meanings were sent to the AI
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.existing_meanings).toHaveLength(1);
    expect(body.existing_meanings[0].definition_native).toBe("to rent");

    expect(result.status).toBe("new_sense");
    if (result.status === "new_sense") {
      expect(result.response.is_new_sense).toBe(true);
      expect(result.existingSenseIds).toHaveLength(1);
    }
  });

  it("returns 'duplicate' when AI says it's the same sense", async () => {
    const { db } = createTestDb();
    insertCompleteCard(db, {
      id: "existing-card-id",
      lemma: "louer",
      senseId: "louer_1",
    });

    mockSuccessResponse({
      ...MOCK_AI_RESPONSE,
      lemma: "louer",
      is_new_sense: false,
    });

    const result = await addWord(db as any, {
      word: "louer",
      sentence: "On loue des voitures ici",
      targetLanguage: "fr",
    });

    expect(result.status).toBe("duplicate");
    if (result.status === "duplicate") {
      expect(result.existingCardId).toBe("existing-card-id");
    }
  });

  it("re-fetches with polysemy info when AI lemma differs from guess", async () => {
    const { db } = createTestDb();
    // "vais" lowercased doesn't match "aller", so first call won't have existing meanings
    insertCompleteCard(db, {
      lemma: "aller",
      senseId: "aller_1",
      primaryDefinitionTarget: "Se déplacer",
      primaryDefinitionNative: "to go",
    });

    // First call: no existing meanings (guessed lemma "vais" != "aller")
    mockSuccessResponse({ ...MOCK_AI_RESPONSE, is_new_sense: null });
    // Second call: with existing meanings for "aller"
    mockSuccessResponse({ ...MOCK_AI_RESPONSE, is_new_sense: false });

    const result = await addWord(db as any, {
      word: "vais",
      sentence: "Je vais au parc",
      targetLanguage: "fr",
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Second call should include existing meanings
    const secondBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(secondBody.existing_meanings).toHaveLength(1);
    expect(secondBody.existing_meanings[0].definition_native).toBe("to go");

    expect(result.status).toBe("duplicate");
  });

  it("propagates RateLimitError without saving pending", async () => {
    const { db } = createTestDb();
    mockErrorResponse(429, { error: "Daily limit reached. You can add up to 50 words per day." });

    await expect(
      addWord(db as any, { word: "test", targetLanguage: "fr" }),
    ).rejects.toThrow(RateLimitError);
  });
});
