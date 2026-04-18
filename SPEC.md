# Mémo — Project Spec

## Overview

**Mémo** is a mobile-first vocabulary learning app that eliminates the friction of manual flashcard creation. The user provides a word and the sentence where they encountered it. AI does the rest: identifies the correct definition in context, translates, finds synonyms/antonyms, handles conjugation/grammar, and detects polysemy. Spaced repetition (FSRS) schedules reviews. Everything works offline.

The accent in Mémo nods to the app's French origins while remaining language-neutral — a memo is a note you take in any language. App Store and Google Play both support the accented name, and unaccented searches ("memo") still surface the app.

**v1 ships with French** as the target language, but the architecture is designed to support any language with minimal changes (see "Multi-Language Extensibility" section).

**The app UI is displayed in the target language by default** (e.g. French labels, French prompts) to maximise immersion. Users can toggle to English via settings.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native + Expo (managed workflow) |
| Language | TypeScript |
| Local DB | expo-sqlite + Drizzle ORM |
| Spaced Repetition | ts-fsrs |
| State Management | Zustand |
| Styling | NativeWind (Tailwind for RN) |
| Notifications | expo-notifications (local) |
| Share Sheet | expo-share-intent |
| TTS | expo-speech (native engine, offline) |
| Localization | i18n-js or expo-localization + custom locale maps |
| Camera (v1.1) | expo-camera |
| Backend | Supabase Edge Functions (AI proxy only — no auth/sync in v1) |
| AI Provider | Google Gemini API (via Supabase Edge Function) |

---

## Core User Flow

### Adding a Card

1. User opens app → taps "Add word"
2. User enters:
   - **Word** (required): the word as encountered (can be conjugated, e.g. "vais")
   - **Sentence** (strongly encouraged): the sentence where they saw the word
3. App sends word + sentence to backend AI proxy
4. AI returns structured JSON (see AI Response Schema below)
5. App checks: does a card with the same `lemma` already exist?
   - **No existing card**: save as new card, show confirmation
   - **Existing card, same meaning**: ask user — "You already have this word with this meaning. Add this sentence as another example?" If yes, append the new sentence to the existing card's `user_sentences_json` array
   - **Existing card, different meaning**: show "You already know *louer* = to rent. This is a different meaning: to praise." User taps [Add as new card] or [Same meaning, just add sentence]
6. Card saved to SQLite with FSRS initial state

### Reviewing Cards

1. App calculates due cards using FSRS scheduling
2. Review screen shows one card at a time:
   - **Front**: the word in context (sentence with word highlighted). If no sentence, show word alone
   - **Back** (tap to reveal): definition (FR + EN), synonyms, antonym, grammar info, "also means..." footnote if sibling cards exist
3. User rates: Again / Hard / Good / Easy
4. FSRS updates card scheduling parameters
5. Next card or "All done!" screen

### Adding via Share Sheet (Primary Input Method)

1. User is reading content in the target language in any app (Safari, News, social media, etc.)
2. User highlights text containing the word they want to learn
3. User taps Share → selects our app
4. App receives the shared text and opens a word selection screen:
   - **If shared text is a single word or very short phrase**: treat it as the target word directly, skip to card generation
   - **If shared text is a sentence or longer**: display the text with every word tappable. The user taps the word they want to learn. That word + the surrounding sentence get sent to the AI
5. From here, follows the same flow as manual card addition (step 3 onward in "Adding a Card")

This avoids unreliable AI guessing about which word the user wants to learn — the user picks the word with one tap.

Implementation: use `expo-share-intent` to register the app as a share target for text on iOS and Android. For non-Latin scripts (Japanese, Chinese), the AI handles word boundary detection since there are no spaces between words.

### Adding via Camera (v1.1)

1. User taps "Camera" on the Add Word screen
2. User points camera at a French text (book, menu, sign, etc.)
3. User takes a photo
4. Photo is sent to the AI backend (Gemini handles image input natively)
5. AI extracts all visible text, identifies French content
6. App shows the extracted text — user taps the word they want to learn
7. AI identifies the tapped word + surrounding sentence, then follows the standard card generation flow

Implementation: use `expo-camera` for capture. The same AI Edge Function handles the image — send it as base64 in the request body. No separate OCR service needed.

### Daily Reminder

- Local notification at a user-configured time (default 8pm)
- Message: "You have X cards to review" (computed locally from SQLite)
- Uses expo-notifications scheduled notifications — no backend needed

---

## AI Integration

### Architecture

```
App → HTTPS → Supabase Edge Function → Google Gemini API
                (API key stored here)
```

The Edge Function is a thin proxy:
- Receives word + sentence + existing meanings for that lemma (if any)
- Forwards to Gemini with a structured prompt
- Returns the JSON response to the app
- Enforces per-device rate limiting (see below)

### Rate Limiting

The Edge Function enforces a daily limit of **50 AI calls per device** to prevent abuse.

- The app sends an `x-device-id` header with each request (a UUID generated once on first launch and persisted locally)
- The Edge Function tracks usage in a Supabase Postgres table:

```sql
create table rate_limits (
  device_id text not null,
  date date not null default current_date,
  request_count integer not null default 1,
  primary key (device_id, date)
);
```

- On each request, the function upserts the counter for the device + current date:
  - If `request_count` < 50: increment and proceed
  - If `request_count` >= 50: reject with HTTP `429 Too Many Requests` and body `{ "error": "Daily limit reached. You can add up to 50 words per day." }`
- Old rows can be cleaned up periodically (e.g. delete rows older than 7 days) but this is not required for v1

### AI Prompt Responsibilities

Given a word, sentence, and target language, the AI must:

1. **Identify the lemma** — unconjugate verbs (vais → aller), reduce to base form
2. **Determine the correct definition** based on sentence context
3. **Provide target-language definition** — concise, in the target language
4. **Provide native-language translation** — idiomatic, not literal
5. **Flag polysemy** — note how many common distinct meanings this word has
6. **Determine if this is a new sense** vs. an existing one (when existing meanings are provided)
7. **Provide 2-3 synonyms** with register notes where applicable
8. **Provide 1 antonym** if one naturally exists (null if not)
9. **Include language-specific grammar metadata** — the prompt dynamically requests different fields based on the target language:
   - French: gender, verb auxiliary (être/avoir), pronominal status
   - German: gender, case government, plural form
   - Spanish: gender, verb irregularity type
   - Japanese: reading (hiragana), pitch accent, JLPT level
   - (Extend per language as needed)
10. **IPA pronunciation**
11. **Notable irregular forms**

### AI Response Schema

```typescript
interface AICardResponse {
  lemma: string;                    // e.g. "aller"
  encountered_form: string;         // e.g. "vais"
  part_of_speech: "noun" | "verb" | "adjective" | "adverb" | "preposition" | "conjunction" | "pronoun" | "interjection";
  pronunciation_ipa: string;        // e.g. "a.le"
  
  // Language-specific grammar — shape varies by target language
  // French example: { gender: "masculine", verb_auxiliary: "être", is_pronominal: false }
  // German example: { gender: "neuter", case_government: "accusative", plural: "Häuser" }
  // Japanese example: { reading: "たべる", pitch_accent: "0", jlpt_level: "N5" }
  grammar: Record<string, any>;
  
  // Primary meaning (based on provided sentence context)
  primary_definition_target: string;  // in the target language
  primary_definition_native: string;  // in the user's native language
  example_sentence: string;
  
  // Polysemy
  total_common_meanings: number;    // e.g. 2 for "louer"
  is_new_sense: boolean | null;     // null if no existing meanings provided
  other_meanings: Array<{
    definition_target: string;
    definition_native: string;
    example_sentence: string;
  }>;
  
  // Related words
  synonyms: Array<{
    word: string;
    register: string;               // language-appropriate register label
  }>;
  antonym: {
    word: string;
  } | null;
  
  // Irregularities worth noting
  irregular_forms: string | null;   // e.g. "plural: yeux" or "past participle: été"
}
```

---

## Data Model (SQLite via Drizzle)

### Cards Table

```typescript
cards {
  id: text (UUID, primary key)
  created_at: integer (unix timestamp)
  updated_at: integer (unix timestamp)
  
  // Card status: "complete" or "pending" (offline queue — word+sentence saved, awaiting AI)
  status: text                      // "complete" (default), "pending"
  
  // Language — intentionally text, not enum. SQLite has no real enum type
  // (Drizzle would fake it with a CHECK constraint), and adding a new
  // language would require a schema migration. Validate in TypeScript
  // against LANGUAGE_CONFIGS keys instead — that's the source of truth.
  target_language: text              // "fr", "de", "es", "ja", etc.
  
  // Word identity
  lemma: text                       // "aller" — shared across senses
  sense_id: text (unique)           // "aller_1", "aller_2" — app-generated, deterministic
  encountered_form: text            // "vais"
  part_of_speech: text
  pronunciation_ipa: text
  
  // Grammar metadata — language-specific, stored as flexible JSON
  // French: { gender, verb_auxiliary, is_pronominal }
  // German: { gender, case_government, plural_form }
  // Japanese: { reading, pitch_accent, jlpt_level }
  grammar_json: text                // JSON string, shape varies by language
  
  // Definitions
  primary_definition_target: text   // definition in the target language
  primary_definition_native: text   // definition in the user's native language
  
  // Context — multiple user sentences supported (JSON array of strings)
  user_sentences_json: text         // e.g. '["Je loue un appartement.", "On loue des voitures."]'
  example_sentence: text            // AI-generated example sentence
  
  // Polysemy
  total_common_meanings: integer
  other_meanings_json: text         // JSON string of other_meanings array
  
  // Related words
  synonyms_json: text               // JSON string of synonyms array
  antonym: text | null
  
  // Irregular forms
  irregular_forms: text | null
  
  // FSRS scheduling fields
  due: integer (unix timestamp)
  stability: real
  difficulty: real
  elapsed_days: integer
  scheduled_days: integer
  reps: integer
  lapses: integer
  state: integer                    // 0=New, 1=Learning, 2=Review, 3=Relearning
  last_review: integer | null (unix timestamp)
  learning_steps: integer           // ts-fsrs v5: which step in learning/relearning sequence
  
  // Suspension — independent flag, never touches FSRS state
  is_suspended: integer             // 0=active (default), 1=suspended
}
```

### App Settings Table

```typescript
app_settings {
  key: text (primary key)
  value: text
}

// Expected keys:
// "target_language" — "fr" (default), "de", "es", "ja", etc.
// "native_language" — "en" (default)
// "show_native_by_default" — "false" (default)
// "reminder_enabled" — "true"
// "reminder_time" — "20:00"
// "current_streak" — "0" (number of consecutive days with at least one review)
// "last_review_date" — "" (ISO date string, e.g. "2026-04-18")
```

### Indexes

- `idx_cards_due` on (state, due) — for fetching review queue
- `idx_cards_lemma` on (lemma) — for polysemy lookups

---

## Screen Map

### 1. Home Screen
- Count of cards due today (tappable → starts review)
- Total cards count (tappable → opens word library)
- Day streak
- "Add word" button
- Recently added words list
- All UI labels in target language by default

### 2. Add Word Screen
- Word input field (required)
- Sentence input field (encouraged, with label in target language e.g. "Où l'avez-vous vu?")
- Clipboard paste suggestion if clipboard contains target language text
- "Add" button → loading state → confirmation or polysemy disambiguation
- Camera scan option (v1.1)

### 3. Share Intent Word Selection Screen
- Opened automatically when text is shared from another app
- If shared text is a single word: skip directly to card generation
- If shared text is a sentence/paragraph: display text with every word tappable
  - Common function words dimmed but still tappable
  - User taps the word they want to learn → word highlights
  - Selected word + full sentence sent to AI
- [Add card] button → proceeds to card generation
- [Cancel] button → dismisses

### 4. AI Loading Screen
- Spinner with word being processed
- Step indicators: identifying lemma → finding definition → generating synonyms → checking polysemy

### 5. Card Created Confirmation Screen
- Success state with card preview (definition, synonyms, antonym)
- Speaker icon next to the lemma — tap to hear pronunciation via TTS
- Native-language translation hidden by default (tappable to reveal)
- Polysemy info if word has multiple common meanings
- [Add another word] / [Go home] actions

### 6. Polysemy Disambiguation Screen
- Shown when the entered word matches an existing lemma with a different meaning
- Info banner showing "This is the Nth meaning of [word] you've learned. This word has roughly X common meanings."
- Shows existing meaning card(s)
- Shows new meaning detected (highlighted)
- Two actions: [Add as new card] / [Same meaning, just add sentence]

### 7. Review Screen — Card Front
- Progress bar and count (e.g. "5 of 18")
- Card area showing sentence with target word highlighted
- If no sentence: word displayed alone, centered
- "Tap card to reveal" hint
- Rating buttons greyed out until card is flipped

### 8. Review Screen — Card Back
- Sentence with highlighted word (context)
- Lemma + IPA pronunciation + grammar badge + speaker icon (tap to hear word via TTS)
- Tap sentence area to hear the full sentence read aloud
- Definition in target language
- Native-language translation hidden behind dashed tap target (e.g. "🇬🇧 Show English translation")
- Synonyms with register tags
- Antonym
- Polysemy footnote: only shows sibling meanings the user has already learned as cards (dynamic, not static). If no siblings learned yet, no footnote shown
- Rating buttons: Again / Hard / Good / Easy (with next review interval shown)

### 9. Review Complete Screen
- "Bien joué!" (or equivalent in target language) with success icon
- Session stats: cards reviewed, streak count
- Breakdown bar: again/hard/good/easy proportions
- [Go home] / [Add a word] actions

### 10. Word Library Screen
- Accessed by tapping total cards count on home screen
- Search bar for filtering words
- Filter chips: All, Nouns, Verbs, Adjectives, Due
- Sort options: newest first, alphabetical, due date
- Word list showing: word, part of speech, definition preview, FSRS state badge (new/learning/mature), polysemy badge if multiple senses
- "Select" button to enter mass edit mode
- Tapping a word opens full card detail (editable, with TTS playback)

### 11. Mass Edit Mode
- Checkboxes appear next to each word
- Selection count in header
- "Select all" option
- Bottom action bar with bulk operations:
  - Reset progress (restart FSRS scheduling)
  - Suspend (remove from review queue without deleting)
  - Delete
- "Cancel" to exit selection mode

### 12. Settings Screen
- Daily reminder toggle + time picker
- "Show English by default" toggle (controls native-language translation visibility on card back)
- Target language selector (French for v1, extensible)
- Data stats: total cards, mature cards, longest streak
- Reset all progress (danger action)

### Error States (inline, not separate screens)
- **AI call fails** (network error, server error): show retry button with error message on Add Word screen
- **AI returns invalid JSON**: show error with option to retry or cancel
- **No internet on Add Word screen**: offer to save as pending (offline queue) — card will be processed when connectivity returns
- **Review screen**: fully offline, no error states needed

---

## v1 Scope (Ship This First)

**In scope:**
- Add word + sentence → AI generates card → save to SQLite
- Share sheet integration — highlight text in any app, share to our app, tap the word to learn, save (primary input method)
- Polysemy detection and linked sense cards
- FSRS-scheduled reviews with Again/Hard/Good/Easy
- Review card back: definition in target language, native translation hidden by default
- Polysemy footnotes: only show sibling meanings the user has already learned
- Word library: browse, search, filter all cards. Mass edit mode (reset/suspend/delete)
- App UI in target language by default, toggleable to native language in settings
- Local notifications for daily review reminder
- Offline-first: all review works without internet, card creation requires internet (for AI)
- Language-agnostic architecture (flexible grammar schema, locale maps, language config)
- French as default target language
- Works on iOS (developer's own phone via TestFlight or dev build)

**v1.1 (next iteration):**
- Camera OCR for physical books (point, snap, tap word)

**v2 — Practice Mode (Contextual Fill-in-the-Blank):**
- See "Practice Mode" section below for full design
- Barron's 1100-style exercises using words the user already has
- AI generates paragraphs from 5 words in the user's card bank
- Separate from flashcard review — a "Practice" tab alongside "Review"

**v3 — Vocab Discovery:**
- See "Vocab Discovery" section below for full design
- CEFR-leveled French frequency lists embedded in the app
- Proactive word suggestions based on user's current level
- Can also feed into Practice Mode (mix known words + new suggested words)

**Out of scope (future):**
- User accounts / authentication
- Cross-device sync
- Deck organization
- Export/import
- Android (unless trivially works via Expo)
- Web version

---

## Project Structure

```
/app                    # Expo Router file-based routing
  /(tabs)
    index.tsx           # Home screen
    settings.tsx        # Settings
  /add.tsx              # Add word screen (manual input)
  /share-intent.tsx     # Share sheet: tap-to-select word from shared text
  /review.tsx           # Review screen (front + back + rating)
  /review-complete.tsx  # Review session summary
  /disambiguate.tsx     # Polysemy disambiguation
  /library.tsx          # Word library (browse, search, filter)
  /card-detail.tsx      # Single card detail view (editable)
/components             # Reusable UI components
/db
  schema.ts             # Drizzle schema
  client.ts             # SQLite/Drizzle setup
  queries.ts            # Card CRUD operations
/lib
  ai.ts                 # API call to Supabase Edge Function
  fsrs.ts               # FSRS wrapper (ts-fsrs config)
  notifications.ts      # Local notification scheduling
  share-intent.ts       # Share intent text parsing helpers
/i18n
  index.ts              # useLocale() hook and string resolver
  locales/
    fr.ts               # French UI strings
    en.ts               # English UI strings (fallback + native toggle)
/config
  languages.ts          # Per-language grammar configs, register labels, word boundary mode
/supabase
  /functions
    /ai-proxy
      index.ts          # Edge Function: receives word+sentence+language, calls Gemini
```

---

## Getting Started

```bash
npx create-expo-app@latest memo --template blank-typescript
cd memo
npx expo install expo-sqlite expo-notifications expo-share-intent expo-localization
npm install drizzle-orm ts-fsrs zustand nativewind tailwindcss i18n-js
```

---

## Key Implementation Notes

1. **AI caching**: Before calling the AI, check if a card with the same lemma + same sense already exists. Don't re-call AI for duplicate entries.

2. **FSRS defaults**: Use ts-fsrs with default parameters. The algorithm is well-tuned out of the box. Don't customize until you've used it for 100+ reviews.

3. **Sentence strongly encouraged**: If the user skips the sentence, show a soft warning: "Adding without context — the definition may not match what you meant." Still allow it.

4. **Offline handling**: Wrap the AI call in a try/catch. If offline, save the card with `status: "pending"` — it stores the word + sentence but has empty AI-generated fields. When connectivity returns, query all pending cards and process them through the AI pipeline.

5. **Edge Function security**: Use a simple shared secret (app sends a hardcoded token in the header, Edge Function validates it). Not bulletproof, but fine for a personal app. Don't ship your Gemini API key in the app binary.

6. **Polysemy threshold**: Only show the disambiguation flow if the AI's `is_new_sense` is true. If the AI says it's the same sense as an existing card, just append the sentence to the existing card's `user_sentences_json` silently (with a toast notification).

7. **`sense_id` generation**: The app generates `sense_id`, not the AI. Format: `${lemma}_${n}` where `n` is the next available integer for that lemma (e.g. `louer_1`, `louer_2`). Query existing cards by lemma to determine `n`. This avoids relying on the AI to produce unique, consistent identifiers.

8. **Day streak logic**: Stored in `app_settings` as `current_streak` and `last_review_date` (ISO date string). After completing at least one review, check `last_review_date`: if it's yesterday, increment `current_streak`; if it's today, no change; if it's earlier than yesterday, reset to 1. Update `last_review_date` to today. Day boundary is midnight in the device's local timezone.

9. **TTS via expo-speech**: Uses the device's native TTS engine — no API calls, works offline. Map `target_language` codes to BCP-47 voice identifiers (e.g. `"fr"` → `"fr-FR"`). IPA is kept for visual reference on the card; TTS provides the audible complement. On first launch, check `Speech.getAvailableVoicesAsync()` and prefer a high-quality neural voice for the target language if available. Fall back gracefully — if no voice is installed for the target language, hide the speaker icon rather than playing silence or the wrong accent.

---

## Why SQLite (Not Postgres)

SQLite runs on the device as an embedded database — it's a file on the phone. Postgres runs on a server and requires a network connection. For an offline-first app where the most frequent interaction (reviewing cards) must work without internet, SQLite is the only option.

When sync/multi-device support is added (future), the architecture becomes:
- **SQLite on device**: source of truth for all reads and writes during normal use
- **Postgres on Supabase**: sync target — a background process reconciles the two when online
- The app never reads from Postgres directly during review; it only syncs to it

SQLite handles hundreds of thousands of rows without issues. Even Anki, with 50,000+ card decks, runs on SQLite.

---

## Practice Mode (v2)

### Concept

A separate review mode (distinct from flashcard review) inspired by Barron's 1100 Words exercises. The AI generates a short paragraph (4-6 sentences) that uses 5 vocabulary words from the user's card bank — but with blanks where those words should be. The paragraph provides enough context clues for the user to infer each word without restating definitions.

This is a "Practice" tab alongside the "Review" tab. Flashcards are daily discipline (fast, repetitive, individual words). Practice is a weekly challenge (slower, more engaging, tests deeper comprehension).

### How It Works

1. App selects 5 words from the user's existing cards:
   - 2 words the user is still learning (low FSRS stability)
   - 2 words the user knows well (reinforcement)
   - 1 word that's almost mature (final push)
2. App sends the 5 words + their definitions to the AI backend
3. AI generates a coherent paragraph with blanks and a word bank
4. User reads the paragraph and fills in each blank from the word bank
5. App reveals correct answers, highlights right/wrong
6. Optionally: correct answers reinforce the FSRS schedule, wrong answers trigger a lapse

### AI Prompt Requirements

The prompt must instruct the AI to:
- Write a coherent, natural-sounding paragraph — not 5 disconnected sentences
- Provide context clues that are **inferrable but not obvious** (describe through consequences, associations, and typical usage — never restate the definition)
- Adapt clue difficulty based on provided FSRS stability scores: subtle clues for well-known words, more explicit context for struggling words
- Use appropriate French register and complexity for the user's level
- Weave all 5 words into a single scenario or narrative

### Example

Word bank: mâtin (mastiff), louer (to rent), voler (to fly), éphémère (fleeting), soutenir (to support)

Paragraph:
"The family decided to ____ a house in the countryside for the summer. Their first morning there, they watched a hawk ____ over the fields — a beautiful but ____ moment, gone in seconds. Their neighbor warned them about his enormous ____, a guard dog that weighed more than most children. Despite the occasional scare, the whole family agreed the experience was worth it, and they would ____ anyone who wanted to try country living."

### Design Notes

- Practice mode requires internet (AI generation), unlike flashcard review
- Generated exercises could be cached in SQLite so the user can redo them offline
- The word bank should be displayed as tappable chips, not a typed input (reduce friction)
- Show all 5 words at once so the user can work through them in any order

---

## Vocab Discovery (v3)

### Concept

The app proactively suggests new French words to learn, rather than only capturing words the user encounters. Uses CEFR-leveled frequency lists embedded in the app as a static dataset.

### Data Source

Embed a French frequency list tagged by CEFR level (A1–C2). Candidate sources:
- **FLElex**: French frequency list based on textbook corpora, CEFR-tagged
- **Lexique 3**: Large French lexical database from academic research (free)
- **Kelly list**: Corpus-based frequency list for French (open)

The list should include: lemma, CEFR level, part of speech, frequency rank, and optionally a basic definition. Store as a bundled JSON or SQLite table shipped with the app.

### How It Works

1. User sets their current level (A1–C2) in settings, or the app infers it from their existing cards
2. "Discover" tab shows suggested words at their level that they don't already have cards for
3. User taps a word → AI generates a full card (same pipeline as manual entry, but without a user-provided sentence — AI generates an example sentence)
4. User can browse by CEFR level or by theme (food, travel, work, etc.) if thematic tags are available

### Interaction with Practice Mode

Vocab Discovery can feed into Practice Mode: generate an exercise with 3 known words + 2 new suggested words. The user learns new vocabulary through contextual inference rather than isolated definitions.

---

## Multi-Language Extensibility

### Design Principle

v1 ships with French only, but the architecture avoids hardcoding French assumptions. Adding a new language should require:
1. A new locale map for UI strings (see "App UI Language" below)
2. A language-specific grammar config telling the AI prompt which grammar fields to request
3. Optionally, a CEFR frequency list for Vocab Discovery (v3)

### What is language-agnostic already
- The FSRS algorithm (pure math, no language dependency)
- SQLite schema (`grammar_json` stores any structure, `target_language` field on each card)
- The card creation pipeline (word + sentence → AI → structured JSON → save)
- The review flow (front = sentence with word, back = definition + metadata)
- Polysemy detection (lemma matching works in any language)

### What needs per-language configuration
- **Grammar metadata shape**: French needs `{ gender, verb_auxiliary, is_pronominal }`. German needs `{ gender, case_government, plural }`. Japanese needs `{ reading, pitch_accent, jlpt_level }`. Stored in a language config map that the AI prompt references.
- **Grammar display on cards**: The card back renders grammar info from `grammar_json`. A per-language renderer decides what to show. French: "verbe · avoir". German: "Nomen · n. · Akk.". Japanese: "動詞 · たべる".
- **Word boundary detection in share sheet**: Latin-script languages (French, German, Spanish) can split on spaces. Japanese/Chinese need AI-assisted word segmentation.
- **Register labels for synonyms**: French uses "familier / courant / soutenu". Other languages have their own register systems.
- **TTS voice selection**: Each language needs a BCP-47 locale mapping and optionally a preferred voice ID. French → `"fr-FR"`, German → `"de-DE"`, Japanese → `"ja-JP"`. Some languages have regional variants (e.g. `"fr-CA"`) that could be exposed in settings later.

### Language Config Example

```typescript
const LANGUAGE_CONFIGS: Record<string, LanguageConfig> = {
  fr: {
    name: "French",
    nativeName: "Français",
    grammarFields: ["gender", "verb_auxiliary", "is_pronominal"],
    registerLabels: ["familier", "courant", "soutenu"],
    hasGenderedNouns: true,
    wordBoundary: "space",
    ttsLocale: "fr-FR",
  },
  de: {
    name: "German",
    nativeName: "Deutsch",
    grammarFields: ["gender", "case_government", "plural_form"],
    registerLabels: ["umgangssprachlich", "standardsprachlich", "gehoben"],
    hasGenderedNouns: true,
    wordBoundary: "space",
    ttsLocale: "de-DE",
  },
  ja: {
    name: "Japanese",
    nativeName: "日本語",
    grammarFields: ["reading", "pitch_accent", "jlpt_level"],
    registerLabels: ["casual", "polite", "formal"],
    hasGenderedNouns: false,
    wordBoundary: "ai_segmentation",
    ttsLocale: "ja-JP",
  },
};
```

---

## App UI Language

### Principle

The app UI is displayed in the target language by default to maximize immersion. Navigation, labels, prompts, and messages are all in the language the user is learning. The "Show English by default" toggle in settings switches both:
- Card back: native-language translation visible by default
- App UI: all labels switch to the user's native language

### Implementation

Use a locale map keyed by language code. The app reads `target_language` from settings and loads the corresponding map. If "show native by default" is on, it loads the native language map instead.

```typescript
const UI_STRINGS: Record<string, Record<string, string>> = {
  fr: {
    home_greeting: "Bonjour!",
    add_word: "Ajouter un mot",
    review: "Réviser",
    settings: "Paramètres",
    tap_to_reveal: "Appuyez pour révéler",
    card_created: "Carte créée",
    definition: "Définition",
    synonyms: "Synonymes",
    antonym: "Antonyme",
    show_translation: "Afficher la traduction",
    cards_due_today: "Cartes à réviser",
    start_review: "Commencer",
    add_another: "Ajouter un autre mot",
    go_home: "Accueil",
    where_did_you_see_it: "Où l'avez-vous vu?",
    tap_word_to_learn: "Appuyez sur le mot à apprendre",
    well_done: "Bien joué!",
    review_complete: "Révision terminée",
    my_words: "Mes mots",
    search_words: "Chercher un mot...",
    select: "Sélectionner",
    // ... etc
  },
  en: {
    home_greeting: "Hello!",
    add_word: "Add a word",
    review: "Review",
    settings: "Settings",
    tap_to_reveal: "Tap card to reveal",
    card_created: "Card created",
    definition: "Definition",
    synonyms: "Synonyms",
    antonym: "Antonym",
    show_translation: "Show translation",
    cards_due_today: "Cards due today",
    start_review: "Start review",
    add_another: "Add another word",
    go_home: "Go home",
    where_did_you_see_it: "Where did you see it?",
    tap_word_to_learn: "Tap the word to learn",
    well_done: "Well done!",
    review_complete: "Review complete",
    my_words: "My words",
    search_words: "Search words...",
    select: "Select",
    // ... etc
  },
  // Add more languages as needed
};
```

### Usage in components

```typescript
// Helper hook
function useLocale() {
  const { targetLanguage, showNativeByDefault } = useSettings();
  const lang = showNativeByDefault ? "en" : targetLanguage;
  return (key: string) => UI_STRINGS[lang]?.[key] ?? UI_STRINGS["en"][key];
}

// In a component
const t = useLocale();
<Text>{t("add_word")}</Text>  // "Ajouter un mot" or "Add a word"
```
