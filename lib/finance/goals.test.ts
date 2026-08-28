import { describe, expect, it } from "vitest";
import { calculateFreeToSpend, calculateGoalPace } from "./goals";

describe("R9 — free to spend", () => {
  it("available 5,000 with goals of 2,000 and 1,500 → free to spend 1,500", () => {
    const freeToSpend = calculateFreeToSpend(500_000, [
      { savedCents: 200_000, accountId: "acc1" },
      { savedCents: 150_000, accountId: "acc1" },
    ]);
    expect(freeToSpend).toBe(150_000);
  });

  it("a goal backed by an investment doesn't reduce free-to-spend", () => {
    const freeToSpend = calculateFreeToSpend(500_000, [
      { savedCents: 200_000, accountId: "acc1" },
      { savedCents: 900_000, accountId: null }, // investment-backed
    ]);
    expect(freeToSpend).toBe(300_000);
  });
});

describe("R9 — required pace", () => {
  it("target 12,000, saved 7,500, deadline in 4 months, avg contribution 1,000 → R$125 behind pace", () => {
    const pace = calculateGoalPace({
      targetCents: 1_200_000,
      currentBalanceCents: 750_000,
      targetDate: "2026-12-28",
      today: "2026-08-28",
      avgContributionCents: 100_000,
    });
    expect(pace?.requiredPaceCents).toBe(112_500);
    expect(pace?.status).toBe("behind_pace");
    expect(pace?.behindByCents).toBe(12_500);
  });

  it("avgContribution >= requiredPace is on pace", () => {
    const pace = calculateGoalPace({
      targetCents: 1_200_000,
      currentBalanceCents: 750_000,
      targetDate: "2026-12-28",
      today: "2026-08-28",
      avgContributionCents: 200_000,
    });
    expect(pace?.status).toBe("on_pace");
    expect(pace?.behindByCents).toBe(0);
  });

  it("no targetDate → no pace alert", () => {
    const pace = calculateGoalPace({
      targetCents: 1_200_000,
      currentBalanceCents: 750_000,
      targetDate: null,
      today: "2026-08-28",
      avgContributionCents: 100_000,
    });
    expect(pace).toBeNull();
  });
});
