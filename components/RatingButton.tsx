import { useState } from "react";
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
  disabled,
  onPressIn,
  onPressOut,
  ...rest
}: RatingButtonProps) {
  const [pressed, setPressed] = useState(false);

  const base = "flex-1 items-center rounded-xl border px-2 py-3";
  const bg = disabled
    ? "bg-gray-100 border-gray-200"
    : pressed
      ? pressedContainerStyles[rating]
      : containerStyles[rating];

  return (
    <Pressable
      className={`${base} ${bg} ${className ?? ""}`}
      disabled={disabled}
      onPressIn={(e) => {
        setPressed(true);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        onPressOut?.(e);
      }}
      {...rest}
    >
      <Text
        className={`text-sm font-semibold ${disabled ? "text-gray-400" : labelStyles[rating]}`}
      >
        {label}
      </Text>
      {subtitle && (
        <Text
          className={`mt-0.5 text-xs ${disabled ? "text-gray-300" : subtitleStyles[rating]}`}
        >
          {subtitle}
        </Text>
      )}
    </Pressable>
  );
}
