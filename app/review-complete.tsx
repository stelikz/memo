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
  { key: "againCount" as const, label: "rating_again", color: "bg-red-400" },
  { key: "hardCount" as const, label: "rating_hard", color: "bg-orange-400" },
  { key: "goodCount" as const, label: "rating_good", color: "bg-green-400" },
  { key: "easyCount" as const, label: "rating_easy", color: "bg-blue-400" },
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
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      <View className="flex-1 items-center justify-center px-8">
        {/* Success icon */}
        <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-green-100">
          <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
        </View>

        <Text className="text-2xl font-bold text-gray-900">
          {t("well_done")}
        </Text>
        <Text className="mt-1 text-base text-gray-500">
          {t("review_complete")}
        </Text>

        {/* Stats */}
        <View className="mt-8 w-full rounded-2xl bg-white p-5 shadow-sm">
          <Text className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-400">
            {t("review_stats")}
          </Text>

          <View className="mb-4 flex-row justify-around">
            <View className="items-center">
              <Text className="text-2xl font-bold text-gray-900">
                {totalReviewed}
              </Text>
              <Text className="text-sm text-gray-500">
                {t("cards_reviewed")}
              </Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-gray-900">
                {currentStreak}
              </Text>
              <Text className="text-sm text-gray-500">{t("day_streak")}</Text>
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
                {BREAKDOWN.map(({ key, label }, i) => {
                  const count = counts[i];
                  if (count === 0) return null;
                  return (
                    <View key={key} className="flex-row items-center gap-1.5">
                      <View
                        className={`h-2.5 w-2.5 rounded-full ${BREAKDOWN[i].color}`}
                      />
                      <Text className="text-xs text-gray-600">
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
      <View className="px-5 pb-6">
        <Button label={t("go_home")} onPress={handleGoHome} />
        <Button
          variant="secondary"
          label={t("add_another")}
          className="mt-3"
          onPress={handleAddWord}
        />
      </View>
    </SafeAreaView>
  );
}
