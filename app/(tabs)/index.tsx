import { useEffect, useState, useCallback } from "react";
import { FlatList, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocale } from "../../i18n";
import { useSettingsStore } from "../../stores/settings";
import { db } from "../../db/client";
import {
  countAllCards,
  countDueCards,
  getRecentCards,
} from "../../db/queries";
import { StatCard } from "../../components/StatCard";
import { SectionHeader } from "../../components/SectionHeader";
import { WordListItem } from "../../components/WordListItem";
import { EmptyState } from "../../components/EmptyState";

function ItemSeparator() {
  return <View className="h-2" />;
}

export default function HomeScreen() {
  const t = useLocale();
  const router = useRouter();
  const hydrate = useSettingsStore((s) => s.hydrate);
  const currentStreak = useSettingsStore((s) => s.currentStreak);

  const [totalCards, setTotalCards] = useState(0);
  const [dueCount, setDueCount] = useState(0);
  const [recentCards, setRecentCards] = useState<ReturnType<typeof getRecentCards>>([]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useFocusEffect(
    useCallback(() => {
      setTotalCards(countAllCards(db));
      setDueCount(countDueCards(db));
      setRecentCards(getRecentCards(db));
    }, []),
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      <FlatList
        data={recentCards}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-5 pb-8"
        ItemSeparatorComponent={ItemSeparator}
        ListHeaderComponent={
          <>
            <Text className="mb-6 mt-4 text-2xl font-bold text-gray-900">
              {t("home_greeting")}
            </Text>

            <View className="mb-6 flex-row gap-3">
              <StatCard
                label={t("cards_due_today")}
                value={dueCount}
                icon="book-outline"
                iconColor="#f59e0b"
                onPress={
                  dueCount > 0
                    ? () => router.push("/review" as any)
                    : undefined
                }
              />
              <StatCard
                label={t("total_cards")}
                value={totalCards}
                icon="layers-outline"
                onPress={
                  totalCards > 0
                    ? () => router.push("/library" as any)
                    : undefined
                }
              />
              <StatCard
                label={t("day_streak")}
                value={currentStreak}
                icon="flame-outline"
                iconColor="#ef4444"
              />
            </View>

            <SectionHeader title={t("recently_added")} />
          </>
        }
        renderItem={({ item }) => (
          <WordListItem
            lemma={item.lemma}
            partOfSpeech={item.partOfSpeech}
            definition={item.primaryDefinitionTarget}
            onPress={() =>
              router.push(`/card-detail?id=${item.id}` as any)
            }
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
