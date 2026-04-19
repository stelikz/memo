import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { type TranslateFn } from "../i18n";

interface MeaningCardProps {
  definitionTarget: string;
  definitionNative: string;
  sentence?: string;
  /** Visual variant: "existing" = muted card, "new" = highlighted with accent border */
  variant: "existing" | "new";
  translate: TranslateFn;
  /** Optional label above the card (e.g. "Meaning 1", "New meaning") */
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
          ? "border-2 border-blue-400 bg-blue-50"
          : "border border-gray-200 bg-white"
      }`}
    >
      {label && (
        <View className="mb-2 flex-row items-center gap-1.5">
          {isNew && (
            <Ionicons name="sparkles" size={14} color="#2563eb" />
          )}
          <Text
            className={`text-xs font-semibold uppercase tracking-wide ${
              isNew ? "text-blue-600" : "text-gray-400"
            }`}
          >
            {label}
          </Text>
        </View>
      )}

      <Text
        className={`text-base leading-6 ${
          isNew ? "font-semibold text-gray-900" : "text-gray-900"
        }`}
      >
        {definitionTarget}
      </Text>

      <Text className="mt-1 text-sm text-gray-500">{definitionNative}</Text>

      {sentence ? (
        <View className="mt-3 rounded-lg bg-gray-50 px-3 py-2">
          <Text className="text-sm italic text-gray-600">{sentence}</Text>
        </View>
      ) : null}
    </View>
  );
}
