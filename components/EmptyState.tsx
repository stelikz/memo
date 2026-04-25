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
      <Ionicons name={icon} size={48} color="#8A8F9A" />
      <Text className="mt-3 text-base font-medium text-memo-ink-muted">
        {title}
      </Text>
      {subtitle && (
        <Text className="mt-1 text-sm text-memo-ink-muted">{subtitle}</Text>
      )}
    </View>
  );
}
