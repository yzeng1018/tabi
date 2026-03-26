# TODOS

Items captured here are deferred — not forgotten. Each entry has enough context to be picked up in 3 months.

---

## Click analytics on booking buttons

**What:** Instrument the Ctrip / Fliggy / Skyscanner buttons in RecommendCard to log which platform the user taps.

**Why:** The success metric for the multi-platform deep link feature is ">20% of users click a non-Ctrip button." Without click tracking, this metric is literally unmeasurable. The feature ships blind.

**Pros:** Makes the success metric real. Cheap to add. Data informs whether to invest in Fliggy/Skyscanner API integration next.

**Cons:** Adds a logging dependency (Vercel Analytics, PostHog, or a custom endpoint). Minimal complexity.

**Context:** The design doc (2026-03-26) defines the 20% threshold as the signal to proceed with real API integration. Without this data, the next decision cannot be made. Simplest implementation: a `POST /api/log` endpoint or `window.va('event', ...)` call on each anchor click.

**Depends on:** Multi-platform deep links feature must ship first.

---

## Skyscanner integration (deferred)

**What:** Add Skyscanner as a 4th booking platform option for international routes.

**Why:** Skyscanner has strong international flight coverage and brand recognition among international travelers. It would extend tabi's reach beyond the 3 Chinese OTAs.

**Pros:** Covers international routes where Skyscanner has superior inventory vs Chinese OTAs. Differentiates tabi for internationally-minded users.

**Cons:** Requires CITY_TO_IATA mapping (~30+ cities, maintenance burden). Skyscanner button would only appear for international routes (domestic/international asymmetry). Chinese brand name "天巡" may not be as recognizable as the English "Skyscanner".

**Context:** Deferred from MVP because Ctrip + Fliggy + 同程 all accept Chinese city names directly, eliminating IATA complexity. Skyscanner requires IATA airport codes (e.g., SHA, KIX). If >20% of users click non-Ctrip buttons, evaluate adding Skyscanner for international routes.

**Depends on:** CITY_TO_IATA mapping implementation, demand evidence from current 3-platform setup.
