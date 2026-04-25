import { CardState } from "../db/types";

export function getMemorizationChip(
  state: number,
  t: (key: string) => string,
): {
  label: string;
  bg: string;
  fg: string;
} {
  switch (state) {
    case CardState.Review:
      return { label: t("state_mature"), bg: "bg-memo-success-soft", fg: "text-memo-success" };
    case CardState.Learning:
    case CardState.Relearning:
      return { label: t("state_learning"), bg: "bg-memo-accent-soft", fg: "text-memo-accent" };
    case CardState.New:
    default:
      return { label: t("state_new"), bg: "bg-memo-surface-alt", fg: "text-memo-ink-soft" };
  }
}
