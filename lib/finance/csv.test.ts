import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";

describe("R15 — CSV parsing", () => {
  it("parses a simple semicolon-delimited file into header + rows", () => {
    const csv = "id_externo;data;valor\nabc-1;2026-08-01;100,00\nabc-2;2026-08-02;200,50\n";
    const { headers, rows } = parseCsv(csv);

    expect(headers).toEqual(["id_externo", "data", "valor"]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ line: 2, values: { id_externo: "abc-1", data: "2026-08-01", valor: "100,00" } });
    expect(rows[1].line).toBe(3);
  });

  it("handles quoted fields containing the delimiter", () => {
    const csv = 'a;b\n"1;2";3\n';
    const { rows } = parseCsv(csv);
    expect(rows[0].values).toEqual({ a: "1;2", b: "3" });
  });

  it("handles doubled quotes as an escaped literal quote", () => {
    const csv = 'a\n"say ""hi"""\n';
    const { rows } = parseCsv(csv);
    expect(rows[0].values.a).toBe('say "hi"');
  });

  it("handles a quoted field spanning multiple lines and reports the record's start line", () => {
    const csv = 'a;b\n"linha\nquebrada";x\ndepois;y\n';
    const { rows } = parseCsv(csv);
    expect(rows[0].values).toEqual({ a: "linha\nquebrada", b: "x" });
    expect(rows[1].line).toBe(4);
  });

  it("normalizes CRLF line endings", () => {
    const csv = "a;b\r\n1;2\r\n3;4\r\n";
    const { rows } = parseCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[1].values).toEqual({ a: "3", b: "4" });
  });

  it("strips a UTF-8 BOM at the start of the file", () => {
    const csv = "﻿a;b\n1;2\n";
    const { headers } = parseCsv(csv);
    expect(headers).toEqual(["a", "b"]);
  });

  it("skips fully blank lines", () => {
    const csv = "a;b\n1;2\n\n3;4\n";
    const { rows } = parseCsv(csv);
    expect(rows).toHaveLength(2);
  });

  it("trims whitespace around header and field values", () => {
    const csv = " a ; b \n 1 ; 2 \n";
    const { headers, rows } = parseCsv(csv);
    expect(headers).toEqual(["a", "b"]);
    expect(rows[0].values).toEqual({ a: "1", b: "2" });
  });

  it("returns no rows for an empty file", () => {
    expect(parseCsv("")).toEqual({ headers: [], rows: [] });
  });
});
