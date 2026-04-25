import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "./Button";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  onPress?: () => void;
}

export function StatCard({
  label,
  value,
  icon,
  iconColor = "#3B6FE5",
  onPress,
}: StatCardProps) {
  const content = (
    <View className="w-full items-start">
      <View className="flex-row items-center gap-1.5">
        <Ionicons name={icon} size={14} color={iconColor} />
        <Text className="text-[11px] font-medium uppercase tracking-widest text-memo-ink-muted">
          {label}
        </Text>
      </View>
      <Text className="mt-2 text-[48px] font-light leading-none text-memo-ink">
        {value}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <Button
        variant="ghost"
        className="flex-1 items-start rounded-[22px] border border-memo-line bg-memo-surface p-5"
        onPress={onPress}
      >
        {content}
      </Button>
    );
  }

  return (
    <View className="flex-1 rounded-[22px] border border-memo-line bg-memo-surface p-5">
      {content}
    </View>
  );
}
