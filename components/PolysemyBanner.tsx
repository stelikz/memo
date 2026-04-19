import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { type TranslateFn } from "../i18n";

interface PolysemyBannerProps {
  lemma: string;
  existingCount: number;
  totalCommonMeanings: number;
  translate: TranslateFn;
}

export function PolysemyBanner({
  lemma,
  existingCount,
  totalCommonMeanings,
  translate: t,
}: PolysemyBannerProps) {
  const ordinal = existingCount + 1;

  return (
    <View className="flex-row items-start gap-3 rounded-2xl bg-amber-50 px-4 py-4">
      <Ionicons
        name="information-circle"
        size={22}
        color="#d97706"
        style={{ marginTop: 1 }}
      />
      <View className="flex-1">
        <Text className="text-sm font-semibold text-amber-900">
          {t("polysemy_nth_meaning")
            .replace("{{n}}", String(ordinal))
            .replace("{{word}}", lemma)}
        </Text>
        <Text className="mt-1 text-sm text-amber-700">
          {t("polysemy_total_meanings")
            .replace("{{count}}", String(totalCommonMeanings))}
        </Text>
      </View>
    </View>
  );
}
