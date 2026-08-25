// Number formatting keyed by series unit, shared by y-axis labels, waypoint
// values, and (once Phase 4 builds it) annotation labels -- one place to
// change how a percent or a thousands-of-persons count reads on screen,
// instead of a "%" baked into makeWaypoints and a "/1000 + M" baked into
// TwoLineChartBody's axis code.
export type Unit = "percent" | "pp" | "ratio" | "thousands" | "dollars" | "index" | "count";

// Full label: what a waypoint callout or an annotation shows -- always
// includes the unit, since it stands alone on the frame.
export function fmt(unit: Unit, value: number, decimals: number): string {
  switch (unit) {
    case "percent":
      return `${value.toFixed(decimals)}%`;
    case "pp": {
      const sign = value > 0 ? "+" : "";
      return `${sign}${value.toFixed(decimals)}pp`;
    }
    case "ratio":
      return value.toFixed(decimals);
    case "thousands":
      return `${(value / 1000).toFixed(decimals)}M`;
    case "dollars":
      return `$${value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
    case "index":
      return value.toFixed(decimals);
    case "count":
      return value.toLocaleString("en-US", { maximumFractionDigits: decimals });
  }
}

// Axis label: bare numbers for units where the axis title already says what
// they are (percent/pp/ratio/index) -- adding "%" to every one of 3-4
// gridlines is chartjunk when the composition's subtitle already says
// "percent". Units where the raw magnitude is ambiguous without a suffix
// (thousands, dollars) keep it on the axis too.
export function fmtAxis(unit: Unit, value: number): string {
  switch (unit) {
    case "percent":
    case "pp":
    case "ratio":
    case "index":
      return `${value}`;
    case "thousands":
      return `${value / 1000}M`;
    case "dollars":
      return `$${value.toLocaleString("en-US")}`;
    case "count":
      return value.toLocaleString("en-US");
  }
}
