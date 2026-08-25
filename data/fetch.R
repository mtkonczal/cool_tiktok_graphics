#!/usr/bin/env Rscript
#
# Resolve one or more names from data/series.json against FRED, write
# src/data/<name>.json (tidy [{date, value}], NA -> null) and
# src/data/<name>.meta.json (the vintage record: source, transform, fetch
# timestamp, row count, first/last date, last value).
#
# Usage:
#   Rscript data/fetch.R                 # fetch every series in the registry
#   Rscript data/fetch.R prime_epop unrate
#   Rscript data/fetch.R --refresh unrate # ignore the 7-day freshness cache

suppressPackageStartupMessages({
  library(tidyusmacro)
  library(jsonlite)
})

args <- commandArgs(trailingOnly = TRUE)
refresh <- "--refresh" %in% args
names_arg <- setdiff(args, "--refresh")

registry <- fromJSON("data/series.json", simplifyVector = FALSE)

targets <- if (length(names_arg) > 0) names_arg else names(registry)
unknown <- setdiff(targets, names(registry))
if (length(unknown) > 0) {
  stop("Unknown series in data/series.json: ", paste(unknown, collapse = ", "))
}

out_dir <- "src/data"
dir.create(out_dir, showWarnings = FALSE, recursive = TRUE)

is_stale <- function(meta_path, max_age_days = 7) {
  if (!file.exists(meta_path)) return(TRUE)
  meta <- fromJSON(meta_path, simplifyVector = FALSE)
  age <- as.numeric(difftime(Sys.time(), as.POSIXct(meta$fetched_at, format = "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"), units = "days"))
  age > max_age_days
}

sanity_check <- function(name, df) {
  d <- df$date
  if (is.unsorted(d, strictly = TRUE)) {
    stop(name, ": dates are not strictly increasing")
  }
  if (any(duplicated(d))) {
    stop(name, ": duplicate dates found")
  }
  gaps <- as.numeric(diff(d))
  if (any(gaps < 27 | gaps > 32)) {
    stop(name, ": non-monthly cadence detected (gap outside 27-32 days)")
  }

  v <- df$value
  present <- !is.na(v)
  if (!any(present)) stop(name, ": every value is NA")

  last_present_idx <- max(which(present))
  window <- v[max(1, last_present_idx - 12):(last_present_idx - 1)]
  window <- window[!is.na(window)]
  if (length(window) >= 6) {
    mu <- mean(window)
    sigma <- stats::sd(window)
    last_val <- v[last_present_idx]
    if (sigma > 0 && abs(last_val - mu) > 3 * sigma) {
      message(sprintf(
        "  WARN %s: last value %.4f is > 3 SD from the trailing-12-month mean %.4f (sd %.4f) — real, or a bad pull?",
        name, last_val, mu, sigma
      ))
    }
  }
}

fetch_one <- function(name, spec) {
  meta_path <- file.path(out_dir, paste0(name, ".meta.json"))
  if (!refresh && !is_stale(meta_path)) {
    message(sprintf("SKIP %-12s up to date (< 7 days old); pass --refresh to force", name))
    return(invisible(NULL))
  }

  message(sprintf("FETCH %-12s", name))

  if (spec$source == "fred") {
    pull_args <- list(spec$id)
    names(pull_args) <- "value"
    df <- do.call(getFRED, pull_args)
  } else if (spec$source == "derived") {
    inputs <- spec$inputs
    df <- do.call(getFRED, inputs)
    df$value <- eval(parse(text = spec$expr), envir = df)
  } else {
    stop(name, ": unknown source '", spec$source, "'")
  }

  df <- df[order(df$date), c("date", "value")]
  decimals <- if (!is.null(spec$decimals)) spec$decimals else NULL
  if (!is.null(decimals)) {
    df$value <- round(df$value, decimals)
  }

  sanity_check(name, df)

  rows <- lapply(seq_len(nrow(df)), function(i) {
    list(date = format(df$date[i], "%Y-%m-%d"), value = if (is.na(df$value[i])) NULL else df$value[i])
  })
  write(toJSON(rows, auto_unbox = TRUE, null = "null", digits = NA), file.path(out_dir, paste0(name, ".json")))

  present <- df[!is.na(df$value), ]
  meta <- list(
    name = name,
    source = spec$source,
    fetched_at = strftime(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    units = spec$units,
    decimals = decimals,
    row_count = nrow(df),
    first_date = format(min(df$date), "%Y-%m-%d"),
    last_date = format(max(present$date), "%Y-%m-%d"),
    last_value = tail(present$value, 1)
  )
  if (spec$source == "fred") {
    meta$fred_id <- spec$id
  } else {
    meta$fred_inputs <- spec$inputs
    meta$expr <- spec$expr
  }
  write(toJSON(meta, auto_unbox = TRUE, null = "null", digits = NA, pretty = TRUE), meta_path)

  message(sprintf("  wrote %d rows, %s to %s (last value %s on %s)",
                   nrow(df), out_dir, paste0(name, ".json"), meta$last_value, meta$last_date))
}

for (n in targets) {
  fetch_one(n, registry[[n]])
}
