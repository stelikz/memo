import { useCallback, useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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

import { normalizeAccents as normalise } from "../../lib/normalize";

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
    <SafeAreaView className="flex-1 bg-memo-bg" edges={["top"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerClassName="flex-grow px-6 pb-8 pt-2"
          keyboardShouldPersistTaps="handled"
        >
          <Text className="text-[36px] font-light text-memo-ink">
            {t("add_word")}
          </Text>
          <Text className="mt-1.5 mb-7 text-sm leading-relaxed text-memo-ink-soft">
            {t("where_did_you_see_it")}
          </Text>

          {clipboardText && (
            <Pressable
              className="mb-4 flex-row items-center gap-3 rounded-2xl bg-memo-accent-soft px-4 py-3"
              onPress={applyClipboard}
            >
              <Ionicons name="clipboard-outline" size={20} color="#3B6FE5" />
              <View className="flex-1">
                <Text className="text-sm font-medium text-memo-accent">
                  {t("clipboard_suggestion")}
                </Text>
                <Text
                  className="mt-0.5 text-sm text-memo-accent/70"
                  numberOfLines={1}
                >
                  {clipboardText}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#3B6FE5" />
            </Pressable>
          )}

          {/* Word field */}
          <View className="mb-5 rounded-2xl border border-memo-line bg-memo-surface px-[18px] py-3.5">
            <Text className="mb-1.5 text-[11px] font-medium uppercase tracking-widest text-memo-ink-muted">
              {t("word_label")}
            </Text>
            <TextInput
              className="text-[28px] font-light text-memo-ink"
              placeholder={t("word_placeholder")}
              placeholderTextColor="#8A8F9A"
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

          {/* Sentence field */}
          <View
            className={`mb-5 rounded-2xl border bg-memo-surface px-[18px] py-3.5 ${
              submitWarning === "word_not_in_sentence"
                ? "border-memo-danger"
                : "border-memo-line"
            }`}
          >
            <Text
              className={`mb-1.5 text-[11px] font-medium uppercase tracking-widest ${
                submitWarning === "word_not_in_sentence"
                  ? "text-memo-danger"
                  : "text-memo-ink-muted"
              }`}
            >
              {submitWarning === "word_not_in_sentence"
                ? `${t("sentence_label")} — ${t("word_not_in_sentence")}`
                : `${t("sentence_label")} (optional)`}
            </Text>
            <TextInput
              ref={sentenceInputRef}
              className="min-h-[60px] text-[15px] leading-relaxed text-memo-ink"
              placeholder="Where did you encounter it? Helps find the right meaning."
              placeholderTextColor="#8A8F9A"
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

          <Button
            onPress={handleSubmit}
            disabled={!hasWord}
          >
            <View className="flex-row items-center gap-2">
              <Ionicons name="sparkles" size={16} color={hasWord ? "#F6F6F4" : "#8A8F9A"} />
              <Text className={`text-base font-semibold ${hasWord ? "text-white" : "text-memo-ink-muted"}`}>
                {submitWarning ? t("add_button") + " →" : t("add_button")}
              </Text>
            </View>
          </Button>

          {/* OR divider */}
          <View className="my-6 flex-row items-center gap-3">
            <View className="flex-1 h-[0.5px] bg-memo-line" />
            <Text className="text-[11px] uppercase tracking-widest text-memo-ink-muted">
              Or
            </Text>
            <View className="flex-1 h-[0.5px] bg-memo-line" />
          </View>

          {/* Camera CTA */}
          <Pressable className="flex-row items-center gap-3.5 rounded-2xl border border-dashed border-memo-line-strong bg-memo-surface px-5 py-5">
            <View className="h-11 w-11 items-center justify-center rounded-full bg-memo-surface-alt">
              <Ionicons name="camera-outline" size={22} color="#15181F" />
            </View>
            <View className="flex-1">
              <Text className="text-[15px] font-medium text-memo-ink">
                Capture from a photo
              </Text>
              <Text className="mt-0.5 text-[13px] text-memo-ink-soft">
                Snap a page or a sign — we'll pick out words.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#8A8F9A" />
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
