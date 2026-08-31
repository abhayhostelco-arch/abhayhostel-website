export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "abhay-hostel-theme";
export const LIGHT_THEME_COLOR = "#f5f7fa";
export const DARK_THEME_COLOR = "#081f3d";

type ThemeStorage = Pick<Storage, "getItem">;

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === "dark") return "dark";
  if (preference === "light") return "light";
  return systemPrefersDark ? "dark" : "light";
}

export function readThemePreference(
  storage?: ThemeStorage,
): ThemePreference {
  try {
    const stored = (storage ?? window.localStorage).getItem(THEME_STORAGE_KEY);
    return stored === "system" || stored === "light" || stored === "dark"
      ? stored
      : "system";
  } catch {
    return "system";
  }
}

export function applyResolvedTheme(
  resolvedTheme: ResolvedTheme,
  targetDocument: Document = document,
) {
  targetDocument.documentElement.dataset.theme = resolvedTheme;
  targetDocument.documentElement.style.colorScheme = resolvedTheme;
  targetDocument
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute(
      "content",
      resolvedTheme === "dark" ? DARK_THEME_COLOR : LIGHT_THEME_COLOR,
    );
}
