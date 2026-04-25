import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import { type AICardResponse } from "../lib/ai";
import { type TranslateFn } from "../i18n";
import { RevealableText } from "./RevealableText";
import { TTS_LOCALES } from "../lib/tts";

interface CardPreviewProps {
  card: AICardResponse;
  targetLanguage: string;
  translate: TranslateFn;
}

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
      <View className="flex-row items-center gap-3 flex-wrap">
        <Text className="text-[36px] font-light text-memo-ink">{card.lemma}</Text>
        <Text className="text-[13px] text-memo-ink-muted font-mono tracking-wider">
          {card.pronunciation_ipa}
        </Text>
        <Pressable
          className="ml-auto h-8 w-8 items-center justify-center rounded-full bg-memo-surface-alt"
          onPress={speak}
          hitSlop={8}
        >
          <Ionicons name="volume-medium-outline" size={16} color="#454A55" />
        </Pressable>
      </View>

      {/* Part of speech */}
      <Text className="mt-1 text-[12px] font-medium uppercase tracking-widest text-memo-ink-muted">
        {card.part_of_speech}
        {card.encountered_form !== card.lemma &&
          ` · ${card.encountered_form}`}
      </Text>

      {/* Target-language definition */}
      <Text className="mt-5 text-[22px] font-light leading-7 text-memo-ink">
        {card.primary_definition_target}
      </Text>

      {/* Native translation — hidden behind tap */}
      <RevealableText
        hiddenLabel={t("show_native_translation")}
        revealedLabel={t("hide_native_translation")}
        content={card.primary_definition_native}
      />

      {/* Example sentence */}
      {card.example_sentence && (
        <View className="mt-5 rounded-[14px] bg-memo-bg px-[18px] py-4">
          <Text className="text-[17px] italic leading-6 text-memo-ink-soft">
            {card.example_sentence}
          </Text>
        </View>
      )}

      {/* Synonyms + Antonym */}
      <View className="mt-[18px] flex-row flex-wrap gap-2.5">
        {card.synonyms.slice(0, 2).map((s) => (
          <View
            key={s.word}
            className="rounded-lg bg-memo-success-soft px-3 py-1.5"
          >
            <Text className="text-[12px] font-medium text-memo-success">
              ≈ {s.word}
            </Text>
          </View>
        ))}
        {card.antonym && (
          <View className="rounded-lg bg-memo-accent-soft px-3 py-1.5">
            <Text className="text-[12px] font-medium text-memo-accent">
              ≠ {card.antonym.word}
            </Text>
          </View>
        )}
      </View>

      {/* Polysemy info */}
      {card.total_common_meanings > 1 && (
        <View className="mt-4 flex-row items-center gap-2 border-t border-memo-line pt-4">
          <Ionicons name="information-circle-outline" size={16} color="#3B6FE5" />
          <Text className="text-[13px] font-medium text-memo-accent">
            {card.total_common_meanings - 1} other meaning
            {card.total_common_meanings > 2 ? "s" : ""} · tap to expand
          </Text>
        </View>
      )}
    </View>
  );
}
