import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocale } from "../i18n";
import { useSettingsStore } from "../stores/settings";
import { db } from "../db/client";
import { getCardById } from "../db/queries";
import { CardPreview } from "../components/CardPreview";
import type { AICardResponse } from "../lib/ai";

export default function CardDetailScreen() {
  const t = useLocale();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const targetLanguage = useSettingsStore((s) => s.targetLanguage);
  const [showOtherMeanings, setShowOtherMeanings] = useState(false);

  const card = id ? getCardById(db, id) : undefined;

  if (!card) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center bg-memo-bg"
        edges={["top"]}
      >
        <Text className="text-memo-ink-muted">Card not found</Text>
      </SafeAreaView>
    );
  }

  const otherMeanings: Array<{
    definition_target: string;
    definition_native: string;
    example_sentence: string;
  }> = JSON.parse(card.otherMeaningsJson);

  const previewCard: AICardResponse = {
    lemma: card.lemma,
    encountered_form: card.encounteredForm,
    part_of_speech: card.partOfSpeech,
    pronunciation_ipa: card.pronunciationIpa,
    grammar: JSON.parse(card.grammarJson),
    primary_definition_target: card.primaryDefinitionTarget,
    primary_definition_native: card.primaryDefinitionNative,
    example_sentence: card.exampleSentence,
    corrected_sentence: null,
    total_common_meanings: card.totalCommonMeanings,
    is_new_sense: null,
    other_meanings: otherMeanings,
    synonyms: JSON.parse(card.synonymsJson),
    antonym: card.antonym ? { word: card.antonym } : null,
    irregular_forms: card.irregularForms ?? null,
  };

  // Progress label
  const progressPct = Math.round(
    (card.state === 3 ? 1 : card.state === 1 || card.state === 2 ? 0.5 : 0) *
      100,
  );

  return (
    <SafeAreaView className="flex-1 bg-memo-bg" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center gap-3 px-[18px] pb-2 pt-1">
        <Pressable
          className="h-9 w-9 items-center justify-center rounded-full border border-memo-line bg-memo-surface"
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={18} color="#15181F" />
        </Pressable>
        <View className="flex-1" />
      </View>

      <ScrollView contentContainerClassName="px-[18px] pb-10">
        {/* Memorisation bar */}
        <View className="mb-1 px-1.5 pt-3">
          <View className="flex-row items-center justify-between mb-1.5">
            <Text className="text-[12px] font-medium uppercase tracking-widest text-memo-ink-muted">
              {t("review_stats")}
            </Text>
            <Text className="text-[12px] text-memo-ink-soft font-mono">
              {progressPct}%
            </Text>
          </View>
          <View className="h-[5px] overflow-hidden rounded-full bg-memo-line">
            <View
              className="h-full rounded-full bg-memo-accent"
              style={{ width: `${progressPct}%` }}
            />
          </View>
        </View>

        {/* Card */}
        <View
          className="mt-5 rounded-3xl border border-memo-line bg-memo-surface p-7"
          style={{
            shadowColor: "#1F1B14",
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.07,
            shadowRadius: 32,
            elevation: 4,
          }}
        >
          <CardPreview
            card={previewCard}
            targetLanguage={targetLanguage}
            translate={t}
          />
        </View>

        {/* Other meanings — collapsible */}
        {otherMeanings.length > 1 && (
          <View className="mt-6">
            <Pressable
              className="flex-row items-center justify-between pb-3"
              onPress={() => setShowOtherMeanings((s) => !s)}
            >
              <Text className="text-[13px] font-semibold uppercase tracking-widest text-memo-ink-muted">
                {t("also_means")} · {otherMeanings.length}
              </Text>
              <View className="flex-row items-center gap-1">
                <Text className="text-[12px] font-medium text-memo-accent">
                  {showOtherMeanings ? "Hide" : "Show"}
                </Text>
                <Ionicons
                  name={showOtherMeanings ? "chevron-up" : "chevron-down"}
                  size={14}
                  color="#3B6FE5"
                />
              </View>
            </Pressable>

            {showOtherMeanings && (
              <View className="gap-2.5">
                {otherMeanings.map((m, i) => (
                  <View
                    key={i}
                    className="flex-row items-start gap-3 rounded-[14px] border border-memo-line bg-memo-surface px-4 py-3.5"
                  >
                    <View className="mt-0.5 h-[22px] w-[22px] items-center justify-center rounded-full bg-memo-accent-soft">
                      <Text className="text-[11px] font-semibold text-memo-accent font-mono">
                        {i + 1}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-[17px] font-light leading-snug text-memo-ink">
                        {m.definition_target}
                      </Text>
                      {m.example_sentence && (
                        <Text className="mt-1.5 text-sm italic leading-relaxed text-memo-ink-soft">
                          {m.example_sentence}
                        </Text>
                      )}
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color="#8A8F9A"
                      style={{ marginTop: 2 }}
                    />
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
