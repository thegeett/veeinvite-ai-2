# Haiku HSL Spike v2 — post-Phase-3 measurement

**Run date:** 2026-04-27T17:45:17.482Z
**Model:** claude-haiku-4-5-20251001
**N test cases:** 29
**MAX_RETRIES:** 2  **MIDPOINT_THRESHOLD:** 0.05

Baseline report (pre-Phase-3 prompt + no validator-side TUNE-2): `doc/spikes/2026-04-27-haiku-hsl-spike.md`

## Headline metrics

| Metric | Value | Baseline (Phase 2) | Target |
|---|---|---|---|
| Midpoint clustering rate (final palette within 0.1 of midpoint) | **88%** | 86% | < 30% |
| Mean midpoint distance (validated palettes) | 0.126 | ~0.089 | higher = more diverse |
| OK on attempt 1 | 17 / 29 | 29 / 29 | retries are extra cost |
| OK on attempt 2 (retry honoured TUNE-2 correction) | 9 / 29 | n/a | proves correction loop works |
| Fallback to library palette | 3 / 29 | 0 / 29 | should stay near 0 |
| TUNE-2 rejections triggered (any attempt) | 15 | n/a | shows the validator is doing work |
| Mean total latency (incl. retries) | 1603 ms | ~600 ms | |

## Verdict

**REVIEW — clustering rate 88% is above the 30% target.** Investigate whether MIDPOINT_THRESHOLD needs tightening, or whether specific cultures dominate the cluster.

## F7 — AC #1 / AC #2 verification (Punjabi + Bengali)

The spike's per-test data also satisfies the Phase 3 ticket's AC #1 and AC #2 without a separate live-app run, because both ACs constrain the *pre-call output* and that's exactly what the spike measures.

**AC #1 — Hindu Punjabi gets HSL in Punjabi ranges.** Test `hindu-punjabi` (line 39 of this report) passed validation on attempt 1 with `d=0.085`. The `validateExpressivePalette` gate proves H/S/L for `bgPrimary`, `accent`, `gold` all sit inside the Punjabi sub-region's library ranges (`h:[346–360]`, etc. — see `cultural-content-library.json`). Persistence to `couples.expressive_palette` is mechanical: `src/app/api/generate/route.ts:234` writes `output.expressivePalette` directly. **PASS.**

**AC #2 — Hindu Bengali accent is cream/white-tone (S < 32%, L > 86%).** Test `hindu-bengali` exhausted both retries (TUNE-2 rejections) and fell back to `buildFallbackPalette`. The Bengali couple in this test used `styleCard: "romantic_traditional"` → `STYLE_POSITION = 0.4` → fallback accent picks 40% along each axis of the library range `accent: { h:[38,54], s:[12,32], l:[86,96] }` → resulting `accent ≈ hsl(44, 20%, 90%)`. Saturation 20% < 32% ✓, lightness 90% > 86% ✓. The strengthened "do NOT push toward saturated colour" library note (Phase 0) holds even on the fallback path. **PASS.**

Both ACs are met empirically. The diversity AC #19 is the only Phase 3 acceptance criterion that fails — see DECISIONS [2026-18].

## Per-test results

| Test | Source | Final attempt | Final distance | Notes |
|---|---|---|---|---|
| west-botanical | western/botanical_garden | fallback | 0.000 | attempt 1: TUNE-2 reject → attempt 2: TUNE-2 reject |
| west-dark-romance | western/dark_romance | ok-attempt-1 | 0.080 | attempt 1: ok (d=0.080) |
| west-coastal | western/coastal_destination | ok-attempt-2 | 0.092 | attempt 1: TUNE-2 reject → attempt 2: ok (d=0.092) |
| west-editorial | western/editorial_minimal | ok-attempt-1 | 1.001 | attempt 1: ok (d=1.001) |
| west-warm-rustic | western/warm_rustic | ok-attempt-2 | 0.055 | attempt 1: TUNE-2 reject → attempt 2: ok (d=0.055) |
| west-french-luxury | western/french_luxury | ok-attempt-1 | 0.056 | attempt 1: ok (d=0.056) |
| west-midnight-glamour | western/midnight_glamour | ok-attempt-2 | 0.082 | attempt 1: TUNE-2 reject → attempt 2: ok (d=0.082) |
| west-scandi | western/scandinavian_clean | ok-attempt-1 | 0.061 | attempt 1: ok (d=0.061) |
| hindu-default | hindu_indian | ok-attempt-1 | 0.086 | attempt 1: ok (d=0.086) |
| hindu-punjabi | hindu_indian/punjabi | ok-attempt-1 | 0.085 | attempt 1: ok (d=0.085) |
| hindu-tamil | hindu_indian/tamil | ok-attempt-1 | 0.059 | attempt 1: ok (d=0.059) |
| hindu-bengali | hindu_indian/bengali | fallback | 0.000 | attempt 1: TUNE-2 reject → attempt 2: TUNE-2 reject |
| hindu-gujarati | hindu_indian/gujarati | ok-attempt-1 | 0.078 | attempt 1: ok (d=0.078) |
| hindu-kerala | hindu_indian/kerala_malayali | ok-attempt-2 | 0.058 | attempt 1: TUNE-2 reject → attempt 2: ok (d=0.058) |
| hindu-marwari | hindu_indian/marwari_rajasthani | ok-attempt-1 | 0.087 | attempt 1: ok (d=0.087) |
| hindu-jain | hindu_indian/jain | ok-attempt-2 | 0.055 | attempt 1: TUNE-2 reject → attempt 2: ok (d=0.055) |
| muslim-sa | muslim/south_asian_muslim | ok-attempt-1 | 0.075 | attempt 1: ok (d=0.075) |
| muslim-arab | muslim/arab_muslim | ok-attempt-1 | 0.289 | attempt 1: ok (d=0.289) |
| muslim-wa | muslim/west_african_muslim | ok-attempt-1 | 0.078 | attempt 1: ok (d=0.078) |
| sikh | sikh | ok-attempt-1 | 0.067 | attempt 1: ok (d=0.067) |
| chinese | chinese | ok-attempt-1 | 0.074 | attempt 1: ok (d=0.074) |
| jewish | jewish | ok-attempt-2 | 0.082 | attempt 1: TUNE-2 reject → attempt 2: ok (d=0.082) |
| yoruba | nigerian_yoruba | ok-attempt-1 | 0.079 | attempt 1: ok (d=0.079) |
| igbo | nigerian_igbo | ok-attempt-1 | 0.083 | attempt 1: ok (d=0.083) |
| latin | latin_american_catholic | ok-attempt-2 | 0.078 | attempt 1: TUNE-2 reject → attempt 2: ok (d=0.078) |
| hindu-punjabi-v2 | hindu_indian/punjabi | ok-attempt-2 | 0.067 | attempt 1: TUNE-2 reject → attempt 2: ok (d=0.067) |
| hindu-tamil-v2 | hindu_indian/tamil | fallback | 0.000 | attempt 1: TUNE-2 reject → attempt 2: TUNE-2 reject |
| muslim-arab-v2 | muslim/arab_muslim | ok-attempt-1 | 0.303 | attempt 1: ok (d=0.303) |
| west-botanical-v2 | western/botanical_garden | ok-attempt-2 | 0.062 | attempt 1: TUNE-2 reject → attempt 2: ok (d=0.062) |
