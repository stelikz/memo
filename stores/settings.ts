import { create } from "zustand";
import { db } from "../db/client";
import { appSettings } from "../db/schema";

interface SettingsState {
  targetLanguage: string;
  nativeLanguage: string;
  showNativeByDefault: boolean;
  reminderEnabled: boolean;
  reminderTime: string;
  dailyReviewLimit: number;
  currentStreak: number;
  lastReviewDate: string;
  hydrated: boolean;

  hydrate: () => void;
  setSetting: (key: string, value: string) => void;
  setShowNativeByDefault: (value: boolean) => void;
  updateStreak: () => void;
}

function writeSetting(key: string, value: string) {
  db.insert(appSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value } })
    .run();
}

const BOOL_KEYS = new Set(["show_native_by_default", "reminder_enabled"]);
const INT_KEYS = new Set(["current_streak", "daily_review_limit"]);

function parseSettingValue(key: string, value: string): string | boolean | number {
  if (key === "show_native_by_default") return value === "true";
  if (key === "reminder_enabled") return value !== "false";
  if (INT_KEYS.has(key)) return parseInt(value, 10);
  return value;
}

const DB_TO_STATE: Record<string, string> = {
  target_language: "targetLanguage",
  native_language: "nativeLanguage",
  show_native_by_default: "showNativeByDefault",
  reminder_enabled: "reminderEnabled",
  reminder_time: "reminderTime",
  current_streak: "currentStreak",
  daily_review_limit: "dailyReviewLimit",
  last_review_date: "lastReviewDate",
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  targetLanguage: "fr",
  nativeLanguage: "en",
  showNativeByDefault: false,
  reminderEnabled: true,
  reminderTime: "20:00",
  dailyReviewLimit: 0,
  currentStreak: 0,
  lastReviewDate: "",
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;

    const rows = db.select().from(appSettings).all();
    const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));

    set({
      targetLanguage: s["target_language"] ?? "fr",
      nativeLanguage: s["native_language"] ?? "en",
      showNativeByDefault: s["show_native_by_default"] === "true",
      reminderEnabled: s["reminder_enabled"] !== "false",
      reminderTime: s["reminder_time"] ?? "20:00",
      dailyReviewLimit: parseInt(s["daily_review_limit"] ?? "0", 10),
      currentStreak: parseInt(s["current_streak"] ?? "0", 10),
      lastReviewDate: s["last_review_date"] ?? "",
      hydrated: true,
    });
  },

  setSetting: (key: string, value: string) => {
    writeSetting(key, value);

    const stateKey = DB_TO_STATE[key];
    if (stateKey) {
      set({ [stateKey]: parseSettingValue(key, value) } as any);
    }
  },

  setShowNativeByDefault: (value: boolean) => {
    writeSetting("show_native_by_default", value ? "true" : "false");
    set({ showNativeByDefault: value });
  },

  updateStreak: () => {
    const today = new Date().toISOString().split("T")[0];
    const { lastReviewDate, currentStreak } = get();

    if (lastReviewDate === today) return;

    const yesterday = new Date(Date.now() - 86400000)
      .toISOString()
      .split("T")[0];
    const newStreak = lastReviewDate === yesterday ? currentStreak + 1 : 1;

    writeSetting("current_streak", String(newStreak));
    writeSetting("last_review_date", today);
    set({ currentStreak: newStreak, lastReviewDate: today });
  },
}));
