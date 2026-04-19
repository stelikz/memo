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
  iconColor = "#2563eb",
  onPress,
}: StatCardProps) {
  const content = (
    <>
      <View className="mb-2 h-10 w-10 items-center justify-center rounded-full bg-blue-50">
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <Text className="text-2xl font-bold text-gray-900">{value}</Text>
      <Text className="mt-0.5 text-sm text-gray-500">{label}</Text>
    </>
  );

  if (onPress) {
    return (
      <Button
        variant="ghost"
        className="flex-1 items-start rounded-2xl bg-white p-4 shadow-sm"
        onPress={onPress}
      >
        {content}
      </Button>
    );
  }

  return (
    <View className="flex-1 rounded-2xl bg-white p-4 shadow-sm">
      {content}
    </View>
  );
}
