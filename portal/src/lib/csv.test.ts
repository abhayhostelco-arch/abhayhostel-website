import { describe, expect, it } from "vitest";
import { safeCsvCell, toCsv } from "@/lib/csv";

describe("CSV output", () => {
  it.each(["=1+1", "+SUM(A1:A2)", "-2+3", "@cmd", "\tformula", "\rformula"])(
    "neutralizes formula prefix %s",
    (payload) => expect(safeCsvCell(payload)).toBe(`"'${payload}"`),
  );

  it("quotes delimiters and emits a UTF-8 BOM", () => {
    expect(toCsv([["name", "note"], ["A", "hello, \"world\""]])).toBe(
      '\uFEFF"name","note"\r\n"A","hello, ""world"""',
    );
  });
});
