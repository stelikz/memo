import { useEffect, useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Speech from "expo-speech";

import { useLocale } from "../i18n";
import { useSettingsStore } from "../stores/settings";
import { useReviewStore } from "../stores/review";
import { db } from "../db/client";
import { getDueCards, getCardsByLemma, updateCardAfterReview } from "../db/queries";
import {
  getSchedulingPreview,
  Rating,
  type Grade,
} from "../lib/fsrs";
import { normalizeAccents } from "../lib/normalize";
import { TTS_LOCALES } from "../lib/tts";
import { RatingButton } from "../components/RatingButton";
import { RevealableText } from "../components/RevealableText";
import { Button } from "../components/Button";

const RATING_MAP: { rating: "again" | "hard" | "good" | "easy"; grade: Grade }[] = [
  { rating: "again", grade: Rating.Again },
  { rating: "hard", grade: Rating.Hard },
  { rating: "good", grade: Rating.Good },
  { rating: "easy", grade: Rating.Easy },
];

const RATING_LABEL_KEYS: Record<string, string> = {
  again: "rating_again",
  hard: "rating_hard",
  good: "rating_good",
  easy: "rating_easy",
};

// ── Sentence highlighting ───────────────────────────────────────────────────

function HighlightedSentence({
  sentence,
  word,
  lemma,
}: {
  sentence: string;
  word: string;
  lemma: string;
}) {
  const target = findWordInSentence(sentence, word) ?? findWordInSentence(sentence, lemma);

  if (!target) {
    return <Text className="text-lg leading-7 text-gray-800">{sentence}</Text>;
  }

  const idx = sentence.toLowerCase().indexOf(target.toLowerCase());
  const before = sentence.slice(0, idx);
  const match = sentence.slice(idx, idx + target.length);
  const after = sentence.slice(idx + target.length);

  return (
    <Text className="text-lg leading-7 text-gray-800">
      {before}
      <Text className="font-bold text-blue-600">{match}</Text>
      {after}
    </Text>
  );
}

function findWordInSentence(sentence: string, word: string): string | null {
  const normalizedSentence = normalizeAccents(sentence);
  const normalizedWord = normalizeAccents(word);

  const idx = normalizedSentence.indexOf(normalizedWord);
  if (idx === -1) return null;

  return sentence.slice(idx, idx + word.length);
}

// ── Main screen ─────────────────────────────────────────────────────────────

export default function ReviewScreen() {
  const t = useLocale();
  const router = useRouter();
  const targetLanguage = useSettingsStore((s) => s.targetLanguage);

  const cards = useReviewStore((s) => s.cards);
  const currentIndex = useReviewStore((s) => s.currentIndex);
  const isFlipped = useReviewStore((s) => s.isFlipped);
  const startSession = useReviewStore((s) => s.startSession);
  const flipCard = useReviewStore((s) => s.flipCard);
  const rateAndAdvance = useReviewStore((s) => s.rateAndAdvance);

  // Load due cards on mount
  useEffect(() => {
    const dueCards = getDueCards(db);
    if (dueCards.length === 0) {
      router.back();
      return;
    }
    startSession(dueCards);
  }, []);

  const card = useMemo(() => cards[currentIndex] ?? null, [cards, currentIndex]);
  const isComplete = currentIndex >= cards.length && cards.length > 0;

  // Navigate to review-complete when done
  useEffect(() => {
    if (isComplete) {
      router.replace("/review-complete");
    }
  }, [isComplete]);

  // Parse card data
  const sentence = useMemo(() => {
    if (!card) return null;
    const sentences: string[] = JSON.parse(card.userSentencesJson || "[]");
    return sentences.length > 0 ? sentences[sentences.length - 1] : null;
  }, [card]);

  const synonyms = useMemo(() => {
    if (!card) return [];
    return JSON.parse(card.synonymsJson || "[]") as Array<{
      word: string;
      register: string;
    }>;
  }, [card]);

  // Sibling cards for polysemy footnote — keyed on lemma to avoid re-querying
  // when advancing between cards with different lemmas
  const siblingDefinitions = useMemo(() => {
    if (!card) return [];
    const allCards = getCardsByLemma(db, card.lemma);
    return allCards
      .filter((c) => c.id !== card.id && c.status === "complete")
      .map((c) => c.primaryDefinitionTarget);
  }, [card?.lemma, card?.id]);

  // FSRS scheduling preview — reused in handleRate to avoid double-computation
  const preview = useMemo(() => {
    if (!card) return null;
    return getSchedulingPreview(card);
  }, [card]);

  if (!card) return null;

  const ttsLocale = TTS_LOCALES[targetLanguage] ?? targetLanguage;
  const progress = `${currentIndex + 1} / ${cards.length}`;
  const progressFraction = (currentIndex + 1) / cards.length;

  const speakWord = () => Speech.speak(card.lemma, { language: ttsLocale });
  const speakSentence = () => {
    if (sentence) Speech.speak(sentence, { language: ttsLocale });
  };

  const handleRate = (rating: "again" | "hard" | "good" | "easy", grade: Grade) => {
    // Reuse the preview result instead of recomputing via applyRating
    const reviewUpdate = preview![grade].reviewUpdate;
    updateCardAfterReview(db, card.id, reviewUpdate);
    rateAndAdvance(rating);
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      {/* Header: progress bar + count */}
      <View className="px-5 pb-3 pt-4">
        <View className="mb-2 flex-row items-center justify-between">
          <Button
            variant="ghost"
            className="bg-transparent px-0 py-0"
            onPress={() => router.back()}
          >
            <Ionicons name="close" size={24} color="#6b7280" />
          </Button>
          <Text className="text-sm font-medium text-gray-500">{progress}</Text>
        </View>
        <View className="h-1.5 overflow-hidden rounded-full bg-gray-200">
          <View
            className="h-full rounded-full bg-blue-500"
            style={{ width: `${progressFraction * 100}%` }}
          />
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-8"
        showsVerticalScrollIndicator={false}
      >
        {/* Card area */}
        <Pressable
          onPress={() => {
            if (!isFlipped) flipCard();
          }}
          className="mt-4 min-h-[200px] rounded-2xl bg-white p-6 shadow-sm"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 3,
            elevation: 2,
          }}
        >
          {/* Front: sentence with highlighted word */}
          {sentence ? (
            isFlipped ? (
              <Pressable onPress={speakSentence}>
                <HighlightedSentence
                  sentence={sentence}
                  word={card.encounteredForm}
                  lemma={card.lemma}
                />
                <Text className="mt-1 text-xs text-gray-400">
                  {t("hear_sentence")}
                </Text>
              </Pressable>
            ) : (
              <HighlightedSentence
                sentence={sentence}
                word={card.encounteredForm}
                lemma={card.lemma}
              />
            )
          ) : (
            <Text className="text-center text-2xl font-bold text-gray-900">
              {card.encounteredForm}
            </Text>
          )}

          {/* Back content */}
          {isFlipped && (
            <View className="mt-6 border-t border-gray-100 pt-5">
              {/* Lemma + IPA + TTS */}
              <View className="flex-row items-center gap-3">
                <Text className="text-2xl font-bold text-gray-900">
                  {card.lemma}
                </Text>
                <Text className="text-sm text-gray-400">
                  {card.pronunciationIpa}
                </Text>
                <Button
                  variant="ghost"
                  className="bg-transparent px-0 py-0"
                  onPress={speakWord}
                  hitSlop={8}
                >
                  <Ionicons
                    name="volume-medium-outline"
                    size={22}
                    color="#2563eb"
                  />
                </Button>
              </View>

              {/* Part of speech + encountered form */}
              <Text className="mt-1 text-sm text-gray-500">
                {card.partOfSpeech}
                {card.encounteredForm !== card.lemma &&
                  ` \u00B7 ${card.encounteredForm}`}
              </Text>

              {/* Target-language definition */}
              <Text className="mt-4 text-base leading-6 text-gray-900">
                {card.primaryDefinitionTarget}
              </Text>

              {/* Native translation — hidden */}
              <RevealableText
                hiddenLabel={t("show_native_translation")}
                revealedLabel={t("hide_native_translation")}
                content={card.primaryDefinitionNative}
              />

              {/* Synonyms */}
              {synonyms.length > 0 && (
                <View className="mt-4">
                  <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    {t("synonyms")}
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {synonyms.map((s) => (
                      <View
                        key={s.word}
                        className="rounded-full bg-blue-50 px-3 py-1"
                      >
                        <Text className="text-sm text-blue-700">
                          {s.word}
                          {s.register ? ` (${s.register})` : ""}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Antonym */}
              {card.antonym && (
                <View className="mt-3">
                  <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    {t("antonym")}
                  </Text>
                  <View className="self-start rounded-full bg-red-50 px-3 py-1">
                    <Text className="text-sm text-red-700">{card.antonym}</Text>
                  </View>
                </View>
              )}

              {/* Polysemy footnote — only learned siblings */}
              {siblingDefinitions.length > 0 && (
                <View className="mt-4 rounded-xl bg-amber-50 px-4 py-3">
                  <Text className="mb-1 text-xs font-semibold text-amber-700">
                    {t("also_means_footnote")}
                  </Text>
                  {siblingDefinitions.map((def, i) => (
                    <Text key={i} className="text-sm leading-5 text-amber-800">
                      {"\u2022 "}
                      {def}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          )}
        </Pressable>

        {/* Tap to reveal hint */}
        {!isFlipped && (
          <Text className="mt-4 text-center text-sm text-gray-400">
            {t("tap_to_reveal")}
          </Text>
        )}
      </ScrollView>

      {/* Rating buttons */}
      <View className="border-t border-gray-100 bg-white px-5 pb-6 pt-3">
        <View className="flex-row gap-2">
          {RATING_MAP.map(({ rating, grade }) => (
            <RatingButton
              key={rating}
              rating={rating}
              label={t(RATING_LABEL_KEYS[rating])}
              subtitle={isFlipped && preview ? preview[grade].intervalLabel : undefined}
              disabled={!isFlipped}
              onPress={() => handleRate(rating, grade)}
            />
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}
