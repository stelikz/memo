import { ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocale } from "../i18n";
import { useSettingsStore } from "../stores/settings";
import { db } from "../db/client";
import { getCardById } from "../db/queries";
import { Button } from "../components/Button";
import { CardPreview } from "../components/CardPreview";
import type { AICardResponse } from "../lib/ai";

export default function CardDetailScreen() {
  const t = useLocale();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const targetLanguage = useSettingsStore((s) => s.targetLanguage);

  const card = id ? getCardById(db, id) : undefined;

  if (!card) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-gray-50" edges={["top"]}>
        <Text className="text-gray-500">Card not found</Text>
      </SafeAreaView>
    );
  }

  const previewCard: AICardResponse = {
    lemma: card.lemma,
    encountered_form: card.encounteredForm,
    part_of_speech: card.partOfSpeech,
    pronunciation_ipa: card.pronunciationIpa,
    grammar: JSON.parse(card.grammarJson),
    primary_definition_target: card.primaryDefinitionTarget,
    primary_definition_native: card.primaryDefinitionNative,
    example_sentence: card.exampleSentence,
    corrected_sentence: null,
    total_common_meanings: card.totalCommonMeanings,
    is_new_sense: null,
    other_meanings: JSON.parse(card.otherMeaningsJson),
    synonyms: JSON.parse(card.synonymsJson),
    antonym: card.antonym ? { word: card.antonym } : null,
    irregular_forms: card.irregularForms ?? null,
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      <View className="flex-row items-center px-5 pb-2 pt-3">
        <Button
          variant="ghost"
          className="h-10 w-10 items-center justify-center rounded-full"
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </Button>
      </View>

      <ScrollView contentContainerClassName="px-5 pb-8">
        <View className="rounded-2xl bg-white p-5 shadow-sm">
          <CardPreview
            card={previewCard}
            targetLanguage={targetLanguage}
            translate={t}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
