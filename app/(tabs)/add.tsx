import { useCallback, useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Button } from "../../components/Button";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { useLocale } from "../../i18n";
import { useSettingsStore } from "../../stores/settings";
import { useAddFlowStore } from "../../stores/addFlow";
import { SoftWarning } from "../../components/SoftWarning";

// ── Helpers ─────────────────────────────────────────────────────────────────

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

// ── Component ───────────────────────────────────────────────────────────────

export default function AddScreen() {
  const t = useLocale();
  const router = useRouter();
  const targetLanguage = useSettingsStore((s) => s.targetLanguage);
  const setInput = useAddFlowStore((s) => s.setInput);

  const [word, setWord] = useState("");
  const [sentence, setSentence] = useState("");
  const [clipboardText, setClipboardText] = useState<string | null>(null);
  const [submitWarning, setSubmitWarning] = useState<SubmitWarning>(null);
  const sentenceInputRef = useRef<TextInput>(null);

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

  const handleSubmit = () => {
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
    setInput(trimmedWord, trimmedSentence);
    setWord("");
    setSentence("");
    setSubmitWarning(null);
    router.push("/add-loading");
  };

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
