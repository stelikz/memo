import { useState } from "react";
import { Text, TouchableOpacity } from "react-native";

interface RevealableTextProps {
  hiddenLabel: string;
  revealedLabel: string;
  content: string;
}

export function RevealableText({
  hiddenLabel,
  revealedLabel,
  content,
}: RevealableTextProps) {
  const [revealed, setRevealed] = useState(false);

  return (
    <TouchableOpacity
      className="mt-4 rounded-xl border border-dashed border-gray-300 px-4 py-3"
      activeOpacity={0.7}
      onPress={() => setRevealed((v) => !v)}
    >
      <Text className="text-sm text-gray-500">
        {revealed ? revealedLabel : hiddenLabel}
      </Text>
      {revealed && (
        <Text className="mt-1 text-base font-medium text-gray-900">
          {content}
        </Text>
      )}
    </TouchableOpacity>
  );
}
