import fs from 'node:fs';
import path from 'node:path';

export type Row = Record<string, string>;

// Reads test-data/<file> (CSVs QA provides). The first line is the header.
export function readCsv(file: string): Row[] {
  const fullPath = path.resolve(import.meta.dirname, '../../test-data', file);
  const [header, ...lines] = parseCsv(fs.readFileSync(fullPath, 'utf8'));
  if (!header) throw new Error(`test-data/${file} is empty`);
  return lines
    .filter((cells) => cells.some((cell) => cell.trim() !== ''))
    .map((cells, i) => {
      if (cells.length !== header.length) {
        throw new Error(`test-data/${file} row ${i + 2} has ${cells.length} cells, header has ${header.length}`);
      }
      return Object.fromEntries(header.map((name, j) => [name.trim(), cells[j]]));
    });
}

// Handles quoted cells, "" inside quotes, commas and line breaks in quotes, CRLF and a BOM.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
