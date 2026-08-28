// R9 — goals ("porquinhos"): logical reserve.
import { parseDateParts } from "./period";

export interface GoalBalance {
  savedCents: number;
  /** Only goals backed by an account subtract from free-to-spend; investment-backed goals don't (R9). */
  accountId?: string | null;
}

export function calculateFreeToSpend(availableCents: number, goals: GoalBalance[]): number {
  const reserved = goals
    .filter((g) => g.accountId != null)
    .reduce((sum, g) => sum + g.savedCents, 0);
  return availableCents - reserved;
}

function monthsBetween(today: string, targetDate: string): number {
  const a = parseDateParts(today);
  const b = parseDateParts(targetDate);
  const months = (b.year - a.year) * 12 + (b.month - a.month);
  return Math.max(1, months);
}

export interface GoalPaceInput {
  targetCents: number;
  currentBalanceCents: number;
  targetDate: string | null;
  today: string;
  /** Average of the last 3 months' GOAL_IN. */
  avgContributionCents: number;
}

export interface GoalPaceResult {
  requiredPaceCents: number;
  status: "on_pace" | "behind_pace";
  /** 0 when on pace. */
  behindByCents: number;
}

/** No targetDate → no pace alert (R9). */
export function calculateGoalPace(input: GoalPaceInput): GoalPaceResult | null {
  if (!input.targetDate) return null;

  const monthsRemaining = monthsBetween(input.today, input.targetDate);
  const requiredPaceCents = Math.round((input.targetCents - input.currentBalanceCents) / monthsRemaining);
  const onPace = input.avgContributionCents >= requiredPaceCents;

  return {
    requiredPaceCents,
    status: onPace ? "on_pace" : "behind_pace",
    behindByCents: onPace ? 0 : requiredPaceCents - input.avgContributionCents,
  };
}
