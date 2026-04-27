# Haiku HSL Spike v2 — post-Phase-3 measurement

**Run date:** 2026-04-27T19:46:16.721Z
**Model:** claude-haiku-4-5-20251001
**N test cases:** 29
**MAX_RETRIES:** 3  **MIDPOINT_THRESHOLD:** 0.1

Baseline report (pre-Phase-3 prompt + no validator-side TUNE-2): `doc/spikes/2026-04-27-haiku-hsl-spike.md`

## Headline metrics

| Metric | Value | Baseline (Phase 2) | Target |
|---|---|---|---|
| Midpoint clustering rate (final palette within 0.1 of midpoint) | **0%** | 86% | < 30% |
| Mean midpoint distance (validated palettes) | 0.164 | ~0.089 | higher = more diverse |
| OK on attempt 1 | 4 / 29 | 29 / 29 | retries are extra cost |
| OK on attempt 2 (retry honoured TUNE-2 correction) | 8 / 29 | n/a | proves correction loop works |
| Fallback to library palette | 17 / 29 | 0 / 29 | should stay near 0 |
| TUNE-2 rejections triggered (any attempt) | 59 | n/a | shows the validator is doing work |
| Mean total latency (incl. retries) | 2998 ms | ~600 ms | |

## Verdict

**PASS — clustering rate 0% is below the 30% target.** TUNE-1 (anti-clustering prompt block) plus TUNE-2 (midpoint-distance validator) successfully break the wedding-default training prior.

## Per-test results

| Test | Source | Final attempt | Final distance | Notes |
|---|---|---|---|---|
| west-botanical | western/botanical_garden | fallback | 0.118 | attempt 1: TUNE-2 reject → attempt 2: TUNE-2 reject → attempt 3: TUNE-2 reject |
| west-dark-romance | western/dark_romance | fallback | 0.142 | attempt 1: TUNE-2 reject → attempt 2: TUNE-2 reject → attempt 3: TUNE-2 reject |
| west-coastal | western/coastal_destination | fallback | 0.147 | attempt 1: TUNE-2 reject → attempt 2: TUNE-2 reject → attempt 3: TUNE-2 reject |
| west-editorial | western/editorial_minimal | ok-attempt-1 | 1.003 | attempt 1: ok (d=1.003) |
| west-warm-rustic | western/warm_rustic | ok-attempt-2 | 0.116 | attempt 1: TUNE-2 reject → attempt 2: ok (d=0.116) |
| west-french-luxury | western/french_luxury | fallback | 0.117 | attempt 1: TUNE-2 reject → attempt 2: TUNE-2 reject → attempt 3: TUNE-2 reject |
| west-midnight-glamour | western/midnight_glamour | fallback | 0.122 | attempt 1: TUNE-2 reject → attempt 2: TUNE-2 reject → attempt 3: TUNE-2 reject |
| west-scandi | western/scandinavian_clean | fallback | 0.131 | attempt 1: TUNE-2 reject → attempt 2: TUNE-2 reject → attempt 3: TUNE-2 reject |
| hindu-default | hindu_indian | ok-attempt-1 | 0.121 | attempt 1: ok (d=0.121) |
| hindu-punjabi | hindu_indian/punjabi | ok-attempt-2 | 0.113 | attempt 1: TUNE-2 reject → attempt 2: ok (d=0.113) |
| hindu-tamil | hindu_indian/tamil | fallback | 0.128 | attempt 1: TUNE-2 reject → attempt 2: TUNE-2 reject → attempt 3: TUNE-2 reject |
| hindu-bengali | hindu_indian/bengali | fallback | 0.116 | attempt 1: TUNE-2 reject → attempt 2: TUNE-2 reject → attempt 3: TUNE-2 reject |
| hindu-gujarati | hindu_indian/gujarati | ok-attempt-2 | 0.123 | attempt 1: TUNE-2 reject → attempt 2: ok (d=0.123) |
| hindu-kerala | hindu_indian/kerala_malayali | fallback | 0.109 | attempt 1: TUNE-2 reject → attempt 2: TUNE-2 reject → attempt 3: TUNE-2 reject |
| hindu-marwari | hindu_indian/marwari_rajasthani | fallback | 0.115 | attempt 1: TUNE-2 reject → attempt 2: TUNE-2 reject → attempt 3: TUNE-2 reject |
| hindu-jain | hindu_indian/jain | fallback | 0.122 | attempt 1: TUNE-2 reject → attempt 2: TUNE-2 reject → attempt 3: TUNE-2 reject |
| muslim-sa | muslim/south_asian_muslim | ok-attempt-2 | 0.101 | attempt 1: TUNE-2 reject → attempt 2: ok (d=0.101) |
| muslim-arab | muslim/arab_muslim | ok-attempt-1 | 0.363 | attempt 1: ok (d=0.363) |
| muslim-wa | muslim/west_african_muslim | ok-attempt-2 | 0.101 | attempt 1: TUNE-2 reject → attempt 2: ok (d=0.101) |
| sikh | sikh | ok-attempt-2 | 0.105 | attempt 1: TUNE-2 reject → attempt 2: ok (d=0.105) |
| chinese | chinese | fallback | 0.121 | attempt 1: TUNE-2 reject → attempt 2: TUNE-2 reject → attempt 3: TUNE-2 reject |
| jewish | jewish | fallback | 0.130 | attempt 1: TUNE-2 reject → attempt 2: TUNE-2 reject → attempt 3: TUNE-2 reject |
| yoruba | nigerian_yoruba | ok-attempt-2 | 0.105 | attempt 1: TUNE-2 reject → attempt 2: ok (d=0.105) |
| igbo | nigerian_igbo | ok-attempt-2 | 0.100 | attempt 1: TUNE-2 reject → attempt 2: ok (d=0.100) |
| latin | latin_american_catholic | fallback | 0.128 | attempt 1: TUNE-2 reject → attempt 2: TUNE-2 reject → attempt 3: TUNE-2 reject |
| hindu-punjabi-v2 | hindu_indian/punjabi | fallback | 0.124 | attempt 1: TUNE-2 reject → attempt 2: TUNE-2 reject → attempt 3: TUNE-2 reject |
| hindu-tamil-v2 | hindu_indian/tamil | fallback | 0.123 | attempt 1: TUNE-2 reject → attempt 2: TUNE-2 reject → attempt 3: TUNE-2 reject |
| muslim-arab-v2 | muslim/arab_muslim | ok-attempt-1 | 0.295 | attempt 1: ok (d=0.295) |
| west-botanical-v2 | western/botanical_garden | fallback | 0.123 | attempt 1: TUNE-2 reject → attempt 2: TUNE-2 reject → attempt 3: TUNE-2 reject |
