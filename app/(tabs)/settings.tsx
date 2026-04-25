import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";

import { useLocale } from "../../i18n";
import { useSettingsStore } from "../../stores/settings";
import { DropdownMenu } from "../../components/DropdownMenu";
import { db } from "../../db/client";
import {
  getAllCardsForExport,
  resetAllProgress,
} from "../../db/queries";
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
  label,
  description,
  right,
  onPress,
  labelColor,
  chevron,
  disabled,
}: {
  label: string;
  description?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  labelColor?: string;
  chevron?: boolean;
  disabled?: boolean;
}) {
  const content = (
    <View
      className="flex-row items-center gap-2.5 px-[18px] py-3.5"
      style={{
        borderTopWidth: 0.5,
        borderTopColor: "rgba(21,24,31,0.08)",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <View className="mr-2 flex-1">
        <Text
          className="text-[15px] text-memo-ink"
          style={labelColor ? { color: labelColor } : undefined}
        >
          {label}
        </Text>
        {description ? (
          <Text className="mt-1 text-[13px] leading-[18px] text-memo-ink-muted">
            {description}
          </Text>
        ) : null}
      </View>
      {right}
      {chevron && (
        <Ionicons name="chevron-forward" size={14} color="#8A8F9A" />
      )}
    </View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
  }
  return content;
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <View className="overflow-hidden rounded-2xl border border-memo-line bg-memo-surface">
      {children}
    </View>
  );
}

const REVIEW_LIMIT_OPTIONS = [5, 10, 15, 20, 30, 50, 0] as const;

// ── Main screen ─────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const t = useLocale();

  const reminderEnabled = useSettingsStore((s) => s.reminderEnabled);
  const reminderTime = useSettingsStore((s) => s.reminderTime);
  const showNativeByDefault = useSettingsStore((s) => s.showNativeByDefault);
  const targetLanguage = useSettingsStore((s) => s.targetLanguage);
  const dailyReviewLimit = useSettingsStore((s) => s.dailyReviewLimit);
  const setSetting = useSettingsStore((s) => s.setSetting);
  const setShowNativeByDefault = useSettingsStore(
    (s) => s.setShowNativeByDefault,
  );

  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleReminderToggle = async (value: boolean) => {
    setSetting("reminder_enabled", value ? "true" : "false");
    if (value) {
      const granted = await requestPermissions();
      if (!granted) {
        setSetting("reminder_enabled", "false");
        Alert.alert("", t("notifications_denied"));
        return;
      }
      await scheduleDailyReminder(reminderTime);
    } else {
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

  const limitDropdownOptions = REVIEW_LIMIT_OPTIONS.map((v) => ({
    value: String(v),
    label: v === 0 ? t("unlimited") : String(v),
  }));

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
    <SafeAreaView className="flex-1 bg-memo-bg" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-[18px] pb-8"
        showsVerticalScrollIndicator={false}
      >
        <Text className="mb-6 mt-2 text-[36px] font-light text-memo-ink">
          {t("settings")}
        </Text>

        {/* ── Preferences ──────────────────────────────────────────────── */}
        <Text className="mb-2 px-1.5 text-[11px] font-semibold uppercase tracking-widest text-memo-ink-muted">
          {t("preferences")}
        </Text>
        <SectionCard>
          <SettingRow
            label={t("show_native_by_default")}
            description={t("show_native_by_default_desc")}
            right={
              <Switch
                value={showNativeByDefault}
                onValueChange={setShowNativeByDefault}
                trackColor={{ false: "rgba(21,24,31,0.16)", true: "#93c5fd" }}
                thumbColor={showNativeByDefault ? "#3B6FE5" : "#f4f4f5"}
              />
            }
          />
          <SettingRow
            label={t("target_language")}
            onPress={() => setShowLanguagePicker(!showLanguagePicker)}
            right={
              <View className="flex-row items-center">
                <Text className="mr-1 text-sm text-memo-ink-soft">
                  {currentLangLabel}
                </Text>
                <Ionicons
                  name={showLanguagePicker ? "chevron-up" : "chevron-down"}
                  size={16}
                  color="#8A8F9A"
                />
              </View>
            }
          />
          {showLanguagePicker && (
            <View className="mx-[18px] mb-3 rounded-xl bg-memo-bg p-1">
              {languages.map((lang) => {
                const isSelected = lang.code === targetLanguage;
                return (
                  <Pressable
                    key={lang.code}
                    className={`flex-row items-center justify-between rounded-lg px-3 py-2.5 ${isSelected ? "bg-memo-accent-soft" : ""}`}
                    onPress={() => handleLanguageSelect(lang.code)}
                  >
                    <Text
                      className={`text-base ${isSelected ? "font-semibold text-memo-accent" : "text-memo-ink"}`}
                    >
                      {lang.nativeName}
                    </Text>
                    <Text className="text-sm text-memo-ink-muted">
                      {lang.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          <SettingRow
            label={t("daily_review_limit")}
            description={t("daily_review_limit_desc")}
            right={
              <DropdownMenu
                options={limitDropdownOptions}
                selected={String(dailyReviewLimit)}
                onSelect={(v) => setSetting("daily_review_limit", v)}
              >
                <View className="flex-row items-center">
                  <Text className="mr-1 text-sm text-memo-ink-soft">
                    {dailyReviewLimit === 0 ? t("unlimited") : String(dailyReviewLimit)}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#8A8F9A" />
                </View>
              </DropdownMenu>
            }
          />
        </SectionCard>

        {/* ── Reminders ────────────────────────────────────────────────── */}
        <Text className="mb-2 mt-7 px-1.5 text-[11px] font-semibold uppercase tracking-widest text-memo-ink-muted">
          {t("reminders")}
        </Text>
        <SectionCard>
          <SettingRow
            label={t("daily_reminder")}
            description={t("daily_reminder_desc")}
            right={
              <Switch
                value={reminderEnabled}
                onValueChange={handleReminderToggle}
                trackColor={{ false: "rgba(21,24,31,0.16)", true: "#93c5fd" }}
                thumbColor={reminderEnabled ? "#3B6FE5" : "#f4f4f5"}
              />
            }
          />
          {reminderEnabled && (
            <>
              <SettingRow
                label={t("reminder_time")}
                onPress={() => setShowTimePicker(true)}
                right={
                  <Text className="text-sm text-memo-accent font-mono">
                    {formatTime(reminderTime)}
                  </Text>
                }
                chevron
              />
              {showTimePicker && (
                <DateTimePicker
                  value={timeStringToDate(reminderTime)}
                  mode="time"
                  display="spinner"
                  is24Hour={false}
                  onChange={handleTimeChange}
                />
              )}
            </>
          )}
        </SectionCard>

        {/* ── Data ─────────────────────────────────────────────────────── */}
        <Text className="mb-2 mt-7 px-1.5 text-[11px] font-semibold uppercase tracking-widest text-memo-ink-muted">
          {t("data")}
        </Text>
        <SectionCard>
          <SettingRow
            label={t("export_data")}
            description={t("export_data_desc")}
            onPress={handleExport}
            chevron
          />
        </SectionCard>

        {/* ── Danger zone ──────────────────────────────────────────────── */}
        <Text className="mb-2 mt-7 px-1.5 text-[11px] font-semibold uppercase tracking-widest text-memo-ink-muted">
          {t("danger_zone")}
        </Text>
        <SectionCard>
          <SettingRow
            label={t("reset_progress")}
            labelColor="#D85D5D"
            onPress={handleResetProgress}
            chevron
          />
        </SectionCard>

        <Text className="mt-8 text-center text-[12px] text-memo-ink-muted">
          Mémo · v1.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
