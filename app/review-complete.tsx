import { useEffect } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useLocale } from "../i18n";
import { useSettingsStore } from "../stores/settings";
import { useReviewStore } from "../stores/review";
import { Button } from "../components/Button";

const BREAKDOWN = [
  { key: "againCount" as const, label: "rating_again", color: "bg-memo-danger" },
  { key: "hardCount" as const, label: "rating_hard", color: "bg-memo-warn" },
  { key: "goodCount" as const, label: "rating_good", color: "bg-memo-success" },
  { key: "easyCount" as const, label: "rating_easy", color: "bg-memo-accent" },
] as const;

export default function ReviewCompleteScreen() {
  const t = useLocale();
  const router = useRouter();
  const updateStreak = useSettingsStore((s) => s.updateStreak);
  const currentStreak = useSettingsStore((s) => s.currentStreak);

  const againCount = useReviewStore((s) => s.againCount);
  const hardCount = useReviewStore((s) => s.hardCount);
  const goodCount = useReviewStore((s) => s.goodCount);
  const easyCount = useReviewStore((s) => s.easyCount);
  const reset = useReviewStore((s) => s.reset);

  const totalReviewed = againCount + hardCount + goodCount + easyCount;
  const counts = [againCount, hardCount, goodCount, easyCount];

  useEffect(() => {
    updateStreak();
  }, []);

  const handleGoHome = () => {
    reset();
    router.replace("/(tabs)");
  };

  const handleAddWord = () => {
    reset();
    router.replace("/(tabs)/add");
  };

  return (
    <SafeAreaView className="flex-1 bg-memo-bg" edges={["top"]}>
      <View className="flex-1 items-center justify-center px-8">
        {/* Success icon */}
        <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-memo-success-soft">
          <Ionicons name="checkmark" size={48} color="#3FA877" />
        </View>

        <Text className="text-[28px] font-light text-memo-ink">
          {t("well_done")}
        </Text>
        <Text className="mt-1 text-base text-memo-ink-soft">
          {t("review_complete")}
        </Text>

        {/* Stats */}
        <View
          className="mt-8 w-full rounded-3xl border border-memo-line bg-memo-surface p-5"
          style={{
            shadowColor: "#1F1B14",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.04,
            shadowRadius: 3,
            elevation: 2,
          }}
        >
          <Text className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-memo-ink-muted">
            {t("review_stats")}
          </Text>

          <View className="mb-4 flex-row justify-around">
            <View className="items-center">
              <Text className="text-[32px] font-light text-memo-ink">
                {totalReviewed}
              </Text>
              <Text className="text-[13px] text-memo-ink-soft">
                {t("cards_reviewed")}
              </Text>
            </View>
            <View className="items-center">
              <Text className="text-[32px] font-light text-memo-ink">
                {currentStreak}
              </Text>
              <Text className="text-[13px] text-memo-ink-soft">
                {t("day_streak")}
              </Text>
            </View>
          </View>

          {/* Breakdown bar */}
          {totalReviewed > 0 && (
            <View>
              <View className="h-3 flex-row overflow-hidden rounded-full">
                {BREAKDOWN.map(({ key, color }, i) => {
                  const count = counts[i];
                  if (count === 0) return null;
                  const widthPct = (count / totalReviewed) * 100;
                  return (
                    <View
                      key={key}
                      className={`h-full ${color}`}
                      style={{ width: `${widthPct}%` }}
                    />
                  );
                })}
              </View>

              {/* Legend */}
              <View className="mt-3 flex-row flex-wrap gap-x-4 gap-y-1">
                {BREAKDOWN.map(({ key, label, color }, i) => {
                  const count = counts[i];
                  if (count === 0) return null;
                  return (
                    <View key={key} className="flex-row items-center gap-1.5">
                      <View className={`h-2.5 w-2.5 rounded-full ${color}`} />
                      <Text className="text-xs text-memo-ink-soft">
                        {t(label)} ({count})
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Actions */}
      <View className="px-6 pb-6 gap-3">
        <Button label={t("go_home")} onPress={handleGoHome} />
        <Button
          variant="secondary"
          label={t("add_another")}
          onPress={handleAddWord}
        />
      </View>
    </SafeAreaView>
  );
}
