import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface SoftWarningProps {
  message: string;
}

export function SoftWarning({ message }: SoftWarningProps) {
  return (
    <View className="mb-4 flex-row items-start gap-2 rounded-xl bg-memo-warn-soft px-4 py-3">
      <Ionicons
        name="warning-outline"
        size={18}
        color="#E0A33C"
        style={{ marginTop: 1 }}
      />
      <Text className="flex-1 text-sm text-memo-ink-soft">{message}</Text>
    </View>
  );
}
