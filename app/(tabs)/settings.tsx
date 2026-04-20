import { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";

import { useLocale } from "../../i18n";
import { useSettingsStore } from "../../stores/settings";
import { db } from "../../db/client";
import {
  countAllCards,
  countMatureCards,
  getAllCardsForExport,
  resetAllProgress,
} from "../../db/queries";
import { SectionHeader } from "../../components/SectionHeader";
import {
  getAvailableLanguages,
  LANGUAGE_CONFIGS,
} from "../../config/languages";

const languages = getAvailableLanguages();
import {
  scheduleDailyReminder,
  cancelDailyReminder,
  requestPermissions,
} from "../../lib/notifications";

function timeStringToDate(time: string): Date {
  const [h, m] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function dateToTimeString(date: Date): string {
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 || 12;
  return `${displayH}:${m.toString().padStart(2, "0")} ${period}`;
}

// ── Row components ──────────────────────────────────────────────────────────

function SettingRow({
  icon,
  iconColor = "#6b7280",
  label,
  description,
  right,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  label: string;
  description?: string;
  right?: React.ReactNode;
  onPress?: () => void;
}) {
  const content = (
    <View className="flex-row items-center py-3.5">
      <View className="mr-3 h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View className="mr-3 flex-1">
        <Text className="text-base font-medium text-gray-900">{label}</Text>
        {description ? (
          <Text className="mt-0.5 text-sm text-gray-500">{description}</Text>
        ) : null}
      </View>
      {right}
    </View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
  }
  return content;
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <View className="mb-5 rounded-2xl bg-white px-4 shadow-sm">
      {children}
    </View>
  );
}

function Divider() {
  return <View className="ml-12 h-px bg-gray-100" />;
}

// ── Main screen ─────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const t = useLocale();

  const reminderEnabled = useSettingsStore((s) => s.reminderEnabled);
  const reminderTime = useSettingsStore((s) => s.reminderTime);
  const showNativeByDefault = useSettingsStore((s) => s.showNativeByDefault);
  const targetLanguage = useSettingsStore((s) => s.targetLanguage);
  const currentStreak = useSettingsStore((s) => s.currentStreak);
  const setSetting = useSettingsStore((s) => s.setSetting);
  const setShowNativeByDefault = useSettingsStore(
    (s) => s.setShowNativeByDefault,
  );

  const [totalCards, setTotalCards] = useState(0);
  const [matureCards, setMatureCards] = useState(0);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setTotalCards(countAllCards(db));
      setMatureCards(countMatureCards(db));
    }, []),
  );

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleReminderToggle = async (value: boolean) => {
    if (value) {
      const granted = await requestPermissions();
      if (!granted) {
        Alert.alert("", t("notifications_denied"));
        return;
      }
      setSetting("reminder_enabled", "true");
      await scheduleDailyReminder(reminderTime);
    } else {
      setSetting("reminder_enabled", "false");
      await cancelDailyReminder();
    }
  };

  const handleTimeChange = async (
    _event: DateTimePickerEvent,
    date?: Date,
  ) => {
    setShowTimePicker(false);
    if (!date) return;
    const newTime = dateToTimeString(date);
    if (newTime === reminderTime) return;
    setSetting("reminder_time", newTime);
    if (reminderEnabled) {
      await scheduleDailyReminder(newTime);
    }
  };

  const handleLanguageSelect = (code: string) => {
    setSetting("target_language", code);
    setShowLanguagePicker(false);
  };

  const handleExport = async () => {
    const allCards = getAllCardsForExport(db);
    if (allCards.length === 0) {
      Alert.alert("", t("export_empty"));
      return;
    }
    const json = JSON.stringify(allCards, null, 2);
    await Clipboard.setStringAsync(json);
    Alert.alert("", t("export_success"));
  };

  const handleResetProgress = () => {
    Alert.alert(t("reset_confirm_title"), t("reset_confirm_message"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("confirm"),
        style: "destructive",
        onPress: () => {
          resetAllProgress(db);
          Alert.alert("", t("reset_done"));
        },
      },
    ]);
  };

  const currentLangConfig = LANGUAGE_CONFIGS[targetLanguage];
  const currentLangLabel = currentLangConfig
    ? currentLangConfig.nativeName
    : targetLanguage;

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-8"
        showsVerticalScrollIndicator={false}
      >
        <Text className="mb-6 mt-4 text-2xl font-bold text-gray-900">
          {t("settings")}
        </Text>

        {/* ── Preferences ──────────────────────────────────────────────── */}
        <SectionHeader title={t("preferences")} />
        <SectionCard>
          <SettingRow
            icon="language-outline"
            iconColor="#8b5cf6"
            label={t("show_native_by_default")}
            description={t("show_native_by_default_desc")}
            right={
              <Switch
                value={showNativeByDefault}
                onValueChange={setShowNativeByDefault}
                trackColor={{ false: "#d1d5db", true: "#93c5fd" }}
                thumbColor={showNativeByDefault ? "#2563eb" : "#f4f4f5"}
              />
            }
          />
          <Divider />
          <SettingRow
            icon="globe-outline"
            iconColor="#2563eb"
            label={t("target_language")}
            onPress={() => setShowLanguagePicker(!showLanguagePicker)}
            right={
              <View className="flex-row items-center">
                <Text className="mr-1 text-base text-gray-500">
                  {currentLangLabel}
                </Text>
                <Ionicons
                  name={showLanguagePicker ? "chevron-up" : "chevron-down"}
                  size={16}
                  color="#9ca3af"
                />
              </View>
            }
          />
          {showLanguagePicker && (
            <View className="mb-3 ml-12 rounded-xl bg-gray-50 p-1">
              {languages.map((lang) => {
                const isSelected = lang.code === targetLanguage;
                return (
                  <Pressable
                    key={lang.code}
                    className={`flex-row items-center justify-between rounded-lg px-3 py-2.5 ${isSelected ? "bg-blue-50" : ""}`}
                    onPress={() => handleLanguageSelect(lang.code)}
                  >
                    <Text
                      className={`text-base ${isSelected ? "font-semibold text-blue-600" : "text-gray-700"}`}
                    >
                      {lang.nativeName}
                    </Text>
                    <Text className="text-sm text-gray-400">{lang.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </SectionCard>

        {/* ── Reminders ────────────────────────────────────────────────── */}
        <SectionHeader title={t("reminders")} />
        <SectionCard>
          <SettingRow
            icon="notifications-outline"
            iconColor="#f59e0b"
            label={t("daily_reminder")}
            description={t("daily_reminder_desc")}
            right={
              <Switch
                value={reminderEnabled}
                onValueChange={handleReminderToggle}
                trackColor={{ false: "#d1d5db", true: "#93c5fd" }}
                thumbColor={reminderEnabled ? "#2563eb" : "#f4f4f5"}
              />
            }
          />
          {reminderEnabled && (
            <>
              <Divider />
              <SettingRow
                icon="time-outline"
                iconColor="#f59e0b"
                label={t("reminder_time")}
                onPress={() => setShowTimePicker(true)}
                right={
                  <View className="flex-row items-center">
                    <Text className="mr-1 text-base text-gray-500">
                      {formatTime(reminderTime)}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                  </View>
                }
              />
              {showTimePicker && (
                <DateTimePicker
                  value={timeStringToDate(reminderTime)}
                  mode="time"
                  is24Hour={false}
                  onChange={handleTimeChange}
                />
              )}
            </>
          )}
        </SectionCard>

        {/* ── Data Stats ───────────────────────────────────────────────── */}
        <SectionHeader title={t("data_stats")} />
        <SectionCard>
          <SettingRow
            icon="layers-outline"
            iconColor="#2563eb"
            label={t("total_cards_stat")}
            right={
              <Text className="text-lg font-semibold text-gray-900">
                {totalCards}
              </Text>
            }
          />
          <Divider />
          <SettingRow
            icon="checkmark-circle-outline"
            iconColor="#10b981"
            label={t("mature_cards_stat")}
            right={
              <Text className="text-lg font-semibold text-gray-900">
                {matureCards}
              </Text>
            }
          />
          <Divider />
          <SettingRow
            icon="flame-outline"
            iconColor="#ef4444"
            label={t("longest_streak_stat")}
            right={
              <Text className="text-lg font-semibold text-gray-900">
                {currentStreak}
              </Text>
            }
          />
        </SectionCard>

        {/* ── Data Actions ─────────────────────────────────────────────── */}
        <SectionHeader title={t("data")} />
        <SectionCard>
          <SettingRow
            icon="download-outline"
            iconColor="#6b7280"
            label={t("export_data")}
            description={t("export_data_desc")}
            onPress={handleExport}
            right={
              <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
            }
          />
        </SectionCard>

        {/* ── Danger Zone ──────────────────────────────────────────────── */}
        <SectionHeader title={t("danger_zone")} />
        <SectionCard>
          <SettingRow
            icon="warning-outline"
            iconColor="#ef4444"
            label={t("reset_progress")}
            description={t("reset_progress_desc")}
            onPress={handleResetProgress}
            right={
              <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
            }
          />
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}
