import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocale } from "../../i18n";

export default function AddScreen() {
  const t = useLocale();

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      <View className="flex-1 items-center justify-center px-5">
        <Text className="text-2xl font-bold text-gray-900">
          {t("add_word")}
        </Text>
        <Text className="mt-2 text-gray-500">{t("where_did_you_see_it")}</Text>
      </View>
    </SafeAreaView>
  );
}
