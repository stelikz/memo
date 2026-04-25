import { Pressable, ScrollView, Text, View } from "react-native";
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
    <SafeAreaView className="flex-1 bg-memo-bg" edges={["top"]}>
      {/* Close button */}
      <View className="flex-row justify-end px-[18px] pt-2">
        <Pressable
          className="h-9 w-9 items-center justify-center rounded-full border border-memo-line bg-memo-surface"
          onPress={handleGoHome}
        >
          <Ionicons name="close" size={18} color="#15181F" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerClassName="px-[18px] pb-8 pt-5"
        keyboardShouldPersistTaps="handled"
      >
        {/* Card with banner */}
        <View
          className="overflow-hidden rounded-3xl border border-memo-line bg-memo-surface"
          style={{
            shadowColor: "#1F1B14",
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.07,
            shadowRadius: 32,
            elevation: 4,
          }}
        >
          {/* Banner */}
          <View className="items-center bg-memo-success-soft py-2.5">
            <Text className="text-[12px] font-semibold uppercase tracking-widest text-memo-success">
              ✦ {t("card_created")}
            </Text>
          </View>
          <View className="p-7 pt-5">
            <CardPreview
              card={aiResult}
              targetLanguage={targetLanguage}
              translate={t}
            />
          </View>
        </View>

        <View className="mt-6 gap-2.5">
          <Button label={t("add_another")} onPress={handleAddAnother} />
          <Button
            label={t("go_home")}
            variant="secondary"
            onPress={handleGoHome}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
