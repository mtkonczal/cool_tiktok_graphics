// The theme registry: one file per theme in this folder, listed here by the
// id a spec's top-level `"theme"` field names. Adding a theme means adding a
// file (copy konczal_webpage.ts's shape) and one line below -- nothing else
// in the engine needs to change to pick it up (src/compositions/LineVideo.tsx
// resolves `spec.theme` through resolveTheme, and everything downstream
// takes the resolved Theme object as a prop).
import { Theme } from "./types";
import { KONCZAL_WEBPAGE } from "./konczal_webpage";
import { BUTTER_ON_ESPRESSO } from "./butter_on_espresso";

export const THEMES: Record<string, Theme> = {
  konczal_webpage: KONCZAL_WEBPAGE,
  butter_on_espresso: BUTTER_ON_ESPRESSO,
};

export const DEFAULT_THEME_ID = "konczal_webpage";

export function resolveTheme(id?: string): Theme {
  if (!id) return THEMES[DEFAULT_THEME_ID];
  const theme = THEMES[id];
  if (!theme) {
    throw new Error(`resolveTheme: unknown theme "${id}" -- known themes: ${Object.keys(THEMES).join(", ")}`);
  }
  return theme;
}

export type { Theme, Palette, ThemeType, ThemeTypeSpec } from "./types";
