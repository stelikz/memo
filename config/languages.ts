export interface LanguageConfig {
  name: string;
  nativeName: string;
  grammarFields: string[];
  registerLabels: string[];
  hasGenderedNouns: boolean;
  wordBoundary: "space" | "ai_segmentation";
  ttsLocale: string;
}

export const LANGUAGE_CONFIGS: Record<string, LanguageConfig> = {
  fr: {
    name: "French",
    nativeName: "Français",
    grammarFields: ["gender", "verb_auxiliary", "is_pronominal"],
    registerLabels: ["familier", "courant", "soutenu"],
    hasGenderedNouns: true,
    wordBoundary: "space",
    ttsLocale: "fr-FR",
  },
  de: {
    name: "German",
    nativeName: "Deutsch",
    grammarFields: ["gender", "case_government", "plural_form"],
    registerLabels: ["umgangssprachlich", "standardsprachlich", "gehoben"],
    hasGenderedNouns: true,
    wordBoundary: "space",
    ttsLocale: "de-DE",
  },
  es: {
    name: "Spanish",
    nativeName: "Español",
    grammarFields: ["gender", "verb_irregularity"],
    registerLabels: ["coloquial", "estándar", "formal"],
    hasGenderedNouns: true,
    wordBoundary: "space",
    ttsLocale: "es-ES",
  },
  ja: {
    name: "Japanese",
    nativeName: "日本語",
    grammarFields: ["reading", "pitch_accent", "jlpt_level"],
    registerLabels: ["casual", "polite", "formal"],
    hasGenderedNouns: false,
    wordBoundary: "ai_segmentation",
    ttsLocale: "ja-JP",
  },
};

/**
 * Get available language codes for the target language selector.
 */
export function getAvailableLanguages() {
  return Object.entries(LANGUAGE_CONFIGS).map(([code, config]) => ({
    code,
    name: config.name,
    nativeName: config.nativeName,
  }));
}
