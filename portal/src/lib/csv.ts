const formulaPrefix = /^[=+\-@\t\r]/;

export function safeCsvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (formulaPrefix.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function toCsv(rows: unknown[][]): string {
  return `\uFEFF${rows.map((row) => row.map(safeCsvCell).join(",")).join("\r\n")}`;
}
