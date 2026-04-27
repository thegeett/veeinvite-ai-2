# Haiku HSL Confidence Spike — 2026-04-27

**Phase:** PALETTE-02 (investigation, not production code)
**Model:** `claude-haiku-4-5-20251001`
**Test cases:** 29
**Total cost:** ~$0.0087

## Recommendation

### **TUNE**

Pass rate 100% is good, but 86% of passing results cluster within 0.1 of the range midpoint. Diversity will be artificially low. Add an explicit "pick at least 20% from midpoint" instruction to the prompt; consider a midpoint-distance check in the validator.

## Aggregate metrics

| Metric | Value |
|---|---|
| All-checks pass rate (format + range + font) | **100%** (29/29) |
| Format pass rate (HSL string parses) | 100% (29/29) |
| Range pass rate (within library bounds) | 100% (29/29) |
| Font approved (one of culture's allowed list) | 100% (29/29) |
| Midpoint clustering (passing results < 0.1 from midpoint) | 86% |
| Avg midpoint distance (passing results) | 0.089 |
| Avg latency per call | 1159 ms |
| Format failures | 0 |
| Range failures | 0 |
| Font failures | 0 |

## Decision-gate thresholds (from PALETTE_DIVERSITY_TICKETS.md)

| Pass rate | Recommendation |
|---|---|
| ≥ 95% on attempt 1 | SHIP |
| 80–95% | TUNE |
| < 80% | PIVOT |
| Midpoint clustering > 30% (any pass rate) | TUNE |

## Per-test results

### west-botanical — Western

- **Source:** `western/botanical_garden`
- **Style:** `romantic_traditional`
- **Tags:** romantic, soft
- **Latency:** 1334 ms
- **Result:** ✅ pass
- **Midpoint distance:** 0.023

```
```json
{
  "bgPrimary": "hsl(42, 22%, 94%)",
  "accent": "hsl(346, 38%, 63%)",
  "gold": "hsl(39, 48%, 61%)",
  "fontDisplay": "Great Vibes"
}
```
```

### west-dark-romance — Western

- **Source:** `western/dark_romance`
- **Style:** `romantic_traditional`
- **Tags:** dramatic, moody
- **Latency:** 1601 ms
- **Result:** ✅ pass
- **Midpoint distance:** 0.079

```
```json
{
  "bgPrimary":   "hsl(290, 48%, 12%)",
  "accent":      "hsl(340, 62%, 62%)",
  "gold":        "hsl(42, 74%, 58%)",
  "fontDisplay": "Cormorant Garamond"
}
```
```

### west-coastal — Western

- **Source:** `western/coastal_destination`
- **Style:** `destination_glamour`
- **Tags:** coastal
- **Latency:** 1271 ms
- **Result:** ✅ pass
- **Midpoint distance:** 0.026

```
```json
{
  "bgPrimary": "hsl(215, 48%, 16%)",
  "accent": "hsl(184, 52%, 62%)",
  "gold": "hsl(46, 74%, 66%)",
  "fontDisplay": "Cormorant Garamond"
}
```
```

### west-editorial — Western

- **Source:** `western/editorial_minimal`
- **Style:** `editorial_bold`
- **Tags:** bold, modern
- **Latency:** 893 ms
- **Result:** ✅ pass
- **Midpoint distance:** 0.747

```
```json
{
  "bgPrimary": "hsl(0, 4%, 8%)",
  "accent": "hsl(220, 95%, 52%)",
  "gold": "hsl(0, 8%, 82%)",
  "fontDisplay": "Josefin Sans"
}
```
```

### west-warm-rustic — Western

- **Source:** `western/warm_rustic`
- **Style:** `bohemian_garden`
- **Tags:** rustic, natural
- **Latency:** 861 ms
- **Result:** ✅ pass
- **Midpoint distance:** 0.008

```
```json
{
  "bgPrimary": "hsl(26, 44%, 20%)",
  "accent": "hsl(22, 74%, 54%)",
  "gold": "hsl(40, 78%, 58%)",
  "fontDisplay": "Great Vibes"
}
```
```

### west-french-luxury — Western

- **Source:** `western/french_luxury`
- **Style:** `elegant_minimal`
- **Tags:** elegant, intimate
- **Latency:** 1377 ms
- **Result:** ✅ pass
- **Midpoint distance:** 0.012

```
```json
{
  "bgPrimary":   "hsl(44, 24%, 94%)",
  "accent":      "hsl(32, 34%, 48%)",
  "gold":        "hsl(41, 62%, 52%)",
  "fontDisplay": "Cormorant Garamond"
}
```
```

### west-midnight-glamour — Western

- **Source:** `western/midnight_glamour`
- **Style:** `destination_glamour`
- **Tags:** glamorous
- **Latency:** 1109 ms
- **Result:** ✅ pass
- **Midpoint distance:** 0.034

```
```json
{
  "bgPrimary":   "hsl(235, 28%, 9%)",
  "accent":      "hsl(208, 18%, 82%)",
  "gold":        "hsl(46, 42%, 76%)",
  "fontDisplay": "Cormorant Garamond"
}
```
```

### west-scandi — Western

- **Source:** `western/scandinavian_clean`
- **Style:** `modern_minimalist`
- **Tags:** modern
- **Latency:** 1047 ms
- **Result:** ✅ pass
- **Midpoint distance:** 0.059

```
```json
{
  "bgPrimary": "hsl(213, 8%, 96%)",
  "accent": "hsl(192, 22%, 52%)",
  "gold": "hsl(48, 28%, 66%)",
  "fontDisplay": "Cormorant Garamond"
}
```
```

### hindu-default — Hindu Indian

- **Source:** `hindu_indian`
- **Style:** `grand_celebration`
- **Tags:** grand, festive
- **Latency:** 1108 ms
- **Result:** ✅ pass
- **Midpoint distance:** 0.088

```
```json
{
  "bgPrimary":   "hsl(348, 92%, 14%)",
  "accent":      "hsl(342, 64%, 58%)",
  "gold":        "hsl(44, 98%, 54%)",
  "fontDisplay": "Cormorant Garamond"
}
```
```

### hindu-punjabi — Hindu — Punjabi

- **Source:** `hindu_indian/punjabi`
- **Style:** `grand_celebration`
- **Tags:** grand
- **Latency:** 966 ms
- **Result:** ✅ pass
- **Midpoint distance:** 0.086

```
```json
{
  "bgPrimary":   "hsl(346, 96%, 14%)",
  "accent":      "hsl(340, 68%, 54%)",
  "gold":        "hsl(45, 100%, 56%)",
  "fontDisplay": "Cormorant Garamond"
}
```
```

### hindu-tamil — Hindu — Tamil

- **Source:** `hindu_indian/tamil`
- **Style:** `grand_celebration`
- **Tags:** traditional
- **Latency:** 886 ms
- **Result:** ✅ pass
- **Midpoint distance:** 0.052

```
```json
{
  "bgPrimary": "hsl(0, 95%, 18%)",
  "accent": "hsl(8, 82%, 50%)",
  "gold": "hsl(46, 98%, 56%)",
  "fontDisplay": "Cormorant Garamond"
}
```
```

### hindu-bengali — Hindu — Bengali

- **Source:** `hindu_indian/bengali`
- **Style:** `romantic_traditional`
- **Tags:** traditional, intimate
- **Latency:** 1069 ms
- **Result:** ✅ pass
- **Midpoint distance:** 0.020

```
```json
{
  "bgPrimary": "hsl(6, 81%, 22%)",
  "accent": "hsl(45, 18%, 92%)",
  "gold": "hsl(44, 78%, 54%)",
  "fontDisplay": "Cormorant Garamond"
}
```
```

### hindu-gujarati — Hindu — Gujarati

- **Source:** `hindu_indian/gujarati`
- **Style:** `grand_celebration`
- **Tags:** festive
- **Latency:** 1258 ms
- **Result:** ✅ pass
- **Midpoint distance:** 0.088

```
```json
{
  "bgPrimary": "hsl(355, 84%, 18%)",
  "accent": "hsl(335, 78%, 58%)",
  "gold": "hsl(48, 94%, 56%)",
  "fontDisplay": "Cormorant Garamond"
}
```
```

### hindu-kerala — Hindu — Kerala/Malayali

- **Source:** `hindu_indian/kerala_malayali`
- **Style:** `elegant_minimal`
- **Tags:** elegant, refined
- **Latency:** 904 ms
- **Result:** ✅ pass
- **Midpoint distance:** 0.025

```
```json
{
  "bgPrimary": "hsl(45, 32%, 93%)",
  "accent": "hsl(44, 82%, 51%)",
  "gold": "hsl(42, 90%, 53%)",
  "fontDisplay": "Cormorant Garamond"
}
```
```

### hindu-marwari — Hindu — Marwari/Rajasthani

- **Source:** `hindu_indian/marwari_rajasthani`
- **Style:** `grand_celebration`
- **Tags:** grand, vibrant
- **Latency:** 885 ms
- **Result:** ✅ pass
- **Midpoint distance:** 0.087

```
```json
{
  "bgPrimary": "hsl(344, 92%, 12%)",
  "accent": "hsl(32, 96%, 58%)",
  "gold": "hsl(48, 100%, 54%)",
  "fontDisplay": "Cormorant Garamond"
}
```
```

### hindu-jain — Hindu — Jain

- **Source:** `hindu_indian/jain`
- **Style:** `elegant_minimal`
- **Tags:** refined
- **Latency:** 1676 ms
- **Result:** ✅ pass
- **Midpoint distance:** 0.012

```
```json
{
  "bgPrimary":   "hsl(346, 72%, 16%)",
  "accent":      "hsl(348, 54%, 58%)",
  "gold":        "hsl(44, 84%, 54%)",
  "fontDisplay": "Cormorant Garamond"
}
```
```

### muslim-sa — Muslim — South Asian

- **Source:** `muslim/south_asian_muslim`
- **Style:** `grand_celebration`
- **Tags:** grand, traditional
- **Latency:** 1114 ms
- **Result:** ✅ pass
- **Midpoint distance:** 0.101

```
```json
{
  "bgPrimary":   "hsl(275, 65%, 12%)",
  "accent":      "hsl(342, 72%, 58%)",
  "gold":        "hsl(44, 92%, 56%)",
  "fontDisplay": "Cormorant Garamond"
}
```
```

### muslim-arab — Muslim — Arab

- **Source:** `muslim/arab_muslim`
- **Style:** `elegant_minimal`
- **Tags:** elegant
- **Latency:** 1147 ms
- **Result:** ✅ pass
- **Midpoint distance:** 0.256

```
```json
{
  "bgPrimary":   "hsl(45, 3%, 97%)",
  "accent":      "hsl(46, 82%, 54%)",
  "gold":        "hsl(42, 88%, 58%)",
  "fontDisplay": "Cormorant Garamond"
}
```
```

### muslim-wa — Muslim — West African

- **Source:** `muslim/west_african_muslim`
- **Style:** `grand_celebration`
- **Tags:** festive, vibrant
- **Latency:** 1268 ms
- **Result:** ✅ pass
- **Midpoint distance:** 0.062

```
```json
{
  "bgPrimary": "hsl(158, 64%, 14%)",
  "accent": "hsl(36, 98%, 58%)",
  "gold": "hsl(46, 92%, 58%)",
  "fontDisplay": "Cormorant Garamond"
}
```
```

### sikh — Sikh

- **Source:** `sikh`
- **Style:** `grand_celebration`
- **Tags:** traditional
- **Latency:** 1118 ms
- **Result:** ✅ pass
- **Midpoint distance:** 0.068

```
```json
{
  "bgPrimary": "hsl(232, 72%, 14%)",
  "accent": "hsl(35, 100%, 55%)",
  "gold": "hsl(45, 95%, 56%)",
  "fontDisplay": "Cormorant Garamond"
}
```
```

### chinese — Chinese

- **Source:** `chinese`
- **Style:** `grand_celebration`
- **Tags:** festive
- **Latency:** 1048 ms
- **Result:** ✅ pass
- **Midpoint distance:** 0.064

```
```json
{
  "bgPrimary":   "hsl(355, 100%, 28%)",
  "accent":      "hsl(46, 95%, 54%)",
  "gold":        "hsl(48, 96%, 58%)",
  "fontDisplay": "Playfair Display"
}
```
```

### jewish — Jewish

- **Source:** `jewish`
- **Style:** `romantic_traditional`
- **Tags:** traditional, intimate
- **Latency:** 1043 ms
- **Result:** ✅ pass
- **Midpoint distance:** 0.012

```
```json
{
  "bgPrimary": "hsl(225, 58%, 16%)",
  "accent": "hsl(46, 78%, 56%)",
  "gold": "hsl(42, 82%, 58%)",
  "fontDisplay": "Cormorant Garamond"
}
```
```

### yoruba — Nigerian — Yoruba

- **Source:** `nigerian_yoruba`
- **Style:** `grand_celebration`
- **Tags:** vibrant, festive
- **Latency:** 1031 ms
- **Result:** ✅ pass
- **Midpoint distance:** 0.076

```
```json
{
  "bgPrimary": "hsl(282, 68%, 16%)",
  "accent": "hsl(46, 98%, 56%)",
  "gold": "hsl(42, 92%, 58%)",
  "fontDisplay": "Playfair Display"
}
```
```

### igbo — Nigerian — Igbo

- **Source:** `nigerian_igbo`
- **Style:** `grand_celebration`
- **Tags:** grand
- **Latency:** 966 ms
- **Result:** ✅ pass
- **Midpoint distance:** 0.095

```
```json
{
  "bgPrimary":   "hsl(355, 85%, 16%)",
  "accent":      "hsl(228, 78%, 32%)",
  "gold":        "hsl(44, 94%, 58%)",
  "fontDisplay": "Playfair Display"
}
```
```

### latin — Latin American Catholic

- **Source:** `latin_american_catholic`
- **Style:** `romantic_traditional`
- **Tags:** festive, elegant
- **Latency:** 1142 ms
- **Result:** ✅ pass
- **Midpoint distance:** 0.054

```
```json
{
  "bgPrimary": "hsl(348, 72%, 18%)",
  "accent": "hsl(336, 68%, 60%)",
  "gold": "hsl(44, 88%, 56%)",
  "fontDisplay": "Cormorant Garamond"
}
```
```

### hindu-punjabi-v2 — Hindu — Punjabi

- **Source:** `hindu_indian/punjabi`
- **Style:** `elegant_minimal`
- **Tags:** intimate, refined
- **Latency:** 2347 ms
- **Result:** ✅ pass
- **Midpoint distance:** 0.024

```
```json
{
  "bgPrimary":   "hsl(352, 84%, 16%)",
  "accent":      "hsl(344, 58%, 56%)",
  "gold":        "hsl(45, 92%, 54%)",
  "fontDisplay": "Cormorant Garamond"
}
```
```

### hindu-tamil-v2 — Hindu — Tamil

- **Source:** `hindu_indian/tamil`
- **Style:** `elegant_minimal`
- **Tags:** contemporary
- **Latency:** 930 ms
- **Result:** ✅ pass
- **Midpoint distance:** 0.019

```
```json
{
  "bgPrimary": "hsl(356, 89%, 19%)",
  "accent": "hsl(8, 76%, 51%)",
  "gold": "hsl(46, 94%, 57%)",
  "fontDisplay": "Cormorant Garamond"
}
```
```

### muslim-arab-v2 — Muslim — Arab

- **Source:** `muslim/arab_muslim`
- **Style:** `grand_celebration`
- **Tags:** festive
- **Latency:** 1201 ms
- **Result:** ✅ pass
- **Midpoint distance:** 0.302

```
```json
{
  "bgPrimary": "hsl(45, 6%, 97%)",
  "accent": "hsl(45, 90%, 52%)",
  "gold": "hsl(42, 94%, 56%)",
  "fontDisplay": "Cormorant Garamond"
}
```
```

### west-botanical-v2 — Western

- **Source:** `western/botanical_garden`
- **Style:** `romantic_traditional`
- **Tags:** natural, intimate
- **Latency:** 1000 ms
- **Result:** ✅ pass
- **Midpoint distance:** 0.010

```
```json
{
  "bgPrimary":   "hsl(38, 28%, 94%)",
  "accent":      "hsl(346, 38%, 62%)",
  "gold":        "hsl(39, 48%, 61%)",
  "fontDisplay": "Great Vibes"
}
```
```


## Source

- Script: `scripts/spike-haiku-hsl.ts`
- Library used: `src/lib/cultural-content-library.json`
- Prompt template: per `doc/PRECALL_IMPLEMENTATION_SPEC.md` Step 3
- Validator: per `doc/PRECALL_IMPLEMENTATION_SPEC.md` Step 4
