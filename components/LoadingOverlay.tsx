import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface LoadingOverlayProps {
  word: string;
  steps: string[];
}

const STEP_INTERVAL_MS = 1100;

export function LoadingOverlay({ word, steps }: LoadingOverlayProps) {
  const [activeStep, setActiveStep] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (steps.length <= 1) return;
    timerRef.current = setInterval(() => {
      setActiveStep((prev) => Math.min(prev + 1, steps.length - 1));
    }, STEP_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [steps.length]);

  useEffect(() => {
    if (activeStep >= steps.length - 1 && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [activeStep, steps.length]);

  return (
    <View className="flex-1 justify-center px-8 pb-20">
      <View className="mb-7 flex-row items-center gap-2.5">
        <View className="h-8 w-8 items-center justify-center rounded-full bg-memo-accent">
          <Ionicons name="sparkles" size={18} color="#FFFFFF" />
        </View>
        <Text className="text-[13px] uppercase tracking-wider text-memo-ink-soft">
          Memo is thinking
        </Text>
      </View>

      <Text className="text-[32px] font-light leading-tight text-memo-ink">
        Hand-crafting your card…
      </Text>
      <Text className="mt-2.5 text-sm leading-relaxed text-memo-ink-soft">
        Just a moment. We're checking how{" "}
        <Text className="font-semibold">{word}</Text> lives in real context.
      </Text>

      <View className="mt-8 gap-3">
        {steps.map((step, i) => (
          <View
            key={step}
            className="flex-row items-center gap-3"
            style={{ opacity: i <= activeStep ? 1 : 0.3 }}
          >
            <View
              className={`h-[18px] w-[18px] items-center justify-center rounded-full ${
                i < activeStep
                  ? "bg-memo-success"
                  : i === activeStep
                    ? "bg-memo-accent"
                    : "bg-memo-surface-alt border border-memo-line-strong"
              }`}
            >
              {i < activeStep && (
                <Ionicons name="checkmark" size={11} color="#FFFFFF" />
              )}
            </View>
            <Text
              className={`text-[15px] text-memo-ink ${i === activeStep ? "font-medium" : ""}`}
            >
              {step}
              {i === activeStep && "…"}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
