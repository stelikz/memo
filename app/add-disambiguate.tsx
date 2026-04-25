import { Alert, Pressable, ScrollView, Text, View } from "react-native";
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
    <SafeAreaView className="flex-1 bg-memo-bg" edges={["top"]}>
      {/* Close button */}
      <View className="flex-row justify-end px-[18px] pt-2">
        <Pressable
          className="h-9 w-9 items-center justify-center rounded-full border border-memo-line bg-memo-surface"
          onPress={() => {
            reset();
            router.back();
          }}
        >
          <Ionicons name="close" size={18} color="#15181F" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerClassName="px-6 pb-8 pt-3"
        keyboardShouldPersistTaps="handled"
      >
        {/* Icon + title */}
        <View className="mb-4 h-11 w-11 items-center justify-center rounded-full bg-memo-accent-soft">
          <Ionicons name="information-circle" size={22} color="#3B6FE5" />
        </View>
        <Text className="text-[30px] font-light leading-tight text-memo-ink">
          {t("new_meaning_detected")}
        </Text>
        <Text className="mt-2.5 mb-5 text-sm leading-relaxed text-memo-ink-soft">
          {t("polysemy_nth_meaning")
            .replace("{{n}}", String(existingCards.length + 1))
            .replace("{{word}}", aiResult.lemma)}
        </Text>

        {existingCards.length > 0 && (
          <View className="mb-5">
            <Text className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-memo-ink-muted">
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

        <View className="mb-6">
          <Text className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-memo-ink-muted">
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

        <View className="gap-2.5">
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
