import { useState } from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
      className="mt-4 items-start self-start border border-dashed border-memo-line-strong bg-transparent px-4 py-2.5 rounded-[10px]"
      onPress={() => setRevealed((v) => !v)}
    >
      <View className="flex-row items-center gap-2">
        <Ionicons name="eye-outline" size={14} color="#454A55" />
        <Text className="text-[13px] font-medium text-memo-ink-soft">
          {revealed ? revealedLabel : hiddenLabel}
        </Text>
      </View>
      {revealed && (
        <Text className="mt-1 text-base font-medium text-memo-ink">
          {content}
        </Text>
      )}
    </Button>
  );
}
