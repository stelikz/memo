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
  primary: "bg-memo-accent",
  secondary: "border border-memo-line-strong bg-memo-surface",
  danger: "border border-memo-danger bg-transparent",
  ghost: "bg-memo-surface-alt",
};

const disabledContainerStyles: Record<ButtonVariant, string> = {
  primary: "bg-memo-surface-alt",
  secondary: "border border-memo-line bg-memo-surface-alt",
  danger: "bg-memo-surface-alt",
  ghost: "bg-memo-surface-alt",
};

const pressedContainerStyles: Record<ButtonVariant, string> = {
  primary: "bg-memo-accent opacity-90",
  secondary: "border border-memo-line-strong bg-memo-surface-alt",
  danger: "border border-memo-danger bg-memo-danger-soft",
  ghost: "bg-memo-line",
};

const textStyles: Record<ButtonVariant, string> = {
  primary: "text-white",
  secondary: "text-memo-ink",
  danger: "text-memo-danger",
  ghost: "text-memo-ink-soft",
};

const disabledTextStyles: Record<ButtonVariant, string> = {
  primary: "text-memo-ink-muted",
  secondary: "text-memo-ink-muted",
  danger: "text-memo-ink-muted",
  ghost: "text-memo-ink-muted",
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
