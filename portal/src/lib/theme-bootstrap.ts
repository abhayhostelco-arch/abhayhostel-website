import {
  DARK_THEME_COLOR,
  LIGHT_THEME_COLOR,
  THEME_STORAGE_KEY,
} from "@/lib/theme";

export const themeBootstrapScript = `(() => {
  let preference = "system";
  try {
    const stored = window.localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    if (stored === "system" || stored === "light" || stored === "dark") {
      preference = stored;
    }
  } catch {}

  const systemPrefersDark =
    preference === "system" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolvedTheme =
    preference === "dark" || (preference === "system" && systemPrefersDark)
      ? "dark"
      : "light";

  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.style.colorScheme = resolvedTheme;
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) {
    themeColor.setAttribute(
      "content",
      resolvedTheme === "dark" ? ${JSON.stringify(DARK_THEME_COLOR)} : ${JSON.stringify(LIGHT_THEME_COLOR)},
    );
  }
})();`;
