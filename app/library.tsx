import { memo, useCallback, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
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

function getStateBadge(
  state: number,
  t: (key: string) => string,
): { label: string; color: string; bg: string } {
  switch (state) {
    case CardState.New:
      return {
        label: t("state_new"),
        color: "text-blue-700",
        bg: "bg-blue-100",
      };
    case CardState.Learning:
    case CardState.Relearning:
      return {
        label: t("state_learning"),
        color: "text-amber-700",
        bg: "bg-amber-100",
      };
    case CardState.Review:
      return {
        label: t("state_mature"),
        color: "text-green-700",
        bg: "bg-green-100",
      };
    default:
      return {
        label: t("state_new"),
        color: "text-blue-700",
        bg: "bg-blue-100",
      };
  }
}

// ── Row component (memoized to avoid full-list re-renders on selection) ────

type CardRow = ReturnType<typeof getLibraryCards>[number];

interface LibraryRowProps {
  item: CardRow;
  selectMode: boolean;
  isSelected: boolean;
  t: (key: string) => string;
  onPress: (id: string) => void;
  onLongPress: (id: string) => void;
}

const LibraryRow = memo(function LibraryRow({
  item,
  selectMode,
  isSelected,
  t,
  onPress,
  onLongPress,
}: LibraryRowProps) {
  const badge = getStateBadge(item.state, t);

  return (
    <Button
      variant="ghost"
      className="flex-row items-center bg-white px-4 py-3"
      onPress={() => onPress(item.id)}
      onLongPress={() => onLongPress(item.id)}
    >
      {selectMode && (
        <View className="mr-3">
          <Ionicons
            name={isSelected ? "checkbox" : "square-outline"}
            size={22}
            color={isSelected ? "#2563eb" : "#9ca3af"}
          />
        </View>
      )}

      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="text-base font-semibold text-gray-900">
            {item.lemma}
          </Text>
          <Text className="text-xs text-gray-400">{item.partOfSpeech}</Text>
          {item.totalCommonMeanings > 1 && (
            <View className="rounded bg-amber-100 px-1.5 py-0.5">
              <Text className="text-[10px] font-medium text-amber-700">
                {item.totalCommonMeanings} {t("meanings_short")}
              </Text>
            </View>
          )}
        </View>
        <Text className="mt-0.5 text-sm text-gray-500" numberOfLines={1}>
          {item.primaryDefinitionTarget}
        </Text>
      </View>

      <View className="items-end gap-1">
        <View className={`rounded-full px-2 py-0.5 ${badge.bg}`}>
          <Text className={`text-[10px] font-semibold ${badge.color}`}>
            {badge.label}
          </Text>
        </View>
        {item.isSuspended === 1 && (
          <View className="rounded-full bg-gray-200 px-2 py-0.5">
            <Text className="text-[10px] font-semibold text-gray-500">
              {t("suspended")}
            </Text>
          </View>
        )}
      </View>
    </Button>
  );
});

function ItemSeparator() {
  return <View className="h-px bg-gray-100" />;
}

// ── Screen ──────────────────────────────────────────────────────────────────

export default function LibraryScreen() {
  const t = useLocale();
  const router = useRouter();

  const [allCards, setAllCards] = useState<CardRow[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [sort, setSort] = useState<LibrarySort>("newest");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [sortButtonY, setSortButtonY] = useState(0);

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

  // ── Row handlers (stable refs for memoized row) ─────────────────────────

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

  const handleSortButtonLayout = useCallback((e: LayoutChangeEvent) => {
    setSortButtonY(e.nativeEvent.layout.y + e.nativeEvent.layout.height);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      <View className="flex-row items-center justify-between px-5 pb-2 pt-3">
        <View className="flex-row items-center b">
          <Button
            variant="ghost"
            className="mr-3 items-center justify-center bg-transparent"
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={22} color="#6b7280" />
          </Button>
          <Text className="text-lg font-medium text-gray-900">
            {t("my_words")}
          </Text>
          <Text className="ml-2 text-sm text-gray-400">{filteredCount}</Text>
        </View>

        <Button
          variant="ghost"
          className="rounded-lg px-3 py-1.5"
          onPress={selectMode ? exitSelectMode : enterSelectMode}
        >
          <Text className="text-sm font-semibold text-blue-600">
            {t(selectMode ? "cancel" : "select")}
          </Text>
        </Button>
      </View>

      <View className="mx-5 mb-3 flex-row items-center rounded-xl bg-white px-3 py-2">
        <Ionicons name="search-outline" size={18} color="#9ca3af" />
        <TextInput
          className="ml-2 flex-1 text-base text-gray-900"
          placeholder={t("search_words")}
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>

      <View className="mb-2 flex-row gap-2 px-5">
        {FILTERS.map((f) => (
          <Button
            key={f.key}
            variant={filter === f.key ? "primary" : "secondary"}
            className="rounded-full px-3 py-1.5"
            onPress={() => setFilter(f.key)}
          >
            <Text
              className={`text-xs font-semibold ${
                filter === f.key ? "text-white" : "text-gray-600"
              }`}
            >
              {t(f.labelKey)}
            </Text>
          </Button>
        ))}
      </View>

      <View
        className="mb-2 flex-row items-center justify-between bg-white px-5"
        onLayout={handleSortButtonLayout}
      >
        {selectMode ? (
          <Button
            variant="ghost"
            className="flex-row items-center gap-1 rounded-lg px-2 py-1 bg-white"
            onPress={toggleSelectAll}
          >
            <Ionicons
              name={allSelected ? "checkbox" : "square-outline"}
              size={18}
              color={allSelected ? "#2563eb" : "#9ca3af"}
            />
            <Text className="text-sm text-gray-600">{t("select_all")}</Text>
          </Button>
        ) : null}

        <Button
          variant="ghost"
          className="flex-row items-center gap-1 rounded-lg px-2 py-1 bg-white"
          onPress={() => setShowSortMenu(!showSortMenu)}
        >
          <Text className="text-xs text-gray-400">
            {t("sorted_by")}{" "}
            <Text className="text-xs text-blue-500">
              {t(SORTS.find((s) => s.key === sort)!.labelKey)}
            </Text>
          </Text>
        </Button>
      </View>

      {showSortMenu && (
        <View
          className="absolute left-5 z-50 rounded-xl bg-white py-1 shadow-lg"
          style={{ top: sortButtonY }}
        >
          {SORTS.map((s) => (
            <Button
              key={s.key}
              variant="ghost"
              className={`px-4 bg-white${sort === s.key ? "bg-blue-50" : ""}`}
              onPress={() => {
                setSort(s.key);
                setShowSortMenu(false);
              }}
            >
              <Text
                className={`text-sm ${
                  sort === s.key
                    ? "font-semibold text-blue-600"
                    : "text-gray-700"
                }`}
              >
                {t(s.labelKey)}
              </Text>
            </Button>
          ))}
        </View>
      )}

      {selectMode && selectedCount > 0 && (
        <View className="mx-5 mb-2">
          <Text className="text-sm font-medium text-blue-600">
            {t("selected_count").replace("{{count}}", String(selectedCount))}
          </Text>
        </View>
      )}

      <FlatList
        data={allCards}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={ItemSeparator}
        contentContainerClassName="pb-24"
        ListEmptyComponent={
          <EmptyState
            icon="search-outline"
            title={t("no_words_found")}
            subtitle={t("try_different_search")}
          />
        }
      />

      {selectMode && selectedCount > 0 && (
        <View className="absolute bottom-0 left-0 right-0 border-t border-gray-200 bg-white px-5 pb-8 pt-3">
          <View className="flex-row gap-3">
            <Button
              variant="secondary"
              className="flex-1 flex-row items-center justify-center gap-2 py-3"
              onPress={handleResetProgress}
            >
              <Ionicons name="refresh-outline" size={18} color="#374151" />
              <Text className="text-sm font-semibold text-gray-700">
                {t("reset_progress_action")}
              </Text>
            </Button>
            <Button
              variant="secondary"
              className="flex-1 flex-row items-center justify-center gap-2 py-3"
              onPress={handleSuspend}
            >
              <Ionicons name="pause-outline" size={18} color="#374151" />
              <Text className="text-sm font-semibold text-gray-700">
                {t("suspend_action")}
              </Text>
            </Button>
            <Button
              variant="danger"
              className="flex-1 flex-row items-center justify-center gap-2 py-3"
              onPress={handleDelete}
            >
              <Ionicons name="trash-outline" size={18} color="#ffffff" />
              <Text className="text-sm font-semibold text-white">
                {t("delete_action")}
              </Text>
            </Button>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
