import { useEffect, useState, useCallback } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocale } from "../../i18n";
import { useSettingsStore } from "../../stores/settings";
import { db } from "../../db/client";
import { countAllCards, countDueCards, getRecentCards } from "../../db/queries";
import { SectionHeader } from "../../components/SectionHeader";
import { WordListItem } from "../../components/WordListItem";
import { EmptyState } from "../../components/EmptyState";

function ItemSeparator() {
  return <View className="h-2.5" />;
}

export default function HomeScreen() {
  const t = useLocale();
  const router = useRouter();
  const hydrate = useSettingsStore((s) => s.hydrate);
  const currentStreak = useSettingsStore((s) => s.currentStreak);
  const dailyReviewLimit = useSettingsStore((s) => s.dailyReviewLimit);

  const [totalCards, setTotalCards] = useState(0);
  const [dueCount, setDueCount] = useState(0);
  const [recentCards, setRecentCards] = useState<
    ReturnType<typeof getRecentCards>
  >([]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useFocusEffect(
    useCallback(() => {
      setTotalCards(countAllCards(db));
      const due = countDueCards(db);
      setDueCount(dailyReviewLimit > 0 ? Math.min(due, dailyReviewLimit) : due);
      setRecentCards(getRecentCards(db));
    }, [dailyReviewLimit]),
  );

  return (
    <SafeAreaView className="flex-1 bg-memo-bg" edges={["top"]}>
      <FlatList
        data={recentCards}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-6 pb-8"
        ItemSeparatorComponent={ItemSeparator}
        ListHeaderComponent={
          <>
            {/* Greeting */}
            <Text className="mb-1 mt-2 text-[13px] font-medium uppercase tracking-widest text-memo-ink-muted">
              {t("home_subtitle")}
            </Text>
            <Text className="mb-7 text-[38px] font-light leading-tight text-memo-ink">
              {t("home_greeting")}
            </Text>

            {/* Streak + Library cards row */}
            <View className="mb-3 flex-row gap-3">
              {/* Streak card */}
              <View className="flex-1 rounded-[22px] border border-memo-line bg-memo-surface p-5">
                <View className="flex-row items-center gap-1.5">
                  <Ionicons name="flame" size={14} color="#E0573A" />
                  <Text className="text-[11px] font-medium uppercase tracking-widest text-memo-ink-muted">
                    {t("day_streak")}
                  </Text>
                </View>
                <Text className="mt-3 text-[48px] font-light leading-none text-memo-ink">
                  {currentStreak}
                </Text>
                <Text className="mt-1 text-[13px] text-memo-ink-muted">
                  {t("days_in_a_row")}
                </Text>
              </View>

              {/* Library card */}
              <Pressable
                className="flex-1 rounded-[22px] border border-memo-line bg-memo-surface p-5"
                onPress={
                  totalCards > 0
                    ? () => router.push("/library" as any)
                    : undefined
                }
              >
                <View className="flex-row items-center gap-1.5">
                  <Ionicons name="layers-outline" size={14} color="#8A8F9A" />
                  <Text className="text-[11px] font-medium uppercase tracking-widest text-memo-ink-muted">
                    {t("total_cards")}
                  </Text>
                </View>
                <Text className="mt-3 text-[48px] font-light leading-none text-memo-ink">
                  {totalCards}
                </Text>
                <Text className="mt-1 text-[13px] text-memo-ink-muted">
                  {t("view_all")}
                </Text>
              </Pressable>
            </View>

            {/* Review CTA */}
            <Pressable
              className="mb-8 rounded-[22px] bg-memo-accent p-6"
              onPress={
                dueCount > 0 ? () => router.push("/review" as any) : undefined
              }
            >
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <Text className="mb-1.5 text-[12px] font-medium uppercase tracking-widest text-white/85">
                    {t("cards_due_today")}
                  </Text>
                  <Text className="text-[40px] font-light leading-tight text-white">
                    {dueCount} {t("cards_lowercase")}
                  </Text>
                  <Text className="mt-2.5 text-[13px] text-white/85">
                    ~{Math.ceil(dueCount * 0.8)} min · {t("tap_to_start")}
                  </Text>
                </View>
                <View className="h-11 w-11 items-center justify-center rounded-full bg-white/20">
                  <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                </View>
              </View>
              {/* Progress bar */}
              <View className="mt-4 h-[3px] overflow-hidden rounded-full bg-white/25">
                <View className="h-full rounded-full bg-white" style={{ width: "0%" }} />
              </View>
            </Pressable>

            {/* Recently added header */}
            <SectionHeader
              title={t("recently_added")}
              right={
                totalCards > 0 ? (
                  <Pressable onPress={() => router.push("/library" as any)}>
                    <Text className="text-[13px] text-memo-ink-soft">
                      {t("see_all")}
                    </Text>
                  </Pressable>
                ) : undefined
              }
            />
          </>
        }
        renderItem={({ item }) => (
          <WordListItem
            lemma={item.lemma}
            partOfSpeech={item.partOfSpeech}
            definition={item.primaryDefinitionTarget}
            state={item.state}
            isSuspended={item.isSuspended}
            totalCommonMeanings={item.totalCommonMeanings}
            otherMeaningsJson={item.otherMeaningsJson}
            onPress={() => router.push(`/card-detail?id=${item.id}` as any)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="book-outline"
            title={t("no_cards_yet")}
            subtitle={t("add_first_card")}
          />
        }
      />
    </SafeAreaView>
  );
}
