import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Button } from "../../components/Button";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import * as Crypto from "expo-crypto";
import { Ionicons } from "@expo/vector-icons";
import { useLocale } from "../../i18n";
import { useSettingsStore } from "../../stores/settings";
import { db } from "../../db/client";
import { createCard } from "../../db/queries";
import {
  addWord,
  type AICardResponse,
  type AddWordResult,
  RateLimitError,
  nextSenseId,
} from "../../lib/ai";
import { nowUnix } from "../../db/types";
import { LoadingOverlay } from "../../components/LoadingOverlay";
import { CardPreview } from "../../components/CardPreview";
import { SoftWarning } from "../../components/SoftWarning";
import { MeaningCard } from "../../components/MeaningCard";
import { PolysemyBanner } from "../../components/PolysemyBanner";
import { getCardById, getCardsByLemma, addUserSentence } from "../../db/queries";

// ── Mock AI (remove when backend is live) ───────────────────────────────────

const USE_MOCK_AI = true;

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

async function mockAddWord(params: {
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

// ── Helpers ─────────────────────────────────────────────────────────────────

type Phase = "form" | "loading" | "success" | "error" | "disambiguate";
type SubmitWarning = null | "no_sentence" | "word_not_in_sentence";

const TARGET_LANG_PATTERNS: Record<string, RegExp> = {
  fr: /[àâæçéèêëïîôœùûüÿ]/i,
  de: /[äöüß]/i,
  es: /[áéíóúñ¿¡]/i,
  ja: /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/,
};

function looksLikeTargetLanguage(text: string, lang: string): boolean {
  const pattern = TARGET_LANG_PATTERNS[lang];
  if (pattern) return pattern.test(text);
  return text.trim().length > 0;
}

/** Strip diacritics and lowercase for accent-insensitive comparison. */
function normalise(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function saveCardFromAI(
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

// ── Component ───────────────────────────────────────────────────────────────

export default function AddScreen() {
  const t = useLocale();
  const targetLanguage = useSettingsStore((s) => s.targetLanguage);
  const nativeLanguage = useSettingsStore((s) => s.nativeLanguage);

  const [word, setWord] = useState("");
  const [sentence, setSentence] = useState("");
  const [clipboardText, setClipboardText] = useState<string | null>(null);
  const [submitWarning, setSubmitWarning] = useState<SubmitWarning>(null);
  const sentenceInputRef = useRef<TextInput>(null);

  const [phase, setPhase] = useState<Phase>("form");
  const [aiResult, setAiResult] = useState<AICardResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [existingSenseIds, setExistingSenseIds] = useState<string[]>([]);

  // Avoid clipboard privacy banner on iOS by checking hasStringAsync first
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const hasString = await Clipboard.hasStringAsync();
          if (!hasString || cancelled) return;
          const text = await Clipboard.getStringAsync();
          if (
            !cancelled &&
            text.trim().length > 0 &&
            looksLikeTargetLanguage(text, targetLanguage)
          ) {
            setClipboardText(text.trim());
          } else {
            setClipboardText(null);
          }
        } catch {
          setClipboardText(null);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [targetLanguage]),
  );

  useEffect(() => {
    if (word.length > 0) setClipboardText(null);
  }, [word]);

  const applyClipboard = () => {
    if (!clipboardText) return;
    const words = clipboardText.split(/\s+/);
    if (words.length === 1) {
      setWord(clipboardText);
    } else {
      setSentence(clipboardText);
    }
    setClipboardText(null);
  };

  const resetForm = () => {
    setWord("");
    setSentence("");
    setPhase("form");
    setAiResult(null);
    setErrorMessage("");
    setSubmitWarning(null);
    setExistingSenseIds([]);
  };

  const handleSubmit = async () => {
    const trimmedWord = word.trim();
    if (!trimmedWord) return;

    const trimmedSentence = sentence.trim();

    if (!trimmedSentence && submitWarning !== "no_sentence") {
      setSubmitWarning("no_sentence");
      return;
    }

    if (trimmedSentence && submitWarning !== "word_not_in_sentence") {
      if (!normalise(trimmedSentence).includes(normalise(trimmedWord))) {
        setSubmitWarning("word_not_in_sentence");
        return;
      }
    }

    Keyboard.dismiss();
    setPhase("loading");
    setErrorMessage("");

    try {
      const result: AddWordResult = USE_MOCK_AI
        ? await mockAddWord({
            word: trimmedWord,
            sentence: trimmedSentence || undefined,
          })
        : await addWord(db, {
            word: trimmedWord,
            sentence: trimmedSentence || undefined,
            targetLanguage,
            nativeLanguage,
          });

      switch (result.status) {
        case "created": {
          saveCardFromAI(
            result.response,
            trimmedSentence || undefined,
            targetLanguage,
          );
          setAiResult(result.response);
          setPhase("success");
          break;
        }
        case "new_sense": {
          setAiResult(result.response);
          setExistingSenseIds(result.existingSenseIds);
          setPhase("disambiguate");
          break;
        }
        case "duplicate": {
          Alert.alert(t("card_created"), t("duplicate_word_message"));
          resetForm();
          break;
        }
        case "pending": {
          Alert.alert(t("card_created"), t("saved_as_pending"));
          resetForm();
          break;
        }
      }
    } catch (error) {
      if (error instanceof RateLimitError) {
        setErrorMessage(t("error_rate_limit"));
      } else {
        setErrorMessage(t("error_generic"));
      }
      setPhase("error");
    }
  };

  // ── Loading phase (Screen 4) ──────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
        <LoadingOverlay
          word={word.trim()}
          steps={[
            t("loading_identifying"),
            t("loading_definition"),
            t("loading_synonyms"),
            t("loading_polysemy"),
          ]}
        />
      </SafeAreaView>
    );
  }

  // ── Disambiguate phase (Screen 6) ──────────────────────────────────────────
  if (phase === "disambiguate" && aiResult) {
    const trimmedSentence = sentence.trim() || undefined;
    const existingCards = existingSenseIds
      .map((id) => getCardById(db, id))
      .filter(Boolean) as NonNullable<ReturnType<typeof getCardById>>[];

    const handleAddAsNewCard = () => {
      saveCardFromAI(aiResult, trimmedSentence, targetLanguage);
      setPhase("success");
    };

    const handleSameMeaning = () => {
      if (existingCards.length > 0 && trimmedSentence) {
        addUserSentence(db, existingCards[0].id, trimmedSentence);
      }
      resetForm();
      Alert.alert(t("card_created"), t("duplicate_word_message"));
    };

    return (
      <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
        <ScrollView
          contentContainerClassName="px-5 pb-8 pt-6"
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-5 flex-row items-center gap-3">
            <Button variant="ghost" className="bg-transparent py-0" onPress={resetForm}>
              <Ionicons name="arrow-back" size={24} color="#111827" />
            </Button>
            <Text className="flex-1 text-xl font-bold text-gray-900">
              {t("new_meaning_detected")}
            </Text>
          </View>

          <PolysemyBanner
            lemma={aiResult.lemma}
            existingCount={existingCards.length}
            totalCommonMeanings={aiResult.total_common_meanings}
            translate={t}
          />

          {existingCards.length > 0 && (
            <View className="mt-6">
              <Text className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                {t("existing_meanings")}
              </Text>
              <View className="gap-3">
                {existingCards.map((card, index) => {
                  let sentences: string[] = [];
                  try { sentences = JSON.parse(card.userSentencesJson); } catch {}

                  return (
                    <MeaningCard
                      key={card.id}
                      variant="existing"
                      label={`${t("definition")} ${index + 1}`}
                      definitionTarget={card.primaryDefinitionTarget}
                      definitionNative={card.primaryDefinitionNative}
                      sentence={sentences[0]}
                      translate={t}
                    />
                  );
                })}
              </View>
            </View>
          )}

          <View className="mt-6">
            <Text className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {t("new_meaning_detected")}
            </Text>
            <MeaningCard
              variant="new"
              definitionTarget={aiResult.primary_definition_target}
              definitionNative={aiResult.primary_definition_native}
              sentence={trimmedSentence ?? aiResult.example_sentence}
              translate={t}
            />
          </View>

          <View className="mt-8 gap-3">
            <Button label={t("add_as_new_card")} onPress={handleAddAsNewCard} />
            <Button
              label={t("same_meaning_add_sentence")}
              variant="secondary"
              onPress={handleSameMeaning}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Success phase (Screen 5) ──────────────────────────────────────────────
  if (phase === "success" && aiResult) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
        <ScrollView
          contentContainerClassName="px-5 pb-8 pt-6"
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-6 items-center">
            <View className="mb-3 h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <Ionicons name="checkmark-circle" size={32} color="#22c55e" />
            </View>
            <Text className="text-xl font-bold text-gray-900">
              {t("card_created")}
            </Text>
          </View>

          <View className="rounded-2xl bg-white p-5 shadow-sm">
            <CardPreview
              card={aiResult}
              targetLanguage={targetLanguage}
              translate={t}
            />
          </View>

          <View className="mt-6 gap-3">
            <Button label={t("add_another")} onPress={resetForm} />
            <Button
              label={t("go_home")}
              variant="ghost"
              onPress={resetForm}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Error phase ───────────────────────────────────────────────────────────
  if (phase === "error") {
    return (
      <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
        <View className="flex-1 items-center justify-center px-8">
          <View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-red-100">
            <Ionicons name="alert-circle" size={32} color="#ef4444" />
          </View>
          <Text className="mb-2 text-center text-base text-gray-900">
            {errorMessage}
          </Text>
          <View className="mt-4 w-full gap-3">
            <Button
              label={t("retry")}
              onPress={() => {
                setPhase("form");
                setErrorMessage("");
              }}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Form phase (Screen 2) ─────────────────────────────────────────────────
  const hasWord = word.trim().length > 0;

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerClassName="flex-grow px-5 pb-8 pt-6"
          keyboardShouldPersistTaps="handled"
        >
          <Text className="mb-6 text-2xl font-bold text-gray-900">
            {t("add_word")}
          </Text>

          {clipboardText && (
            <Button
              variant="ghost"
              className="mb-4 flex-row items-center gap-3 bg-blue-50 px-4 py-3"
              onPress={applyClipboard}
            >
              <Ionicons name="clipboard-outline" size={20} color="#2563eb" />
              <View className="flex-1">
                <Text className="text-sm font-medium text-blue-700">
                  {t("clipboard_suggestion")}
                </Text>
                <Text
                  className="mt-0.5 text-sm text-blue-500"
                  numberOfLines={1}
                >
                  {clipboardText}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#2563eb" />
            </Button>
          )}

          <View className="mb-4">
            <Text className="mb-1.5 text-sm font-medium text-gray-700">
              {t("word_label")}
            </Text>
            <TextInput
              className="rounded-xl bg-white px-4 py-3.5 text-base text-gray-900"
              placeholder={t("word_placeholder")}
              placeholderTextColor="#9ca3af"
              value={word}
              onChangeText={(text) => {
                setWord(text);
                setSubmitWarning(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => sentenceInputRef.current?.focus()}
            />
          </View>

          <View className="mb-4">
            <Text className="mb-1.5 text-sm font-medium text-gray-700">
              {t("sentence_label")}
            </Text>
            <Text className="mb-1.5 text-xs text-gray-400">
              {t("where_did_you_see_it")}
            </Text>
            <TextInput
              ref={sentenceInputRef}
              className="min-h-[80px] rounded-xl bg-white px-4 py-3.5 text-base text-gray-900"
              placeholder="ex : Je vais au marché."
              placeholderTextColor="#9ca3af"
              value={sentence}
              onChangeText={(text) => {
                setSentence(text);
                setSubmitWarning(null);
              }}
              multiline
              textAlignVertical="top"
              autoCapitalize="sentences"
              autoCorrect={false}
            />
          </View>

          {submitWarning === "no_sentence" && !sentence.trim() && (
            <SoftWarning message={t("no_sentence_warning")} />
          )}

          {submitWarning === "word_not_in_sentence" && (
            <SoftWarning message={t("word_not_in_sentence")} />
          )}

          <Button
            className="mt-2"
            label={submitWarning ? t("add_button") + " \u2192" : t("add_button")}
            onPress={handleSubmit}
            disabled={!hasWord}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
