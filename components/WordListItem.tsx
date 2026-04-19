import { Text, View } from "react-native";
import { Button } from "./Button";

interface WordListItemProps {
  lemma: string;
  partOfSpeech: string;
  definition: string;
  onPress?: () => void;
}

export function WordListItem({
  lemma,
  partOfSpeech,
  definition,
  onPress,
}: WordListItemProps) {
  return (
    <Button
      variant="ghost"
      className="flex-row items-center bg-white px-4 py-3"
      onPress={onPress}
    >
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="text-base font-semibold text-gray-900">
            {lemma}
          </Text>
          <Text className="text-xs text-gray-400">{partOfSpeech}</Text>
        </View>
        <Text className="mt-0.5 text-sm text-gray-500" numberOfLines={1}>
          {definition}
        </Text>
      </View>
    </Button>
  );
}
