import { useState } from "react";
import { Text } from "react-native";
import { Button } from "./Button";

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
    <Button
      variant="ghost"
      className="mt-4 items-start border border-dashed border-gray-300 bg-transparent px-4 py-3"
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
    </Button>
  );
}
