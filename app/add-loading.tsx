import { useEffect } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocale } from "../i18n";
import { useSettingsStore } from "../stores/settings";
import { useAddFlowStore } from "../stores/addFlow";
import { submitWord, saveCardFromAI } from "../lib/addHelpers";
import { RateLimitError } from "../lib/ai";
import { LoadingOverlay } from "../components/LoadingOverlay";

export default function AddLoadingScreen() {
  const t = useLocale();
  const router = useRouter();
  const targetLanguage = useSettingsStore((s) => s.targetLanguage);
  const nativeLanguage = useSettingsStore((s) => s.nativeLanguage);
  const { word, sentence, setResult, reset } = useAddFlowStore();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const trimmedSentence = sentence || undefined;
        const result = await submitWord({
          word,
          sentence: trimmedSentence,
          targetLanguage,
          nativeLanguage,
        });

        if (cancelled) return;

        switch (result.status) {
          case "created": {
            saveCardFromAI(result.response, trimmedSentence, targetLanguage);
            setResult(result.response);
            router.replace("/add-success");
            break;
          }
          case "new_sense": {
            setResult(result.response, result.existingSenseIds);
            router.replace("/add-disambiguate");
            break;
          }
          case "duplicate": {
            Alert.alert(t("card_created"), t("duplicate_word_message"));
            reset();
            router.back();
            break;
          }
          case "pending": {
            Alert.alert(t("card_created"), t("saved_as_pending"));
            reset();
            router.back();
            break;
          }
        }
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof RateLimitError
            ? t("error_rate_limit")
            : t("error_generic");
        Alert.alert(t("error_generic"), message);
        router.back();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      <LoadingOverlay
        word={word}
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
