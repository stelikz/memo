import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import { Button } from "./Button";
import { type AICardResponse } from "../lib/ai";
import { type TranslateFn } from "../i18n";
import { RevealableText } from "./RevealableText";

interface CardPreviewProps {
  card: AICardResponse;
  targetLanguage: string;
  translate: TranslateFn;
}

const TTS_LOCALES: Record<string, string> = {
  fr: "fr-FR",
  de: "de-DE",
  es: "es-ES",
  ja: "ja-JP",
};

export function CardPreview({
  card,
  targetLanguage,
  translate: t,
}: CardPreviewProps) {
  const speak = () => {
    Speech.speak(card.lemma, {
      language: TTS_LOCALES[targetLanguage] ?? targetLanguage,
    });
  };

  return (
    <View className="w-full">
      {/* Lemma + pronunciation + TTS */}
      <View className="flex-row items-center gap-3">
        <Text className="text-2xl font-bold text-gray-900">{card.lemma}</Text>
        <Text className="text-sm text-gray-400">{card.pronunciation_ipa}</Text>
        <Button variant="ghost" className="bg-transparent py-0" onPress={speak} hitSlop={8}>
          <Ionicons name="volume-medium-outline" size={22} color="#2563eb" />
        </Button>
      </View>

      {/* Part of speech + encountered form */}
      <Text className="mt-1 text-sm text-gray-500">
        {card.part_of_speech}
        {card.encountered_form !== card.lemma &&
          ` \u00B7 ${card.encountered_form}`}
      </Text>

      {/* Target-language definition */}
      <Text className="mt-4 text-base leading-6 text-gray-900">
        {card.primary_definition_target}
      </Text>

      {/* Native translation — hidden behind tap */}
      <RevealableText
        hiddenLabel={t("show_native_translation")}
        revealedLabel={t("hide_native_translation")}
        content={card.primary_definition_native}
      />

      {/* Synonyms */}
      {card.synonyms.length > 0 && (
        <View className="mt-4">
          <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
            {t("synonyms")}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {card.synonyms.map((s) => (
              <View key={s.word} className="rounded-full bg-blue-50 px-3 py-1">
                <Text className="text-sm text-blue-700">
                  {s.word}
                  {s.register ? ` (${s.register})` : ""}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Antonym */}
      {card.antonym && (
        <View className="mt-3">
          <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
            {t("antonym")}
          </Text>
          <View className="self-start rounded-full bg-red-50 px-3 py-1">
            <Text className="text-sm text-red-700">{card.antonym.word}</Text>
          </View>
        </View>
      )}

      {/* Polysemy info */}
      {card.total_common_meanings > 1 && (
        <View className="mt-4 rounded-xl bg-amber-50 px-4 py-3">
          <Text className="text-sm text-amber-800">
            {t("also_means")} — {card.total_common_meanings}{" "}
            {t("other_meanings_count")}
          </Text>
        </View>
      )}
    </View>
  );
}
