import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { type TranslateFn } from "../i18n";

interface MeaningCardProps {
  definitionTarget: string;
  definitionNative: string;
  sentence?: string;
  variant: "existing" | "new";
  translate: TranslateFn;
  label?: string;
}

export function MeaningCard({
  definitionTarget,
  definitionNative,
  sentence,
  variant,
  translate: t,
  label,
}: MeaningCardProps) {
  const isNew = variant === "new";

  return (
    <View
      className={`rounded-2xl p-4 ${
        isNew
          ? "border-2 border-memo-accent bg-memo-accent-soft"
          : "border border-memo-line bg-memo-surface"
      }`}
    >
      {label && (
        <View className="mb-2 flex-row items-center gap-1.5">
          {isNew && (
            <Ionicons name="sparkles" size={14} color="#3B6FE5" />
          )}
          <Text
            className={`text-xs font-semibold uppercase tracking-wide ${
              isNew ? "text-memo-accent" : "text-memo-ink-muted"
            }`}
          >
            {label}
          </Text>
        </View>
      )}

      <Text
        className={`text-base leading-6 ${
          isNew ? "font-semibold text-memo-ink" : "text-memo-ink"
        }`}
      >
        {definitionTarget}
      </Text>

      <Text className="mt-1 text-sm text-memo-ink-soft">{definitionNative}</Text>

      {sentence ? (
        <View className="mt-3 rounded-xl bg-memo-bg px-3 py-2">
          <Text className="text-sm italic text-memo-ink-soft">{sentence}</Text>
        </View>
      ) : null}
    </View>
  );
}
