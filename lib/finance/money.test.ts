import { describe, expect, it } from "vitest";
import { toCents, formatBRL, centsToDecimalString } from "./money";

describe("toCents", () => {
  it("parses '1.234,56' with a thousands separator", () => {
    expect(toCents("1.234,56")).toBe(123456);
  });

  it("parses '1234,56' without a thousands separator", () => {
    expect(toCents("1234,56")).toBe(123456);
  });

  it("parses a whole-reais value with no comma", () => {
    expect(toCents("1234")).toBe(123400);
  });

  it("throws on empty input", () => {
    expect(() => toCents("")).toThrow();
  });

  it("throws on non-numeric input", () => {
    expect(() => toCents("abc")).toThrow();
  });
});

describe("formatBRL", () => {
  it("always shows cents by default", () => {
    expect(formatBRL(5990)).toBe("R$ 59,90");
  });

  it("compact mode omits .00 cents", () => {
    expect(formatBRL(1_500_000, { compact: true })).toBe("R$ 15.000");
  });

  it("compact mode still shows cents when they're non-zero", () => {
    expect(formatBRL(1_500_050, { compact: true })).toBe("R$ 15.000,50");
  });

  it("never renders negative zero (e.g. from negating an empty total)", () => {
    expect(formatBRL(-0, { compact: true })).toBe(formatBRL(0, { compact: true }));
    expect(formatBRL(-0, { compact: true })).not.toMatch(/^-/);
  });
});

describe("centsToDecimalString", () => {
  it("formats with a comma decimal and no currency symbol", () => {
    expect(centsToDecimalString(123456)).toBe("1.234,56");
  });

  it("round-trips through toCents", () => {
    expect(toCents(centsToDecimalString(91000))).toBe(91000);
  });
});
