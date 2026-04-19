import { Text, Pressable, type PressableProps } from "react-native";

type Rating = "again" | "hard" | "good" | "easy";

interface RatingButtonProps extends Omit<PressableProps, "children"> {
  rating: Rating;
  label: string;
  subtitle?: string;
  className?: string;
}

const containerStyles: Record<Rating, string> = {
  again: "bg-red-100 border-red-200",
  hard: "bg-orange-100 border-orange-200",
  good: "bg-green-100 border-green-200",
  easy: "bg-blue-100 border-blue-200",
};

const pressedContainerStyles: Record<Rating, string> = {
  again: "bg-red-200 border-red-300",
  hard: "bg-orange-200 border-orange-300",
  good: "bg-green-200 border-green-300",
  easy: "bg-blue-200 border-blue-300",
};

const labelStyles: Record<Rating, string> = {
  again: "text-red-700",
  hard: "text-orange-700",
  good: "text-green-700",
  easy: "text-blue-700",
};

const subtitleStyles: Record<Rating, string> = {
  again: "text-red-400",
  hard: "text-orange-400",
  good: "text-green-400",
  easy: "text-blue-400",
};

export function RatingButton({
  rating,
  label,
  subtitle,
  className,
  ...rest
}: RatingButtonProps) {
  return (
    <Pressable
      className={({ pressed }) => {
        const base = "flex-1 items-center rounded-xl border px-2 py-3";
        const bg = pressed
          ? pressedContainerStyles[rating]
          : containerStyles[rating];
        return `${base} ${bg} ${className ?? ""}`;
      }}
      {...rest}
    >
      <Text className={`text-sm font-semibold ${labelStyles[rating]}`}>
        {label}
      </Text>
      {subtitle && (
        <Text className={`mt-0.5 text-xs ${subtitleStyles[rating]}`}>
          {subtitle}
        </Text>
      )}
    </Pressable>
  );
}
