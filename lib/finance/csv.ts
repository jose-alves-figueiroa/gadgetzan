// R15 — hand-rolled CSV parser for the batch importer. No dependency: quoted
// fields (with embedded delimiters/newlines and "" escaping), CRLF/LF, BOM
// stripping. Line numbers are tracked so validation errors can point back at
// the exact row the user sees when opening the file in a spreadsheet editor.

export interface CsvRow {
  /** 1-indexed line in the original file where this record starts. */
  line: number;
  values: Record<string, string>;
}

export interface ParsedCsv {
  headers: string[];
  rows: CsvRow[];
}

interface RawRecord {
  line: number;
  fields: string[];
}

function splitRecords(text: string, delimiter: string): RawRecord[] {
  const records: RawRecord[] = [];
  let fields: string[] = [];
  let field = "";
  let inQuotes = false;
  let line = 1;
  let recordStartLine = 1;

  const pushField = () => {
    fields.push(field);
    field = "";
  };
  const endRecord = () => {
    pushField();
    records.push({ line: recordStartLine, fields });
    fields = [];
    recordStartLine = line;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
        continue;
      }
      if (ch === "\n") line++;
      field += ch;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      pushField();
    } else if (ch === "\n") {
      line++;
      endRecord();
    } else {
      field += ch;
    }
  }

  if (field !== "" || fields.length > 0) endRecord();
  return records;
}

/** Parses `;`-delimited CSV text into a header row + data rows with line numbers. */
export function parseCsv(text: string, delimiter = ";"): ParsedCsv {
  const normalized = text.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const records = splitRecords(normalized, delimiter);
  if (records.length === 0) return { headers: [], rows: [] };

  const [headerRecord, ...dataRecords] = records;
  const headers = headerRecord.fields.map((h) => h.trim());

  const rows = dataRecords
    .filter((r) => !(r.fields.length === 1 && r.fields[0].trim() === ""))
    .map((r) => {
      const values: Record<string, string> = {};
      headers.forEach((header, index) => {
        values[header] = (r.fields[index] ?? "").trim();
      });
      return { line: r.line, values };
    });

  return { headers, rows };
}
