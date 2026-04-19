import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface SoftWarningProps {
  message: string;
}

export function SoftWarning({ message }: SoftWarningProps) {
  return (
    <View className="mb-4 flex-row items-start gap-2 rounded-xl bg-amber-50 px-4 py-3">
      <Ionicons
        name="warning-outline"
        size={18}
        color="#d97706"
        style={{ marginTop: 1 }}
      />
      <Text className="flex-1 text-sm text-amber-800">{message}</Text>
    </View>
  );
}
