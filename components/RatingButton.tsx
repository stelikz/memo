import { useState } from "react";
import { Text, Pressable, type PressableProps } from "react-native";

type Rating = "again" | "hard" | "good" | "easy";

interface RatingButtonProps extends Omit<PressableProps, "children"> {
  rating: Rating;
  label: string;
  subtitle?: string;
  className?: string;
}

const labelColors: Record<Rating, string> = {
  again: "#D85D5D",
  hard: "#E0A33C",
  good: "#3FA877",
  easy: "#3B6FE5",
};

const borderColors: Record<Rating, string> = {
  again: "border-memo-danger/25",
  hard: "border-memo-warn/25",
  good: "border-memo-success/25",
  easy: "border-memo-accent/25",
};

const labelStyles: Record<Rating, string> = {
  again: "text-memo-danger",
  hard: "text-memo-warn",
  good: "text-memo-success",
  easy: "text-memo-accent",
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

  const base = "flex-1 items-center rounded-[14px] border px-2 py-3 bg-memo-surface";
  const border = disabled ? "border-memo-line" : borderColors[rating];

  return (
    <Pressable
      className={`${base} ${border} ${className ?? ""}`}
      disabled={disabled}
      style={pressed ? { transform: [{ scale: 0.97 }] } : undefined}
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
        className={`text-sm font-semibold ${disabled ? "text-memo-ink-muted" : labelStyles[rating]}`}
      >
        {label}
      </Text>
      {subtitle && (
        <Text className="mt-0.5 text-[11px] text-memo-ink-muted font-mono">
          {subtitle}
        </Text>
      )}
    </Pressable>
  );
}
