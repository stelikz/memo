import { Text, View } from "react-native";

interface SectionHeaderProps {
  title: string;
  right?: React.ReactNode;
}

export function SectionHeader({ title, right }: SectionHeaderProps) {
  return (
    <View className="mb-3 flex-row items-center justify-between">
      <Text className="text-[13px] font-semibold uppercase tracking-widest text-memo-ink-muted">
        {title}
      </Text>
      {right}
    </View>
  );
}
