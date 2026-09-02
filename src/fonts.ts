// Self-hosted fonts. The woff2 files live in public/fonts/, so a render never
// waits on a network request and frames are reproducible offline. Adding a
// weight means dropping the woff2 in public/fonts/ and adding a row to FACES.
import { continueRender, delayRender, staticFile } from "remotion";

const FACES: { family: string; weight: number; file: string }[] = [
  { family: "Newsreader", weight: 600, file: "fonts/newsreader-latin-600-normal.woff2" },
  { family: "Inter", weight: 500, file: "fonts/inter-latin-500-normal.woff2" },
  { family: "Inter", weight: 700, file: "fonts/inter-latin-700-normal.woff2" },
  { family: "Inter", weight: 800, file: "fonts/inter-latin-800-normal.woff2" },
  // "butter_on_espresso" theme (src/themes/). Archivo ships as a variable
  // font from Google -- one file, four @font-face declarations each with a
  // different fixed weight, same as Google's own CSS does; Chrome (which
  // Remotion renders through) matches font-weight against the variable
  // font's weight axis correctly.
  { family: "Playfair Display", weight: 800, file: "fonts/playfairdisplay-latin-800-normal.woff2" },
  { family: "Archivo", weight: 400, file: "fonts/archivo-latin-variable.woff2" },
  { family: "Archivo", weight: 600, file: "fonts/archivo-latin-variable.woff2" },
  { family: "Archivo", weight: 700, file: "fonts/archivo-latin-variable.woff2" },
  { family: "Archivo", weight: 800, file: "fonts/archivo-latin-variable.woff2" },
];

// font-display:block matters here: with `swap`, Remotion can capture a frame
// against the fallback face and the type visibly jumps mid-video.
const CSS = FACES.map(
  (f) =>
    `@font-face{font-family:'${f.family}';font-weight:${f.weight};font-style:normal;` +
    `font-display:block;src:url(${staticFile(f.file)}) format('woff2');}`
).join("\n");

if (typeof document !== "undefined" && !document.getElementById("chart-fonts")) {
  const style = document.createElement("style");
  style.id = "chart-fonts";
  style.textContent = CSS;
  document.head.appendChild(style);

  const handle = delayRender("Loading chart fonts");
  Promise.all(FACES.map((f) => document.fonts.load(`${f.weight} 48px "${f.family}"`)))
    .then(() => document.fonts.ready)
    .then(() => continueRender(handle))
    // Never hang a render on a font: fall through to the fallback stack instead.
    .catch(() => continueRender(handle));
}

export {};
