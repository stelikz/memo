import { useCallback, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocale } from "../i18n";
import { db } from "../db/client";
import {
  getLibraryCards,
  bulkResetProgress,
  bulkSuspend,
  bulkDelete,
  type LibraryFilter,
  type LibrarySort,
} from "../db/queries";
import { CardState } from "../db/types";
import { Button } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { DropdownMenu } from "../components/DropdownMenu";

// ── Filter & Sort config ────────────────────────────────────────────────────

const FILTERS: { key: LibraryFilter; labelKey: string }[] = [
  { key: "all", labelKey: "filter_all" },
  { key: "noun", labelKey: "filter_nouns" },
  { key: "verb", labelKey: "filter_verbs" },
  { key: "adjective", labelKey: "filter_adjectives" },
  { key: "due", labelKey: "filter_due" },
];

const SORTS: { key: LibrarySort; labelKey: string }[] = [
  { key: "newest", labelKey: "sort_newest" },
  { key: "alphabetical", labelKey: "sort_alphabetical" },
  { key: "due_date", labelKey: "sort_due_date" },
];

// ── FSRS state helpers ──────────────────────────────────────────────────────

function getMemorizationChip(state: number): {
  label: string;
  bg: string;
  fg: string;
} {
  switch (state) {
    case CardState.Review:
      return { label: "Mastered", bg: "bg-memo-success-soft", fg: "text-memo-success" };
    case CardState.Learning:
    case CardState.Relearning:
      return { label: "Learning", bg: "bg-memo-accent-soft", fg: "text-memo-accent" };
    case CardState.New:
    default:
      return { label: "New", bg: "bg-memo-surface-alt", fg: "text-memo-ink-soft" };
  }
}

// ── Row component (memoized) ────────────────────────────────────────────────

type CardRow = ReturnType<typeof getLibraryCards>[number];

interface OtherMeaning {
  definition_target: string;
  definition_native: string;
  example_sentence: string;
}

interface LibraryRowProps {
  item: CardRow;
  selectMode: boolean;
  isSelected: boolean;
  t: (key: string) => string;
  onPress: (id: string) => void;
  onLongPress: (id: string) => void;
}

function LibraryRow({
  item,
  selectMode,
  isSelected,
  t,
  onPress,
  onLongPress,
}: LibraryRowProps) {
  const chip = getMemorizationChip(item.state);
  const multi = item.totalCommonMeanings > 1;
  const [expanded, setExpanded] = useState(false);

  let otherMeanings: OtherMeaning[] = [];
  if (multi) {
    try {
      otherMeanings = JSON.parse(item.otherMeaningsJson);
    } catch {}
  }

  const handlePress = () => {
    if (selectMode) {
      onPress(item.id);
    } else if (multi && otherMeanings.length > 0) {
      setExpanded((prev) => !prev);
    } else {
      onPress(item.id);
    }
  };

  return (
    <View>
      <Pressable
        className={`flex-row items-center bg-memo-surface px-4 py-3.5 ${
          expanded
            ? "rounded-t-2xl border border-b-0 border-memo-accent"
            : `rounded-2xl border ${isSelected ? "border-memo-accent" : "border-memo-line"}`
        }`}
        onPress={handlePress}
        onLongPress={() => onLongPress(item.id)}
      >
        {selectMode && (
          <Pressable className="mr-3" onPress={() => onPress(item.id)}>
            <View
              className={`h-[22px] w-[22px] items-center justify-center rounded-full border-[1.5px] ${
                isSelected
                  ? "border-memo-accent bg-memo-accent"
                  : "border-memo-line-strong bg-transparent"
              }`}
            >
              {isSelected && (
                <Ionicons name="checkmark" size={14} color="#FFFFFF" />
              )}
            </View>
          </Pressable>
        )}

        <View className="flex-1">
          <View className="flex-row items-baseline gap-2">
            <Text className="text-lg font-normal text-memo-ink">
              {item.lemma}
            </Text>
            <Text className="text-[11px] uppercase tracking-wider text-memo-ink-muted">
              {item.partOfSpeech}
            </Text>
            {item.isSuspended === 1 && (
              <View className="rounded bg-memo-warn-soft px-1.5 py-0.5">
                <Text className="text-[10px] font-medium text-memo-warn">
                  PAUSED
                </Text>
              </View>
            )}
          </View>
          {multi ? (
            <View className="mt-0.5 flex-row items-center gap-1">
              <Text className="text-[13px] font-medium text-memo-accent">
                {item.totalCommonMeanings} {t("meanings_short")}
              </Text>
              <Ionicons
                name={expanded ? "chevron-up" : "chevron-down"}
                size={12}
                color="#3B6FE5"
              />
            </View>
          ) : (
            <Text
              className="mt-0.5 text-[13px] text-memo-ink-soft"
              numberOfLines={1}
            >
              {item.primaryDefinitionTarget}
            </Text>
          )}
        </View>

        <View className="items-end gap-1">
          <View className={`rounded-full px-2.5 py-1 ${chip.bg}`}>
            <Text
              className={`text-[11px] font-semibold uppercase tracking-wider ${chip.fg}`}
            >
              {chip.label}
            </Text>
          </View>
        </View>

        {!selectMode && !multi && (
          <Ionicons
            name="chevron-forward"
            size={16}
            color="#8A8F9A"
            style={{ marginLeft: 8 }}
          />
        )}
      </Pressable>

      {/* Expanded meanings */}
      {expanded && otherMeanings.length > 0 && (
        <View className="overflow-hidden rounded-b-2xl border border-t-0 border-memo-accent bg-memo-surface">
          {otherMeanings.map((m, i) => (
            <Pressable
              key={i}
              className="flex-row items-center gap-3 px-4 py-3"
              style={
                i > 0
                  ? { borderTopWidth: 0.5, borderTopColor: "rgba(21,24,31,0.08)" }
                  : undefined
              }
              onPress={() => onPress(item.id)}
            >
              <View className="h-[22px] w-[22px] items-center justify-center rounded-full bg-memo-accent-soft">
                <Text className="text-[11px] font-semibold text-memo-accent">
                  {i + 1}
                </Text>
              </View>
              <View className="flex-1">
                <Text
                  className="text-[14px] leading-snug text-memo-ink"
                  numberOfLines={2}
                >
                  {m.definition_target}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color="#8A8F9A" />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function ItemSeparator() {
  return <View className="h-2.5" />;
}

// ── Screen ──────────────────────────────────────────────────────────────────

export default function LibraryScreen() {
  const t = useLocale();
  const router = useRouter();

  const [allCards, setAllCards] = useState<CardRow[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [sort, setSort] = useState<LibrarySort>("newest");

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const loadCards = useCallback(() => {
    const results = getLibraryCards(db, { search, filter, sort });
    setAllCards(results);
  }, [search, filter, sort]);

  useFocusEffect(
    useCallback(() => {
      loadCards();
    }, [loadCards]),
  );

  const filteredCount = allCards.length;
  const selectedCount = selectedIds.size;
  const allSelected = filteredCount > 0 && selectedCount === filteredCount;

  // ── Selection handlers ──────────────────────────────────────────────────

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allCards.map((c) => c.id)));
    }
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  const enterSelectMode = useCallback(() => {
    setSelectMode(true);
    setSelectedIds(new Set());
  }, []);

  // ── Bulk actions ────────────────────────────────────────────────────────

  function confirmBulkAction(
    titleKey: string,
    messageKey: string,
    confirmKey: string,
    confirmStyle: "default" | "destructive",
    action: (ids: string[]) => void,
  ) {
    const ids = Array.from(selectedIds);
    Alert.alert(
      t(titleKey).replace("{{count}}", String(ids.length)),
      t(messageKey),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t(confirmKey),
          style: confirmStyle,
          onPress: () => {
            action(ids);
            exitSelectMode();
            loadCards();
          },
        },
      ],
    );
  }

  function handleResetProgress() {
    confirmBulkAction(
      "confirm_reset",
      "confirm_reset_message",
      "confirm",
      "default",
      (ids) => bulkResetProgress(db, ids),
    );
  }

  function handleSuspend() {
    confirmBulkAction(
      "confirm_suspend",
      "confirm_suspend_message",
      "confirm",
      "default",
      (ids) => bulkSuspend(db, ids),
    );
  }

  function handleDelete() {
    confirmBulkAction(
      "confirm_delete",
      "confirm_delete_message",
      "delete",
      "destructive",
      (ids) => bulkDelete(db, ids),
    );
  }

  // ── Row handlers ─────────────────────────────────────────────────────────

  const handleRowPress = useCallback(
    (id: string) => {
      if (selectMode) {
        toggleSelect(id);
      } else {
        router.push(`/card-detail?id=${id}` as any);
      }
    },
    [selectMode, toggleSelect, router],
  );

  const handleRowLongPress = useCallback(
    (id: string) => {
      if (!selectMode) {
        enterSelectMode();
        toggleSelect(id);
      }
    },
    [selectMode, enterSelectMode, toggleSelect],
  );

  const renderItem = useCallback(
    ({ item }: { item: CardRow }) => (
      <LibraryRow
        item={item}
        selectMode={selectMode}
        isSelected={selectedIds.has(item.id)}
        t={t}
        onPress={handleRowPress}
        onLongPress={handleRowLongPress}
      />
    ),
    [selectMode, selectedIds, t, handleRowPress, handleRowLongPress],
  );

  return (
    <SafeAreaView className="flex-1 bg-memo-bg" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center gap-3 px-[18px] pb-3 pt-1">
        <Pressable
          className="h-9 w-9 items-center justify-center rounded-full border border-memo-line bg-memo-surface"
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={18} color="#15181F" />
        </Pressable>
        <Text className="flex-1 text-[26px] font-light text-memo-ink">
          {t("my_words")}
        </Text>
        <Pressable onPress={selectMode ? exitSelectMode : enterSelectMode}>
          <Text className="text-sm font-medium text-memo-accent">
            {t(selectMode ? "cancel" : "select")}
          </Text>
        </Pressable>
      </View>

      {/* Search */}
      <View className="mx-[18px] mb-3.5 flex-row items-center gap-2.5 rounded-[14px] border border-memo-line bg-memo-surface px-3.5 py-2.5">
        <Ionicons name="search-outline" size={18} color="#8A8F9A" />
        <TextInput
          className="flex-1 text-[15px] text-memo-ink"
          placeholder={t("search_words")}
          placeholderTextColor="#8A8F9A"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>

      {/* Filters + sort */}
      <View className="mb-3.5 flex-row items-center gap-2 px-[18px]">
        <View className="flex-1 flex-row gap-1.5">
          {FILTERS.map((f) => (
            <Pressable
              key={f.key}
              className={`rounded-full px-3.5 py-2 ${
                filter === f.key ? "bg-memo-accent" : "bg-memo-surface-alt"
              }`}
              onPress={() => setFilter(f.key)}
            >
              <Text
                className={`text-[13px] font-medium ${
                  filter === f.key ? "text-white" : "text-memo-ink-soft"
                }`}
              >
                {t(f.labelKey)}
              </Text>
            </Pressable>
          ))}
        </View>
        <DropdownMenu
          options={SORTS.map((s) => ({ value: s.key, label: t(s.labelKey) }))}
          selected={sort}
          onSelect={(value) => setSort(value as LibrarySort)}
          align="right"
        >
          <View className="h-[34px] w-9 items-center justify-center rounded-full border border-memo-line bg-memo-surface">
            <Ionicons name="swap-vertical-outline" size={16} color="#15181F" />
          </View>
        </DropdownMenu>
      </View>

      {/* Select-all bar */}
      {selectMode && (
        <Pressable
          className="mx-[18px] mb-3 flex-row items-center justify-between rounded-xl bg-memo-accent px-3.5 py-2.5"
          onPress={toggleSelectAll}
        >
          <Text className="text-[13px] font-medium text-white">
            {allSelected ? t("select_all") : t("select_all")}
          </Text>
          <Text className="text-[13px] text-white/70">
            {t("selected_count").replace("{{count}}", String(selectedCount))}
          </Text>
        </Pressable>
      )}

      {/* Word list */}
      <FlatList
        data={allCards}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={ItemSeparator}
        contentContainerClassName="px-[18px] pb-24"
        ListEmptyComponent={
          <EmptyState
            icon="search-outline"
            title={t("no_words_found")}
            subtitle={t("try_different_search")}
          />
        }
      />

      {/* Bulk action bar */}
      {selectMode && selectedCount > 0 && (
        <View
          className="absolute bottom-24 left-[18px] right-[18px] flex-row gap-1.5 rounded-[18px] border border-memo-line bg-memo-surface p-2.5"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.12,
            shadowRadius: 32,
            elevation: 8,
          }}
        >
          <Pressable
            className="flex-1 items-center gap-1 rounded-xl py-2.5"
            onPress={handleSuspend}
          >
            <Ionicons name="pause-outline" size={20} color="#15181F" />
            <Text className="text-[11px] font-medium text-memo-ink">
              {t("suspend_action")}
            </Text>
          </Pressable>
          <Pressable
            className="flex-1 items-center gap-1 rounded-xl py-2.5"
            onPress={handleResetProgress}
          >
            <Ionicons name="refresh-outline" size={20} color="#15181F" />
            <Text className="text-[11px] font-medium text-memo-ink">
              {t("reset_progress_action")}
            </Text>
          </Pressable>
          <Pressable
            className="flex-1 items-center gap-1 rounded-xl py-2.5"
            onPress={handleDelete}
          >
            <Ionicons name="trash-outline" size={20} color="#D85D5D" />
            <Text className="text-[11px] font-medium text-memo-danger">
              {t("delete_action")}
            </Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}
