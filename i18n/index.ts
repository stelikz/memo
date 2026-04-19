import { useCallback } from "react";
import { useSettingsStore } from "../stores/settings";
import { fr } from "./locales/fr";
import { en } from "./locales/en";

export type TranslateFn = (key: string) => string;

const locales: Record<string, Record<string, string>> = { fr, en };

/**
 * Returns a translation function `t(key)` that resolves UI strings
 * based on the current target language and the showNativeByDefault setting.
 *
 * When showNativeByDefault is true, the UI displays in the native language (en).
 * Otherwise it displays in the target language for immersion.
 */
export function useLocale() {
  const targetLanguage = useSettingsStore((s) => s.targetLanguage);
  const nativeLanguage = useSettingsStore((s) => s.nativeLanguage);
  const showNativeByDefault = useSettingsStore((s) => s.showNativeByDefault);

  const lang = showNativeByDefault ? nativeLanguage : targetLanguage;

  return useCallback(
    (key: string): string => {
      return locales[lang]?.[key] ?? locales.en[key] ?? key;
    },
    [lang],
  );
}
