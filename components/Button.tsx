import { type ReactNode, useState } from "react";
import { Text, Pressable, type PressableProps } from "react-native";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

type ButtonProps = PressableProps & {
  variant?: ButtonVariant;
  className?: string;
} & (
  | { label: string; children?: never }
  | { label?: never; children: ReactNode }
);

const containerStyles: Record<ButtonVariant, string> = {
  primary: "bg-blue-600",
  secondary: "border border-gray-300 bg-white",
  danger: "bg-red-600",
  ghost: "bg-gray-100",
};

const disabledContainerStyles: Record<ButtonVariant, string> = {
  primary: "bg-gray-300",
  secondary: "border border-gray-200 bg-gray-50",
  danger: "bg-gray-300",
  ghost: "bg-gray-100",
};

const pressedContainerStyles: Record<ButtonVariant, string> = {
  primary: "bg-blue-700",
  secondary: "border border-gray-300 bg-gray-50",
  danger: "bg-red-700",
  ghost: "bg-gray-200",
};

const textStyles: Record<ButtonVariant, string> = {
  primary: "text-white",
  secondary: "text-gray-700",
  danger: "text-white",
  ghost: "text-gray-700",
};

const disabledTextStyles: Record<ButtonVariant, string> = {
  primary: "text-gray-500",
  secondary: "text-gray-400",
  danger: "text-gray-500",
  ghost: "text-gray-400",
};

export function Button({
  label,
  children,
  variant = "primary",
  disabled,
  className,
  onPressIn,
  onPressOut,
  ...rest
}: ButtonProps) {
  const [pressed, setPressed] = useState(false);

  const base = "items-center rounded-xl py-4";
  const bg = disabled
    ? disabledContainerStyles[variant]
    : pressed
      ? pressedContainerStyles[variant]
      : containerStyles[variant];

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
      {children ?? (
        <Text
          className={`text-base font-semibold ${disabled ? disabledTextStyles[variant] : textStyles[variant]}`}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
