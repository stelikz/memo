import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";

interface LoadingOverlayProps {
  word: string;
  steps: string[];
}

const STEP_INTERVAL_MS = 2200;

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

  // Stop the interval once all steps are revealed
  useEffect(() => {
    if (activeStep >= steps.length - 1 && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [activeStep, steps.length]);

  return (
    <View className="flex-1 items-center justify-center px-8">
      <ActivityIndicator size="large" color="#2563eb" />
      <Text className="mt-6 text-xl font-bold text-gray-900">{word}</Text>
      <View className="mt-8 w-full">
        {steps.map((step, i) => (
          <View key={step} className="mb-3 flex-row items-center gap-3">
            <View
              className={`h-2 w-2 rounded-full ${
                i < activeStep
                  ? "bg-green-500"
                  : i === activeStep
                    ? "bg-blue-500"
                    : "bg-gray-300"
              }`}
            />
            <Text
              className={`text-sm ${
                i <= activeStep ? "font-medium text-gray-900" : "text-gray-400"
              }`}
            >
              {step}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
