# TODOS

Items captured here are deferred — not forgotten. Each entry has enough context to be picked up in 3 months.

---

## Click analytics on booking buttons

**What:** Instrument the 携程 / 飞猪 / 同程 buttons in RecommendCard to log which platform the user taps.

**Why:** The success metric for the multi-platform deep link feature is ">20% of users click a non-Ctrip button." Without click tracking, this metric is literally unmeasurable. The feature ships blind.

**How:** Simplest implementation: Vercel Analytics `va('event', { platform: '飞猪', type: 'flight' })` on each anchor `onClick`. No backend needed — Vercel Analytics is already in the stack.

**Context:** The 3-platform deep link feature shipped 2026-03-26. This is the only blocker to making the success metric real. Data from this informs whether to invest in Skyscanner or other API integrations next.

**Depends on:** Nothing — can be done now.

---

## Skyscanner integration (deferred)

**What:** Add Skyscanner as a 4th booking platform for international routes.

**Why:** Skyscanner has strong international coverage and is familiar to internationally-minded users.

**Context:** Deferred pending demand evidence. As of 2026-03-26 the 3-platform setup (携程/飞猪/同程) covers domestic and major international routes via Ctrip. The CITY_TO_IATA map is already implemented in `lib/booking.ts` — Skyscanner deep links would reuse it. The main open question is Chinese brand recognition ("天巡" vs Skyscanner).

**Depends on:** Analytics data showing >20% non-Ctrip clicks, particularly on international routes.
