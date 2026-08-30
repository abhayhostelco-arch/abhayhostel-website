import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(
  fileURLToPath(new URL("./globals.css", import.meta.url)),
  "utf8",
);

type Theme = "light" | "dark";
type Rgba = { red: number; green: number; blue: number; alpha: number };

function declarations(source: string) {
  const result = new Map<string, string>();
  for (const match of source.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    result.set(match[1], match[2].trim());
  }
  return result;
}

function themeTokens(theme: Theme) {
  const result = new Map<string, string>();
  const rootBlocks = stylesheet.matchAll(/:root\s*\{([^{}]*)\}/g);
  for (const block of rootBlocks) {
    for (const [name, value] of declarations(block[1])) result.set(name, value);
  }

  if (theme === "dark") {
    const darkBlocks = stylesheet.matchAll(
      /html\[data-theme=["']dark["']\]\s*\{([^{}]*)\}/g,
    );
    for (const block of darkBlocks) {
      for (const [name, value] of declarations(block[1])) result.set(name, value);
    }
  }

  return result;
}

function resolveToken(
  tokens: Map<string, string>,
  name: string,
  resolving = new Set<string>(),
): string {
  if (resolving.has(name)) throw new Error(`Circular token alias: ${name}`);
  const value = tokens.get(name);
  if (!value) throw new Error(`Missing token: ${name}`);

  const nextResolving = new Set(resolving).add(name);
  return value.replace(/var\(\s*(--[\w-]+)\s*\)/g, (_, alias: string) =>
    resolveToken(tokens, alias, nextResolving),
  );
}

function parseColor(value: string): Rgba {
  const hex = value.match(/^#([\da-f]{3,8})$/i)?.[1];
  if (hex) {
    const expanded =
      hex.length === 3 || hex.length === 4
        ? [...hex].map((character) => character + character).join("")
        : hex;
    if (expanded.length !== 6 && expanded.length !== 8) {
      throw new Error(`Unsupported hex color: ${value}`);
    }
    return {
      red: Number.parseInt(expanded.slice(0, 2), 16),
      green: Number.parseInt(expanded.slice(2, 4), 16),
      blue: Number.parseInt(expanded.slice(4, 6), 16),
      alpha:
        expanded.length === 8
          ? Number.parseInt(expanded.slice(6, 8), 16) / 255
          : 1,
    };
  }

  const rgb = value.match(/^rgba?\(([^)]+)\)$/i)?.[1];
  if (!rgb) throw new Error(`Unsupported color: ${value}`);
  const channels = rgb.split(",").map((channel) => Number(channel.trim()));
  if (channels.length !== 3 && channels.length !== 4) {
    throw new Error(`Unsupported rgb color: ${value}`);
  }
  return {
    red: channels[0],
    green: channels[1],
    blue: channels[2],
    alpha: channels[3] ?? 1,
  };
}

function composite(foreground: Rgba, background: Rgba): Rgba {
  const alpha = foreground.alpha + background.alpha * (1 - foreground.alpha);
  const channel = (front: number, back: number) =>
    (front * foreground.alpha +
      back * background.alpha * (1 - foreground.alpha)) /
    alpha;

  return {
    red: channel(foreground.red, background.red),
    green: channel(foreground.green, background.green),
    blue: channel(foreground.blue, background.blue),
    alpha,
  };
}

function tokenColor(
  tokens: Map<string, string>,
  token: string,
  backdrop?: Rgba,
) {
  const color = parseColor(resolveToken(tokens, token));
  if (color.alpha === 1) return color;
  if (!backdrop) throw new Error(`Translucent ${token} requires a backdrop`);
  return composite(color, backdrop);
}

function luminance({ red, green, blue }: Rgba) {
  const linear = [red, green, blue].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrastRatio(
  tokens: Map<string, string>,
  foregroundToken: string,
  backgroundToken: string,
  backdropToken?: string,
) {
  const backdrop = backdropToken
    ? tokenColor(tokens, backdropToken)
    : undefined;
  const background = tokenColor(tokens, backgroundToken, backdrop);
  const foreground = tokenColor(tokens, foregroundToken, background);
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort(
    (a, b) => b - a,
  );
  return (lighter + 0.05) / (darker + 0.05);
}

function reducedMotionRules() {
  const bodies: string[] = [];
  const mediaPattern = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{/g;
  for (const match of stylesheet.matchAll(mediaPattern)) {
    let depth = 1;
    let cursor = (match.index ?? 0) + match[0].length;
    const start = cursor;
    while (cursor < stylesheet.length && depth > 0) {
      if (stylesheet[cursor] === "{") depth += 1;
      if (stylesheet[cursor] === "}") depth -= 1;
      cursor += 1;
    }
    bodies.push(stylesheet.slice(start, cursor - 1));
  }
  return bodies;
}

function disablesTransition(selector: string) {
  return reducedMotionRules().some((media) =>
    [...media.matchAll(/([^{}]+)\{([^{}]*)\}/g)].some((rule) => {
      const selectors = rule[1].split(",").map((part) => part.trim());
      return selectors.includes(selector) && /transition\s*:\s*none\s*;/.test(rule[2]);
    }),
  );
}

describe("semantic theme tokens", () => {
  it("keeps presentation literals out of every CSS and TSX source", () => {
    const sourceRoot = fileURLToPath(new URL("../", import.meta.url));
    const files: string[] = [];
    const visit = (directory: string) => readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (/\.(css|tsx)$/.test(entry.name)) files.push(path);
    });
    visit(sourceRoot);
    const colors = /#[\da-f]{3,8}\b|rgba?\([^)]*\)/gi;
    const offenders: string[] = [];
    for (const path of files) {
      let source = readFileSync(path, "utf8");
      if (path.endsWith("globals.css")) {
        for (const block of [
          ...source.matchAll(/(?:^|\n)(:root|html\[data-theme=["']dark["']\])\s*\{[^{}]*\}/g),
        ].slice(-2)) {
          const start = block.index ?? 0;
          source = source.slice(0, start) + " ".repeat(block[0].length) + source.slice(start + block[0].length);
        }
      }
      for (const match of source.matchAll(colors)) {
        if (match[0].toLowerCase() === "#f5f7fa" || match[0].toLowerCase() === "#081f3d") continue;
        offenders.push(`${path}:${match[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps raw color values inside the final light and dark token blocks", () => {
    const blocks = [
      ...stylesheet.matchAll(
        /(?:^|\n)(:root|html\[data-theme=["']dark["']\])\s*\{[^{}]*\}/g,
      ),
    ];
    const finalLight = blocks.filter((block) => block[1] === ":root").at(-1);
    const finalDark = blocks
      .filter((block) => block[1].startsWith("html["))
      .at(-1);
    expect(finalLight).toBeDefined();
    expect(finalDark).toBeDefined();

    let outsideTokens = stylesheet;
    for (const block of [finalDark, finalLight]) {
      if (!block || block.index === undefined) continue;
      outsideTokens =
        outsideTokens.slice(0, block.index) +
        " ".repeat(block[0].length) +
        outsideTokens.slice(block.index + block[0].length);
    }

    const rawColors = [...outsideTokens.matchAll(/#[\da-f]{3,8}\b|rgba?\([^)]*\)/gi)].map(
      (match) => {
        const line = outsideTokens.slice(0, match.index).split("\n").length;
        return `${line}: ${match[0]}`;
      },
    );
    expect(rawColors).toEqual([]);
  });

  it.each([
    [
      "light",
      {
        "--canvas": "#f5f7fa",
        "--surface": "#ffffff",
        "--surface-elevated": "#ffffff",
        "--surface-subtle": "#f8fafc",
        "--text": "#172033",
        "--heading": "#081f3d",
        "--muted": "#596779",
        "--border": "#e1e6ed",
        "--line-strong": "#c4ccd8",
        "--border-control": "#718096",
        "--focus": "#8a5b00",
      },
    ],
    [
      "dark",
      {
        "--canvas": "#0b1220",
        "--surface": "#121d2b",
        "--surface-elevated": "#182638",
        "--surface-subtle": "#1e2d3f",
        "--text": "#f4f7fa",
        "--heading": "#ffffff",
        "--muted": "#b7c2cf",
        "--border-control": "#6d8198",
        "--focus": "#f0bd5a",
      },
    ],
  ] as const)("declares the exact final %s base palette", (theme, expected) => {
    const tokens = themeTokens(theme);
    for (const [name, value] of Object.entries(expected)) {
      expect(resolveToken(tokens, name), `${theme} ${name}`).toBe(value);
    }
  });

  it.each(["light", "dark"] as const)(
    "meets AA text contrast throughout the %s surfaces",
    (theme) => {
      const tokens = themeTokens(theme);
      const opaqueSurfaces = [
        "--canvas",
        "--surface",
        "--surface-elevated",
        "--surface-subtle",
        "--chart-plot",
      ];

      for (const foreground of ["--text", "--muted"]) {
        for (const background of opaqueSurfaces) {
          expect(
            contrastRatio(tokens, foreground, background),
            `${theme} ${foreground} on ${background}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
        expect(
          contrastRatio(tokens, foreground, "--surface-glass", "--canvas"),
          `${theme} ${foreground} on composited --surface-glass`,
        ).toBeGreaterThanOrEqual(4.5);
      }

      expect(
        contrastRatio(tokens, "--tooltip-text", "--tooltip-bg"),
      ).toBeGreaterThanOrEqual(4.5);

      for (const background of opaqueSurfaces) {
        expect(
          contrastRatio(tokens, "--heading", background),
          `${theme} --heading on ${background}`,
        ).toBeGreaterThanOrEqual(3);
      }
    },
  );

  it.each(["light", "dark"] as const)(
    "keeps %s control boundaries and focus indicators visible",
    (theme) => {
      const tokens = themeTokens(theme);
      for (const foreground of ["--border-control", "--focus"]) {
        for (const background of [
          "--canvas",
          "--surface",
          "--surface-elevated",
          "--surface-subtle",
        ]) {
          expect(
            contrastRatio(tokens, foreground, background),
            `${theme} ${foreground} on ${background}`,
          ).toBeGreaterThanOrEqual(3);
        }
      }
    },
  );

  it.each(["light", "dark"] as const)(
    "keeps every %s status foreground, border, and icon distinguishable",
    (theme) => {
      const tokens = themeTokens(theme);
      for (const status of ["success", "danger", "warning", "neutral"]) {
        expect(
          contrastRatio(tokens, `--status-${status}-fg`, `--status-${status}-bg`),
          `${theme} ${status} foreground`,
        ).toBeGreaterThanOrEqual(4.5);
        for (const part of ["border", "icon"]) {
          expect(
            contrastRatio(
              tokens,
              `--status-${status}-${part}`,
              `--status-${status}-bg`,
            ),
            `${theme} ${status} ${part}`,
          ).toBeGreaterThanOrEqual(3);
        }
      }
    },
  );

  it.each(["light", "dark"] as const)(
    "keeps every %s chart mark visible on the plot",
    (theme) => {
      const tokens = themeTokens(theme);
      for (const mark of [
        "--chart-series-1",
        "--chart-series-2",
        "--chart-series-3",
        "--chart-series-4",
        "--chart-series-5",
        "--chart-series-6",
        "--chart-axis",
        "--chart-grid",
        "--chart-cursor",
      ]) {
        expect(
          contrastRatio(tokens, mark, "--chart-plot"),
          `${theme} ${mark}`,
        ).toBeGreaterThanOrEqual(3);
      }
    },
  );
});

describe("theme motion accessibility", () => {
  it.each([
    ".theme-control label",
    ".theme-control-options span",
    ".account-menu-chevron",
    ".student-overview-link",
    ".weekly-program-session-card",
  ])("disables %s transitions when reduced motion is requested", (selector) => {
    expect(disablesTransition(selector)).toBe(true);
  });
});

describe("shared action styling", () => {
  it("preserves primary, secondary, and danger button surfaces in the final cascade", () => {
    expect(stylesheet).toMatch(/\.button,\s*\.leaderboard-tabs button\[aria-selected="true"\][\s\S]*?background: var\(--action-bg\)/);
    expect(stylesheet).toMatch(/\.button-secondary\s*\{[\s\S]*?color: var\(--text\);[\s\S]*?background: var\(--surface\);[\s\S]*?border-color: var\(--line-strong\)/);
    expect(stylesheet).toMatch(/\.button-danger,[\s\S]*?\{[\s\S]*?color: var\(--status-danger-fg\);[\s\S]*?background: var\(--surface\);[\s\S]*?border-color: var\(--status-danger-border\)/);
    expect(stylesheet).toMatch(/\.recharts-default-tooltip\s*\{[\s\S]*?background: var\(--tooltip-bg\) !important/);
    expect(stylesheet).toMatch(/\.recharts-tooltip-item[\s\S]*?color: var\(--tooltip-text\) !important/);
  });
});
