import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocale } from "../i18n";
import { useSettingsStore } from "../stores/settings";
import { useAddFlowStore } from "../stores/addFlow";
import { Button } from "../components/Button";
import { CardPreview } from "../components/CardPreview";

export default function AddSuccessScreen() {
  const t = useLocale();
  const router = useRouter();
  const targetLanguage = useSettingsStore((s) => s.targetLanguage);
  const { aiResult, reset } = useAddFlowStore();

  const handleAddAnother = () => {
    reset();
    router.back();
  };

  const handleGoHome = () => {
    reset();
    router.dismissAll();
  };

  if (!aiResult) return null;

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      <ScrollView
        contentContainerClassName="px-5 pb-8 pt-6"
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-6 items-center">
          <View className="mb-3 h-14 w-14 items-center justify-center rounded-full bg-green-100">
            <Ionicons name="checkmark-circle" size={32} color="#22c55e" />
          </View>
          <Text className="text-xl font-bold text-gray-900">
            {t("card_created")}
          </Text>
        </View>

        <View className="rounded-2xl bg-white p-5 shadow-sm">
          <CardPreview
            card={aiResult}
            targetLanguage={targetLanguage}
            translate={t}
          />
        </View>

        <View className="mt-6 gap-3">
          <Button label={t("add_another")} onPress={handleAddAnother} />
          <Button
            label={t("go_home")}
            variant="ghost"
            onPress={handleGoHome}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
