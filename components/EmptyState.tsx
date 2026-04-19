import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
}

export function EmptyState({ icon, title, subtitle }: EmptyStateProps) {
  return (
    <View className="items-center justify-center py-12">
      <Ionicons name={icon} size={48} color="#d1d5db" />
      <Text className="mt-3 text-base font-medium text-gray-400">{title}</Text>
      {subtitle && (
        <Text className="mt-1 text-sm text-gray-300">{subtitle}</Text>
      )}
    </View>
  );
}
