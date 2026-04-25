import { useRef, useState } from "react";
import {
  Modal,
  Pressable,
  Text,
  View,
  type LayoutRectangle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownMenuProps {
  options: DropdownOption[];
  selected: string;
  onSelect: (value: string) => void;
  children: React.ReactNode;
  align?: "left" | "right";
}

export function DropdownMenu({
  options,
  selected,
  onSelect,
  children,
  align = "right",
}: DropdownMenuProps) {
  const [visible, setVisible] = useState(false);
  const [anchor, setAnchor] = useState<LayoutRectangle | null>(null);
  const triggerRef = useRef<View>(null);

  const measure = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setVisible(true);
    });
  };

  return (
    <>
      <Pressable onPress={measure}>
        <View ref={triggerRef} collapsable={false}>
          {children}
        </View>
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable
          className="flex-1"
          onPress={() => setVisible(false)}
        >
          {anchor && (
            <View
              className="absolute min-w-[160px] overflow-hidden rounded-xl border border-memo-line bg-memo-surface"
              style={[
                {
                  top: anchor.y + anchor.height + 6,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.12,
                  shadowRadius: 16,
                  elevation: 8,
                },
                align === "right"
                  ? { right: undefined, left: anchor.x + anchor.width - 160 }
                  : { left: anchor.x },
              ]}
            >
              {options.map((option, i) => (
                <Pressable
                  key={option.value}
                  className="flex-row items-center justify-between px-4 py-3"
                  style={
                    i > 0
                      ? {
                          borderTopWidth: 0.5,
                          borderTopColor: "rgba(21,24,31,0.08)",
                        }
                      : undefined
                  }
                  onPress={() => {
                    onSelect(option.value);
                    setVisible(false);
                  }}
                >
                  <Text
                    className={`text-sm ${
                      option.value === selected
                        ? "font-semibold text-memo-accent"
                        : "text-memo-ink"
                    }`}
                  >
                    {option.label}
                  </Text>
                  {option.value === selected && (
                    <Ionicons name="checkmark" size={16} color="#3B6FE5" />
                  )}
                </Pressable>
              ))}
            </View>
          )}
        </Pressable>
      </Modal>
    </>
  );
}
