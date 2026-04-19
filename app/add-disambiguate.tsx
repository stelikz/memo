import { Alert, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocale } from "../i18n";
import { useSettingsStore } from "../stores/settings";
import { useAddFlowStore } from "../stores/addFlow";
import { saveCardFromAI } from "../lib/addHelpers";
import { db } from "../db/client";
import { getCardById, addUserSentence } from "../db/queries";
import { Button } from "../components/Button";
import { MeaningCard } from "../components/MeaningCard";
import { PolysemyBanner } from "../components/PolysemyBanner";

export default function AddDisambiguateScreen() {
  const t = useLocale();
  const router = useRouter();
  const targetLanguage = useSettingsStore((s) => s.targetLanguage);
  const { sentence, aiResult, existingSenseIds, setResult, reset } =
    useAddFlowStore();

  if (!aiResult) return null;

  const trimmedSentence = sentence || undefined;
  const existingCards = existingSenseIds
    .map((id) => getCardById(db, id))
    .filter(Boolean) as NonNullable<ReturnType<typeof getCardById>>[];

  const handleAddAsNewCard = () => {
    saveCardFromAI(aiResult, trimmedSentence, targetLanguage);
    setResult(aiResult);
    router.replace("/add-success");
  };

  const handleSameMeaning = () => {
    if (existingCards.length > 0 && trimmedSentence) {
      addUserSentence(db, existingCards[0].id, trimmedSentence);
    }
    reset();
    Alert.alert(t("card_created"), t("duplicate_word_message"));
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      <ScrollView
        contentContainerClassName="px-5 pb-8 pt-6"
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-5 flex-row items-center gap-3">
          <Button
            variant="ghost"
            className="bg-transparent py-0"
            onPress={() => {
              reset();
              router.back();
            }}
          >
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </Button>
          <Text className="flex-1 text-xl font-bold text-gray-900">
            {t("new_meaning_detected")}
          </Text>
        </View>

        <PolysemyBanner
          lemma={aiResult.lemma}
          existingCount={existingCards.length}
          totalCommonMeanings={aiResult.total_common_meanings}
          translate={t}
        />

        {existingCards.length > 0 && (
          <View className="mt-6">
            <Text className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {t("existing_meanings")}
            </Text>
            <View className="gap-3">
              {existingCards.map((card, index) => {
                let sentences: string[] = [];
                try {
                  sentences = JSON.parse(card.userSentencesJson);
                } catch {}

                return (
                  <MeaningCard
                    key={card.id}
                    variant="existing"
                    label={`${t("definition")} ${index + 1}`}
                    definitionTarget={card.primaryDefinitionTarget}
                    definitionNative={card.primaryDefinitionNative}
                    sentence={sentences[0]}
                    translate={t}
                  />
                );
              })}
            </View>
          </View>
        )}

        <View className="mt-6">
          <Text className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
            {t("new_meaning_detected")}
          </Text>
          <MeaningCard
            variant="new"
            definitionTarget={aiResult.primary_definition_target}
            definitionNative={aiResult.primary_definition_native}
            sentence={trimmedSentence ?? aiResult.example_sentence}
            translate={t}
          />
        </View>

        <View className="mt-8 gap-3">
          <Button label={t("add_as_new_card")} onPress={handleAddAsNewCard} />
          <Button
            label={t("same_meaning_add_sentence")}
            variant="secondary"
            onPress={handleSameMeaning}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
