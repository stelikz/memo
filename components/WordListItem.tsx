import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CardState } from "../db/types";

interface OtherMeaning {
  definition_target: string;
  definition_native: string;
  example_sentence: string;
}

interface WordListItemProps {
  lemma: string;
  partOfSpeech: string;
  definition: string;
  state?: number;
  isSuspended?: number;
  totalCommonMeanings?: number;
  otherMeaningsJson?: string;
  onPress?: () => void;
}

function getMemorizationChip(state: number): {
  label: string;
  bg: string;
  fg: string;
} {
  switch (state) {
    case CardState.Review:
      return { label: "Mastered", bg: "bg-memo-success-soft", fg: "text-memo-success" };
    case CardState.Learning:
    case CardState.Relearning:
      return { label: "Learning", bg: "bg-memo-accent-soft", fg: "text-memo-accent" };
    case CardState.New:
    default:
      return { label: "New", bg: "bg-memo-surface-alt", fg: "text-memo-ink-soft" };
  }
}

export function WordListItem({
  lemma,
  partOfSpeech,
  definition,
  state,
  isSuspended,
  totalCommonMeanings,
  otherMeaningsJson,
  onPress,
}: WordListItemProps) {
  const chip = state != null ? getMemorizationChip(state) : null;
  const isMultiMeaning = (totalCommonMeanings ?? 0) > 1;
  const [expanded, setExpanded] = useState(false);

  let otherMeanings: OtherMeaning[] = [];
  if (isMultiMeaning && otherMeaningsJson) {
    try {
      otherMeanings = JSON.parse(otherMeaningsJson);
    } catch {}
  }

  const handlePress = () => {
    if (isMultiMeaning && otherMeanings.length > 0) {
      setExpanded((prev) => !prev);
    } else {
      onPress?.();
    }
  };

  return (
    <View>
      {/* Main row */}
      <Pressable
        className={`flex-row items-center rounded-2xl border bg-memo-surface px-4 py-3.5 ${
          expanded ? "border-memo-accent rounded-b-none" : "border-memo-line"
        }`}
        onPress={handlePress}
      >
        <View className="flex-1">
          <View className="flex-row items-baseline gap-2">
            <Text className="text-lg font-normal text-memo-ink">{lemma}</Text>
            <Text className="text-[11px] uppercase tracking-wider text-memo-ink-muted">
              {partOfSpeech}
            </Text>
            {isSuspended === 1 && (
              <View className="rounded bg-memo-warn-soft px-1.5 py-0.5">
                <Text className="text-[10px] font-medium text-memo-warn">
                  PAUSED
                </Text>
              </View>
            )}
          </View>
          {isMultiMeaning ? (
            <View className="mt-0.5 flex-row items-center gap-1">
              <Text className="text-[13px] font-medium text-memo-accent">
                {totalCommonMeanings} meanings
              </Text>
              <Ionicons
                name={expanded ? "chevron-up" : "chevron-down"}
                size={12}
                color="#3B6FE5"
              />
            </View>
          ) : (
            <Text
              className="mt-0.5 text-[13px] text-memo-ink-soft"
              numberOfLines={1}
            >
              {definition}
            </Text>
          )}
        </View>

        {chip && (
          <View className={`rounded-full px-2.5 py-1 ${chip.bg}`}>
            <Text
              className={`text-[11px] font-semibold uppercase tracking-wider ${chip.fg}`}
            >
              {chip.label}
            </Text>
          </View>
        )}

        {!isMultiMeaning && (
          <Ionicons
            name="chevron-forward"
            size={16}
            color="#8A8F9A"
            style={{ marginLeft: 8 }}
          />
        )}
      </Pressable>

      {/* Expanded meanings */}
      {expanded && otherMeanings.length > 0 && (
        <View className="overflow-hidden rounded-b-2xl border border-t-0 border-memo-accent bg-memo-surface">
          {otherMeanings.map((m, i) => (
            <Pressable
              key={i}
              className="flex-row items-center gap-3 px-4 py-3"
              style={
                i > 0
                  ? { borderTopWidth: 0.5, borderTopColor: "rgba(21,24,31,0.08)" }
                  : undefined
              }
              onPress={onPress}
            >
              <View className="h-[22px] w-[22px] items-center justify-center rounded-full bg-memo-accent-soft">
                <Text className="text-[11px] font-semibold text-memo-accent">
                  {i + 1}
                </Text>
              </View>
              <View className="flex-1">
                <Text
                  className="text-[14px] text-memo-ink leading-snug"
                  numberOfLines={2}
                >
                  {m.definition_target}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color="#8A8F9A" />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
