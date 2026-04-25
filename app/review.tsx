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
import {
  getDueCards,
  getCardsByLemma,
  updateCardAfterReview,
} from "../db/queries";
import { getSchedulingPreview, Rating, type Grade } from "../lib/fsrs";
import { normalizeAccents } from "../lib/normalize";
import { TTS_LOCALES } from "../lib/tts";
import { RatingButton } from "../components/RatingButton";
import { RevealableText } from "../components/RevealableText";
import { Button } from "../components/Button";

const RATING_MAP: {
  rating: "again" | "hard" | "good" | "easy";
  grade: Grade;
}[] = [
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
  large = false,
}: {
  sentence: string;
  word: string;
  lemma: string;
  large?: boolean;
}) {
  const target =
    findWordInSentence(sentence, word) ?? findWordInSentence(sentence, lemma);

  const textClass = large
    ? "text-[28px] font-light leading-10 text-memo-ink text-center"
    : "text-[17px] font-light italic leading-6 text-memo-ink-soft";

  if (!target) {
    return <Text className={textClass}>{sentence}</Text>;
  }

  const idx = sentence.toLowerCase().indexOf(target.toLowerCase());
  const before = sentence.slice(0, idx);
  const match = sentence.slice(idx, idx + target.length);
  const after = sentence.slice(idx + target.length);

  return (
    <Text className={textClass}>
      {before}
      <Text
        className={
          large
            ? "font-semibold text-memo-accent"
            : "font-semibold text-memo-accent not-italic"
        }
        style={
          large
            ? { backgroundColor: "rgba(59,111,229,0.12)" }
            : undefined
        }
      >
        {match}
      </Text>
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
  const dailyReviewLimit = useSettingsStore((s) => s.dailyReviewLimit);

  const cards = useReviewStore((s) => s.cards);
  const currentIndex = useReviewStore((s) => s.currentIndex);
  const isFlipped = useReviewStore((s) => s.isFlipped);
  const startSession = useReviewStore((s) => s.startSession);
  const flipCard = useReviewStore((s) => s.flipCard);
  const rateAndAdvance = useReviewStore((s) => s.rateAndAdvance);

  useEffect(() => {
    let dueCards = getDueCards(db);
    if (dueCards.length === 0) {
      router.back();
      return;
    }
    if (dailyReviewLimit > 0) {
      dueCards = dueCards.slice(0, dailyReviewLimit);
    }
    startSession(dueCards);
  }, []);

  const card = useMemo(
    () => cards[currentIndex] ?? null,
    [cards, currentIndex],
  );
  const isComplete = currentIndex >= cards.length && cards.length > 0;

  useEffect(() => {
    if (isComplete) {
      router.replace("/review-complete");
    }
  }, [isComplete]);

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

  const siblingDefinitions = useMemo(() => {
    if (!card) return [];
    const allCards = getCardsByLemma(db, card.lemma);
    return allCards
      .filter((c) => c.id !== card.id && c.status === "complete")
      .map((c) => c.primaryDefinitionTarget);
  }, [card?.lemma, card?.id]);

  const preview = useMemo(() => {
    if (!card) return null;
    return getSchedulingPreview(card);
  }, [card]);

  if (!card) return null;

  const ttsLocale = TTS_LOCALES[targetLanguage] ?? targetLanguage;
  const progressFraction = (currentIndex + 1) / cards.length;

  const speakWord = () => Speech.speak(card.lemma, { language: ttsLocale });
  const speakSentence = () => {
    if (sentence) Speech.speak(sentence, { language: ttsLocale });
  };

  const handleRate = (
    rating: "again" | "hard" | "good" | "easy",
    grade: Grade,
  ) => {
    const reviewUpdate = preview![grade].reviewUpdate;
    updateCardAfterReview(db, card.id, reviewUpdate);
    rateAndAdvance(rating);
  };

  return (
    <SafeAreaView className="flex-1 bg-memo-bg" edges={["top"]}>
      {/* Header: close + progress bar + count */}
      <View className="px-[18px] pb-3.5 pt-1">
        <View className="flex-row items-center gap-3.5">
          <Pressable
            className="h-8 w-8 items-center justify-center"
            onPress={() => router.back()}
          >
            <Ionicons name="close" size={20} color="#454A55" />
          </Pressable>
          <View className="flex-1 h-1 overflow-hidden rounded-full bg-memo-line">
            <View
              className="h-full rounded-full bg-memo-accent"
              style={{ width: `${progressFraction * 100}%` }}
            />
          </View>
          <Text className="min-w-[32px] text-right text-[13px] text-memo-ink-soft font-mono">
            {currentIndex + 1}/{cards.length}
          </Text>
        </View>
      </View>

      {/* Card area */}
      <View className="flex-1 px-[18px]">
        {!isFlipped ? (
          /* ── FRONT: sentence with highlighted word ── */
          <Pressable
            className="flex-1 items-center justify-center rounded-3xl border border-memo-line bg-memo-surface px-7 py-10"
            style={{
              shadowColor: "#1F1B14",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.04,
              shadowRadius: 3,
              elevation: 2,
            }}
            onPress={flipCard}
          >
            <Text className="absolute top-[22px] self-center text-[11px] font-medium uppercase tracking-widest text-memo-ink-muted">
              {t("review")}
            </Text>
            {sentence ? (
              <HighlightedSentence
                sentence={sentence}
                word={card.encounteredForm}
                lemma={card.lemma}
                large
              />
            ) : (
              <Text className="text-center text-2xl font-bold text-memo-ink">
                {card.encounteredForm}
              </Text>
            )}
            <Text className="absolute bottom-[22px] self-center text-[12px] tracking-wider text-memo-ink-muted">
              {t("tap_to_reveal")}
            </Text>
          </Pressable>
        ) : (
          /* ── BACK: sentence card + full card ── */
          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            contentContainerClassName="gap-3 pb-4"
          >
            {/* Sentence bar */}
            {sentence && (
              <Pressable
                className="rounded-2xl border border-memo-line bg-memo-surface px-[18px] py-3.5"
                onPress={speakSentence}
              >
                <HighlightedSentence
                  sentence={sentence}
                  word={card.encounteredForm}
                  lemma={card.lemma}
                />
                <Text className="mt-1 text-[11px] text-memo-ink-muted">
                  {t("hear_sentence")}
                </Text>
              </Pressable>
            )}

            {/* Full card */}
            <View
              className="rounded-3xl border border-memo-line bg-memo-surface p-6"
              style={{
                shadowColor: "#1F1B14",
                shadowOffset: { width: 0, height: 12 },
                shadowOpacity: 0.07,
                shadowRadius: 32,
                elevation: 4,
              }}
            >
              {/* Lemma + IPA + TTS */}
              <View className="flex-row items-center gap-3 flex-wrap mb-1.5">
                <Text className="text-[36px] font-light text-memo-ink">
                  {card.lemma}
                </Text>
                <Text className="text-[13px] text-memo-ink-muted font-mono tracking-wider">
                  {card.pronunciationIpa}
                </Text>
                <Pressable
                  className="ml-auto h-8 w-8 items-center justify-center rounded-full bg-memo-surface-alt"
                  onPress={speakWord}
                >
                  <Ionicons
                    name="volume-medium-outline"
                    size={16}
                    color="#454A55"
                  />
                </Pressable>
              </View>

              {/* Type */}
              <Text className="mb-[18px] text-[12px] font-medium uppercase tracking-widest text-memo-ink-muted">
                {card.partOfSpeech}
                {card.encounteredForm !== card.lemma &&
                  ` · ${card.encounteredForm}`}
              </Text>

              {/* Definition */}
              <Text className="mb-[18px] text-[22px] font-light leading-7 text-memo-ink">
                {card.primaryDefinitionTarget}
              </Text>

              {/* English toggle */}
              <RevealableText
                hiddenLabel={t("show_native_translation")}
                revealedLabel={t("hide_native_translation")}
                content={card.primaryDefinitionNative}
              />

              {/* Synonyms + Antonym */}
              {(synonyms.length > 0 || card.antonym) && (
                <View className="mt-[18px] flex-row flex-wrap gap-2.5">
                  {synonyms.slice(0, 2).map((s) => (
                    <View
                      key={s.word}
                      className="rounded-lg bg-memo-success-soft px-3 py-1.5"
                    >
                      <Text className="text-[12px] font-medium text-memo-success">
                        ≈ {s.word}
                      </Text>
                    </View>
                  ))}
                  {card.antonym && (
                    <View className="rounded-lg bg-memo-accent-soft px-3 py-1.5">
                      <Text className="text-[12px] font-medium text-memo-accent">
                        ≠ {card.antonym}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Polysemy footnote */}
              {siblingDefinitions.length > 0 && (
                <View className="mt-4 border-t border-memo-line pt-4">
                  <Text className="mb-1 text-[12px] font-semibold text-memo-accent">
                    {t("also_means_footnote")}
                  </Text>
                  {siblingDefinitions.map((def, i) => (
                    <Text
                      key={i}
                      className="text-[13px] leading-5 text-memo-ink-soft"
                    >
                      {"\u2022 "}
                      {def}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>
        )}
      </View>

      {/* Rating buttons */}
      {isFlipped && (
        <View className="px-[18px] pb-4 pt-3.5">
          <View className="flex-row gap-2">
            {RATING_MAP.map(({ rating, grade }) => (
              <RatingButton
                key={rating}
                rating={rating}
                label={t(RATING_LABEL_KEYS[rating])}
                subtitle={preview ? preview[grade].intervalLabel : undefined}
                disabled={!isFlipped}
                onPress={() => handleRate(rating, grade)}
              />
            ))}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
