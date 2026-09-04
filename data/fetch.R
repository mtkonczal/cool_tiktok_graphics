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
  library(blsR)
  library(readxl)
})

args <- commandArgs(trailingOnly = TRUE)
refresh <- "--refresh" %in% args
names_arg <- setdiff(args, "--refresh")

`%||%` <- function(a, b) if (is.null(a)) b else a

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

# `frequency` gates the expected gap between consecutive dates -- "monthly"
# (default, every series before labor_share) expects 27-32 days; "quarterly"
# expects 85-95 days (calendar quarters run 90-92 days, plus slack for
# 28/29-day Februaries). Passed through from spec$frequency so a new
# non-monthly series doesn't have to fight this check to get fetched.
sanity_check <- function(name, df, frequency = "monthly") {
  d <- df$date
  if (is.unsorted(d, strictly = TRUE)) {
    stop(name, ": dates are not strictly increasing")
  }
  if (any(duplicated(d))) {
    stop(name, ": duplicate dates found")
  }
  gaps <- as.numeric(diff(d))
  gap_bounds <- if (frequency == "quarterly") c(85, 95) else c(27, 32)
  if (any(gaps < gap_bounds[1] | gaps > gap_bounds[2])) {
    stop(name, sprintf(": non-%s cadence detected (gap outside %d-%d days)", frequency, gap_bounds[1], gap_bounds[2]))
  }

  v <- df$value
  present <- !is.na(v)
  if (!any(present)) stop(name, ": every value is NA")

  trailing_n <- if (frequency == "quarterly") 4 else 12
  min_window <- if (frequency == "quarterly") 3 else 6
  last_present_idx <- max(which(present))
  window <- v[max(1, last_present_idx - trailing_n):(last_present_idx - 1)]
  window <- window[!is.na(window)]
  if (length(window) >= min_window) {
    mu <- mean(window)
    sigma <- stats::sd(window)
    last_val <- v[last_present_idx]
    if (sigma > 0 && abs(last_val - mu) > 3 * sigma) {
      message(sprintf(
        "  WARN %s: last value %.4f is > 3 SD from the trailing-%d-period mean %.4f (sd %.4f) — real, or a bad pull?",
        name, last_val, trailing_n, mu, sigma
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
  } else if (spec$source == "bls") {
    # Direct BLS public API pull (blsR), for jobs-day use when BLS has
    # published but FRED hasn't synced yet. One or more series IDs; with a
    # single id and no expr, that id's own values are used as-is (mirrors
    # "fred"). With 2+ ids, `expr` combines them exactly like "derived" does
    # for FRED -- eval'd against columns named by BLS series ID, which is
    # what blsR::get_n_series_table(..., tidy = TRUE) returns.
    ids <- unlist(spec$ids %||% spec$id)
    key <- Sys.getenv("BLS_KEY")
    if (identical(key, "")) {
      stop(name, ": BLS_KEY is not set (needed for source \"bls\")")
    }
    start_year <- if (!is.null(spec$start_year)) spec$start_year else 2010
    end_year <- as.integer(format(Sys.Date(), "%Y"))
    raw <- get_n_series_table(ids, api_key = key, start_year = start_year, end_year = end_year, tidy = TRUE)
    for (id in ids) raw[[id]] <- as.numeric(raw[[id]])
    raw$date <- as.Date(paste0(raw$year, "/", raw$month, "/", 1))
    raw <- raw[order(raw$date), ]
    df <- data.frame(date = raw$date)
    df$value <- if (!is.null(spec$expr)) {
      eval(parse(text = spec$expr), envir = raw)
    } else {
      raw[[ids[[1]]]]
    }
  } else if (spec$source == "bls_scrape") {
    # Not the BLS API -- a scraped HTML table (jobs-day/scrape_revisions.py),
    # for data the API doesn't carry (e.g. first-vs-revised CES prints). The
    # scraper writes its own CSV; this just reads one column out of it as a
    # {date, value} series. Run the scraper (or jobs-day/run_jobs_day.sh,
    # which does it for you) before fetching a "bls_scrape" series.
    csv_path <- spec$csv %||% "jobs-day/data/bls_ces_monthly_revisions.csv"
    if (!file.exists(csv_path)) {
      stop(name, ": ", csv_path, " not found -- run jobs-day/scrape_revisions.py first")
    }
    field <- spec$field
    if (is.null(field)) stop(name, ": \"bls_scrape\" source requires a \"field\"")
    rev <- read.csv(csv_path, stringsAsFactors = FALSE)
    if (!(field %in% names(rev))) {
      stop(name, ": field '", field, "' not found in ", csv_path)
    }
    df <- data.frame(date = as.Date(rev$date), value = as.numeric(rev[[field]]))
  } else if (spec$source == "bls_xlsx") {
    # A BLS news-release backup Excel table, not the pub/time.series flat-file
    # API -- for data that only exists in a release's Excel workbook (e.g.
    # labor share as an actual percentage, not the 2017=100 index the flat
    # file carries). Downloads the workbook fresh every run (vintage-stamped
    # under data/raw/, mirroring command_line_AI_projects/
    # productivity_prices_labor_share/06_labor_share_twitter.R's own pull),
    # reads one sheet, and keeps rows matching every name/value pair in
    # `filters` exactly. `date` is built from that sheet's Year/Qtr columns
    # -- this branch is quarterly-shaped by construction, not generic to any
    # cadence a future bls_xlsx series might have.
    raw_dir <- "data/raw"
    dir.create(raw_dir, showWarnings = FALSE, recursive = TRUE)
    dest <- file.path(raw_dir, sprintf("%s_%s.xlsx", name, format(Sys.Date(), "%Y-%m-%d")))
    message("  downloading ", spec$url)
    resp <- httr::GET(
      spec$url,
      httr::user_agent("mike@economicsecurityproject.org research (cool_tiktok_graphics bls_xlsx pull)"),
      httr::write_disk(dest, overwrite = TRUE)
    )
    httr::stop_for_status(resp)

    sheet_df <- as.data.frame(read_excel(dest, sheet = spec$sheet, col_types = "text"))
    sheet_df$Year <- as.integer(sheet_df$Year)
    sheet_df$Qtr <- suppressWarnings(as.integer(sheet_df$Qtr))
    sheet_df$Value <- as.numeric(sheet_df$Value)

    keep <- !is.na(sheet_df$Qtr)
    for (col in names(spec$filters)) {
      keep <- keep & !is.na(sheet_df[[col]]) & sheet_df[[col]] == spec$filters[[col]]
    }
    filtered <- sheet_df[keep, ]
    if (nrow(filtered) == 0) {
      stop(name, ": no rows matched filters ", toJSON(spec$filters, auto_unbox = TRUE), " in sheet '", spec$sheet, "' of ", dest)
    }

    df <- data.frame(
      date = as.Date(sprintf("%d-%02d-01", filtered$Year, (filtered$Qtr - 1) * 3 + 1)),
      value = filtered$Value
    )
  } else {
    stop(name, ": unknown source '", spec$source, "'")
  }

  df <- df[order(df$date), c("date", "value")]
  decimals <- if (!is.null(spec$decimals)) spec$decimals else NULL
  if (!is.null(decimals)) {
    df$value <- round(df$value, decimals)
  }

  sanity_check(name, df, spec$frequency %||% "monthly")

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
  } else if (spec$source == "derived") {
    meta$fred_inputs <- spec$inputs
    meta$expr <- spec$expr
  } else if (spec$source == "bls") {
    meta$bls_ids <- spec$ids %||% spec$id
    if (!is.null(spec$expr)) meta$expr <- spec$expr
  } else if (spec$source == "bls_scrape") {
    meta$bls_scrape_field <- spec$field
    meta$bls_scrape_csv <- spec$csv %||% "jobs-day/data/bls_ces_monthly_revisions.csv"
  } else if (spec$source == "bls_xlsx") {
    meta$bls_xlsx_url <- spec$url
    meta$bls_xlsx_sheet <- spec$sheet
    meta$bls_xlsx_filters <- spec$filters
  }
  if (!is.null(spec$frequency)) meta$frequency <- spec$frequency
  write(toJSON(meta, auto_unbox = TRUE, null = "null", digits = NA, pretty = TRUE), meta_path)

  message(sprintf("  wrote %d rows, %s to %s (last value %s on %s)",
                   nrow(df), out_dir, paste0(name, ".json"), meta$last_value, meta$last_date))
}

for (n in targets) {
  fetch_one(n, registry[[n]])
}
