import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocale } from "../../i18n";

export default function SettingsScreen() {
  const t = useLocale();

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      <View className="flex-1 px-5 pt-4">
        <Text className="text-2xl font-bold text-gray-900">
          {t("settings")}
        </Text>
      </View>
    </SafeAreaView>
  );
}
