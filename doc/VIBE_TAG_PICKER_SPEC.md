# Vibe Tag Picker — Implementation Spec

## What this document is

Complete specification for replacing the free-text vibe word input with a
contextual tag picker. Covers the two-mode system, the 12 western tags, the
8 cultural tags, the visual preview system, DB changes, and how tags flow
downstream into the pre-call and design weight.

**Decisions applied in this version:**
- Free text field removed entirely — no parseOptionalText, no vibe_text column
- Western tags reduced from 16 to 12 most-distinct
- Tag-level visual preview added (color swatches on hover / long-press)
- Western vs cultural mode difference explicitly documented and surfaced in UI copy

---

## The Problem This Solves

The current vibe input is a free text box:

```
"Describe your vibe in 3 words"
[ text input                    ]
```

Couples type emotional language, not design language:

```
What the system needs:     What couples actually type:
"garden, floral, natural"  →  "beautiful, happy, love"
"dramatic, dark, moody"    →  "romantic, perfect, amazing"
"editorial, bold, clean"   →  "fun, exciting, magical"
```

Generic emotional words cannot be keyword-matched to anything useful.
The system falls back to the style card silently on every such input.
The vibe box appears to do something. It does nothing for most couples.
It is a lying feature.

The fix: replace it with pre-mapped tags. Every tag works. No silent fallback.
No free text field — because free text has the same lying-feature problem.
Removed entirely.

---

## Critical — Two Completely Different Modes

The tag picker has two modes that do fundamentally different things.
This is not a detail. It is the core of the system.
The UI must surface this difference in its copy and framing.

WESTERN COUPLES — tags select an AESTHETIC FAMILY:
Tags determine the entire color palette.
"Romantic + Soft" → botanical_garden → cream, dusty rose, antique gold
"Bold + Moody"    → dark_romance     → deep plum, rose gold, warm gold
UI subheading: "We'll use this to choose your color palette"

CULTURAL COUPLES — tags adjust DESIGN WEIGHT, not the palette:
The palette is already set by the cultural HSL ranges.
A Hindu Punjabi couple always gets deep red, rose gold, marigold.
That is correct. That is culturally right.
Tags control how that palette is expressed:
"Contemporary" → less ornament, marble texture, subtle motif
"Grand"        → more ornament, velvet, prominent motif
The Punjabi red stays Punjabi red regardless of what they pick.
UI subheading: "We'll use this to set the tone and decoration"

If a developer reads only one section of this document it must be this one.
The two modes look identical to the couple. They produce completely different
outcomes in the system.

---

## Western Mode — Tags Select the Aesthetic Family

### The 12 western tags

Reduced from 16. Removed near-synonyms:
Minimal   (same as Modern)
Classic   (same as Elegant)
Festive   (same as Glamorous)
Organic   (same as Natural)

```typescript
// src/lib/ai/vibeTagPicker.ts

export interface WesternTagDefinition {
  id:       string
  label:    string
  families: WesternFamilyId[]
  preview: {
    swatches: [string, string, string]   // [bgPrimary, accent, gold] hex approximations
    keywords: string                     // "Soft · Warm · Tender"
  }
}

export const WESTERN_TAGS: WesternTagDefinition[] = [
  {
    id: 'romantic', label: 'Romantic',
    families: ['botanical_garden', 'dark_romance'],
    preview: { swatches: ['#F5F0E8', '#C4A0A0', '#C5922A'], keywords: 'Soft · Warm · Tender' },
  },
  {
    id: 'dramatic', label: 'Dramatic',
    families: ['dark_romance', 'midnight_glamour'],
    preview: { swatches: ['#1A0E1E', '#C4607A', '#D4A853'], keywords: 'Bold · Moody · Intense' },
  },
  {
    id: 'elegant', label: 'Elegant',
    families: ['french_luxury', 'midnight_glamour'],
    preview: { swatches: ['#F5EEE0', '#7A5830', '#B8860B'], keywords: 'Refined · Timeless · Chic' },
  },
  {
    id: 'bold', label: 'Bold',
    families: ['editorial_minimal', 'midnight_glamour'],
    preview: { swatches: ['#0A0A0A', '#E63946', '#C0C0C0'], keywords: 'Striking · Confident · Strong' },
  },
  {
    id: 'natural', label: 'Natural',
    families: ['botanical_garden', 'warm_rustic'],
    preview: { swatches: ['#EDE8DC', '#8B6914', '#C17F4A'], keywords: 'Earthy · Organic · Garden' },
  },
  {
    id: 'moody', label: 'Moody',
    families: ['dark_romance'],
    preview: { swatches: ['#1A0818', '#9B4D6B', '#D4A853'], keywords: 'Dark · Atmospheric · Rich' },
  },
  {
    id: 'modern', label: 'Modern',
    families: ['editorial_minimal', 'scandinavian_clean'],
    preview: { swatches: ['#F8F8F8', '#4A4A5A', '#A89060'], keywords: 'Clean · Minimal · Fresh' },
  },
  {
    id: 'soft', label: 'Soft',
    families: ['botanical_garden', 'french_luxury'],
    preview: { swatches: ['#FAF5EE', '#D4B0A0', '#C5A050'], keywords: 'Gentle · Delicate · Quiet' },
  },
  {
    id: 'rustic', label: 'Rustic',
    families: ['warm_rustic'],
    preview: { swatches: ['#2D1B0E', '#C17F4A', '#D4A853'], keywords: 'Warm · Earthy · Barn' },
  },
  {
    id: 'coastal', label: 'Coastal',
    families: ['coastal_destination'],
    preview: { swatches: ['#0E1E2E', '#6AB0B0', '#D4B060'], keywords: 'Ocean · Airy · Destination' },
  },
  {
    id: 'glamorous', label: 'Glamorous',
    families: ['midnight_glamour'],
    preview: { swatches: ['#0D0D1A', '#C0C8D8', '#C9A84C'], keywords: 'Ballroom · Luxe · Dazzling' },
  },
  {
    id: 'intimate', label: 'Intimate',
    families: ['botanical_garden', 'french_luxury'],
    preview: { swatches: ['#F5EEE0', '#B09080', '#B8A060'], keywords: 'Personal · Warm · Close' },
  },
]
```

### The WESTERN_TAG_MAP — for the scoring algorithm

```typescript
export const WESTERN_TAG_MAP: Record<string, WesternFamilyId[]> = {
  'romantic':   ['botanical_garden', 'dark_romance'],
  'dramatic':   ['dark_romance',     'midnight_glamour'],
  'elegant':    ['french_luxury',    'midnight_glamour'],
  'bold':       ['editorial_minimal','midnight_glamour'],
  'natural':    ['botanical_garden', 'warm_rustic'],
  'moody':      ['dark_romance'],
  'modern':     ['editorial_minimal','scandinavian_clean'],
  'soft':       ['botanical_garden', 'french_luxury'],
  'rustic':     ['warm_rustic'],
  'coastal':    ['coastal_destination'],
  'glamorous':  ['midnight_glamour'],
  'intimate':   ['botanical_garden', 'french_luxury'],
}
```

### Scoring algorithm

```typescript
export function selectWesternFamily(
  styleCard: string,
  vibeTags:  string[]
): WesternFamilyId {

  if (vibeTags.length === 0) return styleCardToFamily(styleCard)

  const scores = Object.fromEntries(
    WESTERN_FAMILY_IDS.map(id => [id, 0])
  ) as Record<WesternFamilyId, number>

  vibeTags.forEach(tag => {
    const families = WESTERN_TAG_MAP[tag.toLowerCase()] ?? []
    families.forEach(f => scores[f]++)
  })

  const sorted = (Object.entries(scores) as [WesternFamilyId, number][])
    .sort(([, a], [, b]) => b - a)

  const topScore = sorted[0][1]
  if (topScore === 0) return styleCardToFamily(styleCard)

  const tied = sorted.filter(([, s]) => s === topScore).map(([f]) => f)
  return tied.length === 1 ? tied[0] : styleCardTieBreak(styleCard, tied)
}

const WESTERN_FAMILY_IDS: WesternFamilyId[] = [
  'botanical_garden', 'dark_romance', 'coastal_destination',
  'editorial_minimal', 'warm_rustic', 'french_luxury',
  'midnight_glamour', 'scandinavian_clean',
]

function styleCardTieBreak(styleCard: string, tied: WesternFamilyId[]): WesternFamilyId {
  const pref: Record<string, WesternFamilyId> = {
    'modern_minimalist':    'scandinavian_clean',
    'elegant_minimal':      'french_luxury',
    'romantic_traditional': 'botanical_garden',
    'bohemian_garden':      'botanical_garden',
    'destination_glamour':  'midnight_glamour',
    'editorial_bold':       'editorial_minimal',
    'grand_celebration':    'midnight_glamour',
  }
  const preferred = pref[styleCard]
  return (preferred && tied.includes(preferred)) ? preferred : tied[0]
}

function styleCardToFamily(styleCard: string): WesternFamilyId {
  const map: Record<string, WesternFamilyId> = {
    'modern_minimalist':    'scandinavian_clean',
    'elegant_minimal':      'french_luxury',
    'romantic_traditional': 'botanical_garden',
    'bohemian_garden':      'botanical_garden',
    'destination_glamour':  'midnight_glamour',
    'editorial_bold':       'editorial_minimal',
    'grand_celebration':    'midnight_glamour',
  }
  return map[styleCard] ?? 'botanical_garden'
}
```

### Concrete examples

```
Couple A — taps: [Romantic] [Soft]
  romantic → botanical_garden +1, dark_romance +1
  soft     → botanical_garden +1, french_luxury +1
  Scores:    botanical_garden:2, dark_romance:1, french_luxury:1
  Winner:    botanical_garden
  Palette:   warm cream · dusty rose · antique gold

Couple B — taps: [Bold] [Moody]
  bold  → editorial_minimal +1, midnight_glamour +1
  moody → dark_romance +1
  Tie at 1. Style card (editorial_bold) → editorial_minimal wins
  Palette:   near-black · single vivid accent · pale silver

Couple C — taps nothing
  Style card fallback: romantic_traditional → botanical_garden
```

---

## Cultural Mode — Tags Adjust Design Weight

### What design weight is

For cultural couples, the color palette is already set by the cultural
HSL ranges in cultural-content-library.json.

A Hindu Punjabi couple always gets:
bgPrimary: deep red (hue 346-360)
accent:    rose gold (hue 336-352)
gold:      marigold (hue 40-50)

That is correct. That is culturally right. Tags do not change this.

What tags control is how that palette is expressed across four dimensions:

motifIntensity:  subtle | medium | prominent
How large and animated is the cultural motif (lotus, Ganesha, double-happiness)?

density:         minimal | balanced | ornate
How many decorative layers? Single border or full corner ornaments and particles?

materialType:    parchment | silk | marble | velvet
What surface texture does the card feel like?

animationLevel:  static | gentle | ambient
How much continuous motion? Particle effects or stillness?

### The 8 cultural tags

```typescript
export interface CulturalTagDefinition {
  id:          string
  label:       string
  description: string
  preview: {
    keywords:  string          // "Ornate · Abundant · Ceremonial"
    level:     number          // 1-5 decoration level for the bar
    direction: string          // "More decoration" or "Less decoration"
  }
}

export const CULTURAL_TAGS: CulturalTagDefinition[] = [
  {
    id: 'grand', label: 'Grand',
    description: 'Rich ornamentation, prominent motifs, full celebration energy',
    preview: { keywords: 'Ornate · Abundant · Ceremonial', level: 5, direction: 'Maximum decoration' },
  },
  {
    id: 'intimate', label: 'Intimate',
    description: 'Subtle, refined, personal — less ornament, more breathing room',
    preview: { keywords: 'Subtle · Personal · Quiet', level: 1, direction: 'Minimal decoration' },
  },
  {
    id: 'traditional', label: 'Traditional',
    description: 'Full cultural expression — motifs, materials, and animation as expected',
    preview: { keywords: 'Classic · Ceremonial · Rooted', level: 3, direction: 'Balanced decoration' },
  },
  {
    id: 'contemporary', label: 'Contemporary',
    description: 'Cultural palette, modern visual weight — clean surfaces, subtle motifs',
    preview: { keywords: 'Modern · Clean · Minimal', level: 1, direction: 'Lighter decoration' },
  },
  {
    id: 'festive', label: 'Festive',
    description: 'Maximum energy — ambient animation, particles, bold motif',
    preview: { keywords: 'Vibrant · Energetic · Celebratory', level: 5, direction: 'Maximum decoration' },
  },
  {
    id: 'elegant', label: 'Elegant',
    description: 'Balanced decoration, silk surface, composed feel',
    preview: { keywords: 'Refined · Composed · Balanced', level: 3, direction: 'Balanced decoration' },
  },
  {
    id: 'vibrant', label: 'Vibrant',
    description: 'Full ambient animation — the invitation feels alive and moving',
    preview: { keywords: 'Animated · Lively · Moving', level: 3, direction: 'Full animation' },
  },
  {
    id: 'refined', label: 'Refined',
    description: 'Restrained and polished — marble surface, subtle motif, still',
    preview: { keywords: 'Polished · Still · Understated', level: 1, direction: 'Minimal decoration' },
  },
]
```

### The CULTURAL_TAG_MAP

IMPORTANT: vibrant maps to animationLevel: ambient ONLY.
It does NOT push density or motifIntensity up.
Vibrancy = energy and movement, not quantity of ornament.
This is corrected from the previous version.

```typescript
export const CULTURAL_TAG_MAP: Record<string, Partial<DesignWeight>> = {
  'grand':        { density: 'ornate',   motifIntensity: 'prominent', animationLevel: 'ambient' },
  'intimate':     { density: 'minimal',  motifIntensity: 'subtle',    animationLevel: 'gentle'  },
  'traditional':  { density: 'balanced', motifIntensity: 'medium',    materialType: 'velvet'    },
  'contemporary': { density: 'minimal',  motifIntensity: 'subtle',    materialType: 'marble'    },
  'festive':      { density: 'ornate',   motifIntensity: 'prominent', animationLevel: 'ambient' },
  'elegant':      { density: 'balanced', motifIntensity: 'medium',    materialType: 'silk'      },
  'vibrant':      { animationLevel: 'ambient' },
  'refined':      { density: 'minimal',  motifIntensity: 'subtle',    materialType: 'marble'    },
}
```

### Design weight application

```typescript
export function applyVibeTagsToWeight(
  baseWeight: DesignWeight,
  tags:       string[]
): DesignWeight {
  let weight = { ...baseWeight }
  tags.forEach(tag => {
    const adjustment = CULTURAL_TAG_MAP[tag.toLowerCase()]
    if (adjustment) weight = { ...weight, ...adjustment }
  })
  return weight
}
```

### Concrete example

```
Hindu Punjabi base weight (from culturalDefaults):
  motifIntensity: 'prominent'     bgPrimary: hsl(348, 88%, 16%)  ← deep red
  density:        'ornate'        accent:    hsl(342, 62%, 56%)  ← rose gold
  materialType:   'velvet'        gold:      hsl(44, 90%, 54%)   ← marigold
  animationLevel: 'ambient'

Couple selects: [Contemporary] [Refined]

contemporary: { density: minimal, motifIntensity: subtle, materialType: marble }
refined:      { density: minimal, motifIntensity: subtle, materialType: marble }

Result:
  motifIntensity: 'subtle'    ← both tags pushed this down
  density:        'minimal'   ← both tags pushed this down
  materialType:   'marble'    ← changed from velvet to marble
  animationLevel: 'ambient'   ← unchanged (neither tag touched this)

  bgPrimary: hsl(348, 88%, 16%)  ← UNCHANGED. Still deep Punjabi red.
  accent:    hsl(342, 62%, 56%)  ← UNCHANGED. Still rose gold.
  gold:      hsl(44, 90%, 54%)   ← UNCHANGED. Still marigold.

The couple gets: Punjabi color identity + contemporary minimalist expression.
Not a generic modern invitation. A Punjabi invitation that breathes.
```

---

## UI Component Specification

### Western mode layout

Section header:  "How should your invitation feel?"
Subheading:      "Choose up to 3 — we'll use these to pick your color palette"

[Romantic]  [Dramatic]  [Elegant]   [Bold]
[Natural]   [Moody]     [Modern]    [Soft]
[Rustic]    [Coastal]   [Glamorous] [Intimate]

12 tags. 3 rows of 4. No free text field.

### Cultural mode layout

Section header:  "How should your invitation feel?"
Subheading:      "Choose up to 3 — we'll use these to set the tone and decoration"

[Grand]        [Intimate]     [Traditional]  [Contemporary]
[Festive]      [Elegant]      [Vibrant]      [Refined]

8 tags. 2 rows of 4. No free text field.

The subheading copy differs between modes. This is intentional.
Western says "color palette" — tags directly select it.
Cultural says "tone and decoration" — palette is already set by culture;
tags only adjust the decoration weight. Couples are not confused about
what changed when they regenerate.

### Interaction rules

- Tap unselected tag: selects it
- Tap selected tag: deselects it
- 3 tags selected: remaining tags dimmed (opacity 0.38) but still tappable
- Tap dimmed tag: deselects least recently selected, selects this one
- No submit button — selection updates live as couple taps
- Zero tags selected is valid — falls back to style card

### Visual states

```
Unselected:
  border:     1px solid rgba(currentColor, 0.2)
  background: transparent
  text:       var(--textMuted)

Selected:
  border:     1.5px solid var(--accent)
  background: rgba(var(--accent-rgb), 0.08)
  text:       var(--accent)
  font-weight: 500

Dimmed (max 3 reached, not selected):
  opacity:    0.38
  cursor:     pointer
```

### Accessibility

```
Each tag:
  role="button"
  aria-pressed="true | false"
  aria-label="[Label] — [keywords]"
    e.g. "Romantic — Soft, Warm, Tender"

Keyboard:
  Arrow keys: move focus between tags
  Space / Enter: toggle selection
  Tab: move to next interactive element

Motion:
  @media (prefers-reduced-motion: reduce):
    Remove all transitions on tag state changes
    Preview panel appears instantly, no animation
```

---

## Tag-Level Visual Preview

When a couple hovers (desktop) or long-presses (mobile) a tag,
a small preview panel appears.

Without a preview, couples pick labels without referents.
"Dark Romance" means nothing until you see deep plum and three words.
With a preview, selection becomes intuitive — they react to color,
not try to imagine what a label means.

### Western tag preview

Shows 3 color swatches + 3 keywords.

```
┌─────────────────────────────────┐
│  ●  ●  ●                        │   ← 3 circles, 20px, bgPrimary / accent / gold
│  Soft · Warm · Tender           │   ← keywords from WesternTagDefinition
└─────────────────────────────────┘
```

The swatches are illustrative hex values approximating the HSL ranges
for that aesthetic family. They do not change with the couple's selection.
They are fixed per tag.

### Cultural tag preview

Shows TWO independent indicator bars + 3 keywords. No color swatches — the
palette does not change in cultural mode. The two bars correspond to the
two axes a cultural tag can affect:

  Decoration (0-5)  ← driven by `density` + `motifIntensity`
  Motion     (0-3)  ← driven by `animationLevel`

These axes are independent. A tag may move one bar, both, or neither.
This honesty matters — `vibrant` only changes animation, so its Decoration
bar must stay empty. Showing it on a single combined bar would re-introduce
the "tag promises one thing, system does another" lying-feature pattern
that the whole vibe rewrite was meant to eliminate.

```
┌─────────────────────────────────────────┐
│  Decoration  ████████████████████       │   ← 0-5 segments
│  Motion      ████████████░░░░           │   ← 0-3 segments
│  Ornate · Abundant · Ceremonial         │   ← keywords
└─────────────────────────────────────────┘
```

Per-tag truth table — Decoration (0-5) and Motion (0-3):

| Tag          | Decoration | Motion | Notes                                       |
| ------------ | ---------- | ------ | ------------------------------------------- |
| grand        | 5          | 3      | maximum density + ambient animation         |
| festive      | 5          | 3      | same as grand — both fully filled           |
| traditional  | 3          | 0      | balanced decoration, no animation change    |
| elegant      | 3          | 0      | balanced decoration, no animation change    |
| **vibrant**  | **0**      | **3**  | animation only — Decoration bar stays empty |
| contemporary | 1          | 0      | minimal decoration, no animation change     |
| refined      | 1          | 0      | minimal decoration, no animation change     |
| intimate     | 1          | 1      | minimal decoration, gentle animation        |

Visual rendering of the truth table (filled / empty segments):

```
grand:         Decoration ████████████████████   Motion ████████████
festive:       Decoration ████████████████████   Motion ████████████
traditional:   Decoration ████████████░░░░░░░░   Motion ░░░░░░░░░░░░
elegant:       Decoration ████████████░░░░░░░░   Motion ░░░░░░░░░░░░
vibrant:       Decoration ░░░░░░░░░░░░░░░░░░░░   Motion ████████████
contemporary:  Decoration ████░░░░░░░░░░░░░░░░   Motion ░░░░░░░░░░░░
refined:       Decoration ████░░░░░░░░░░░░░░░░   Motion ░░░░░░░░░░░░
intimate:      Decoration ████░░░░░░░░░░░░░░░░   Motion ████░░░░░░░░
```

The `CulturalTagDefinition` interface gains a second numeric field to carry
the Motion level (the existing `level` field becomes Decoration-only):

```typescript
preview: {
  keywords:   string   // "Ornate · Abundant · Ceremonial"
  decoration: number   // 0-5 — was `level` in the previous version
  motion:     number   // 0-3 — NEW
}
```

`TagPreview.tsx` renders both bars stacked with their own labels.

### Desktop trigger

```
onMouseEnter: show preview after 300ms delay
onMouseLeave: hide immediately
Position: above the tag (flip to below if near top of viewport)
```

### Mobile trigger

```
onLongPress (400ms threshold): show as bottom sheet
Tap anywhere outside: dismiss
Long press does NOT trigger selection — selection is tap only
```

### Component: TagPreview.tsx

```typescript
interface TagPreviewProps {
  mode:       'western' | 'cultural'
  tagId:      string
  anchorRect: DOMRect       // position of the tag being previewed
}
// Western mode: renders swatches + keywords
// Cultural mode: renders level bar + keywords + direction text
// Handles above/below flip based on anchorRect.top vs window.innerHeight/2
```

---

## DB Changes

Free text field is dropped. No vibe_text column.

```sql
-- supabase/migrations/XXXX_add_vibe_tags.sql

-- 1. Add vibe_tags array
ALTER TABLE couples ADD COLUMN vibe_tags TEXT[] DEFAULT '{}';

-- 2. Add expressive_palette for pre-call result storage
ALTER TABLE couples ADD COLUMN expressive_palette JSONB;
-- Stores { bgPrimary, accent, gold, fontDisplay } from the pre-call
-- Used for edit flow — palette stays locked unless "Start fresh"

-- 3. Keep existing vibe TEXT column — do NOT drop it yet
-- Deprecate in M2 after migration is verified

-- 4. Migration script — populate vibe_tags from existing free text
UPDATE couples
SET vibe_tags = ARRAY(
  SELECT UNNEST(
    CASE WHEN vibe ILIKE '%romantic%'                      THEN ARRAY['romantic']  ELSE ARRAY[]::TEXT[] END
    || CASE WHEN vibe ILIKE '%dramatic%'                   THEN ARRAY['dramatic']  ELSE ARRAY[]::TEXT[] END
    || CASE WHEN vibe ILIKE '%elegant%'                    THEN ARRAY['elegant']   ELSE ARRAY[]::TEXT[] END
    || CASE WHEN vibe ILIKE '%bold%'                       THEN ARRAY['bold']      ELSE ARRAY[]::TEXT[] END
    || CASE WHEN vibe ILIKE '%natural%' OR vibe ILIKE '%garden%'
                                                           THEN ARRAY['natural']   ELSE ARRAY[]::TEXT[] END
    || CASE WHEN vibe ILIKE '%moody%'   OR vibe ILIKE '%dark%'
                                                           THEN ARRAY['moody']     ELSE ARRAY[]::TEXT[] END
    || CASE WHEN vibe ILIKE '%modern%'  OR vibe ILIKE '%minimal%'
                                                           THEN ARRAY['modern']    ELSE ARRAY[]::TEXT[] END
    || CASE WHEN vibe ILIKE '%soft%'    OR vibe ILIKE '%gentle%'
                                                           THEN ARRAY['soft']      ELSE ARRAY[]::TEXT[] END
    || CASE WHEN vibe ILIKE '%rustic%'  OR vibe ILIKE '%barn%'
                                                           THEN ARRAY['rustic']    ELSE ARRAY[]::TEXT[] END
    || CASE WHEN vibe ILIKE '%coastal%' OR vibe ILIKE '%beach%'
                                                           THEN ARRAY['coastal']   ELSE ARRAY[]::TEXT[] END
    || CASE WHEN vibe ILIKE '%glam%'                       THEN ARRAY['glamorous'] ELSE ARRAY[]::TEXT[] END
    || CASE WHEN vibe ILIKE '%intimate%'                   THEN ARRAY['intimate']  ELSE ARRAY[]::TEXT[] END
  )
  LIMIT 3
)
WHERE vibe IS NOT NULL AND vibe != '';
-- Couples whose free text matches nothing → empty vibe_tags → style card fallback
-- This is correct. No data lost. Old vibe column preserved until M2.
```

---

## How Tags Flow Into the Pipeline

```typescript
// In quiz step 2 — on generation trigger

const selectedTags: string[] = vibeTagPicker.selected
// e.g. ['romantic', 'soft'] for western
// e.g. ['contemporary', 'refined'] for cultural
// e.g. [] if couple selected nothing — style card fallback applies

// Pass to pre-call (always)
const palette = await runPalettePreCall({
  cultureId:   culturalProfile.id,
  subRegion:   culturalProfile.subRegion,
  styleCard:   couple.styleCard,
  vibeTags:    selectedTags,
  cultureName: culturalProfile.displayName,
})

// For cultural couples — also compute design weight
if (culturalProfile.id !== 'western') {
  const designWeight = applyVibeTagsToWeight(
    deriveDesignWeight(couple.styleCard, culturalProfile),
    selectedTags
  )
}
```

---

## What This Fixes

BEFORE:
Couple types "beautiful, happy, love"
→ no keywords match
→ silent fallback to style card
→ same palette as every couple with that style card

AFTER:
Couple taps [Romantic] [Soft]
→ selectWesternFamily() scores: botanical_garden:2, french_luxury:2
→ style card breaks tie → botanical_garden
→ Haiku samples within botanical_garden HSL ranges
→ hsl(38, 24%, 93%) · hsl(342, 38%, 62%) · hsl(40, 48%, 60%)
→ genuinely different from a couple who tapped [Bold] [Moody]
→ always works — every tag is pre-mapped
→ no silent fallback
→ no free text field that does nothing

---

## File Locations

```
src/lib/ai/vibeTagPicker.ts
  WESTERN_TAGS[]            12 tags with swatches and keywords
  CULTURAL_TAGS[]           8 tags with bar level and keywords
  WESTERN_TAG_MAP           12 tags mapped to WesternFamilyId arrays
  CULTURAL_TAG_MAP          8 tags mapped to Partial<DesignWeight>
  WESTERN_FAMILY_IDS        array of all 8 family ids
  WesternTagDefinition      interface
  CulturalTagDefinition     interface
  selectWesternFamily()     scoring algorithm
  applyVibeTagsToWeight()   cultural tag design weight adjustment

src/components/quiz/VibeTagPicker.tsx
  Renders western (12 tags, 3x4) or cultural (8 tags, 2x4) mode
  Different subheading copy per mode
  Tap to select / deselect
  Max 3 — 4th tap replaces least recently selected
  Dimmed state at opacity 0.38 when max reached
  No free text field
  Shows TagPreview on hover (300ms) / long-press (400ms)
  Emits: { selectedTags: string[] }
  aria-pressed, keyboard nav, prefers-reduced-motion

src/components/quiz/TagPreview.tsx
  Western: 3 color swatches + 3 keywords
  Cultural: decoration bar (1-5) + 3 keywords + direction text
  Desktop: positions above tag, flips below if near top
  Mobile: bottom sheet

src/lib/renderer/designWeight.ts
  deriveDesignWeight() gains vibeTags: string[] parameter
  Calls applyVibeTagsToWeight() as final step
  Cultural couples only (western uses selectWesternFamily instead)

supabase/migrations/XXXX_add_vibe_tags.sql
  ADD COLUMN vibe_tags TEXT[] DEFAULT '{}'
  ADD COLUMN expressive_palette JSONB
  Migration script from existing vibe TEXT
  No vibe_text column — free text dropped
```

---

## Summary — What Claude Code Needs to Build

1. src/lib/ai/vibeTagPicker.ts
  - WESTERN_TAGS[] — 12 tags with preview data (swatches + keywords)
  - CULTURAL_TAGS[] — 8 tags with preview data (bar level + keywords)
  - WESTERN_TAG_MAP — 12 entries only (not 30+)
  - CULTURAL_TAG_MAP — 8 entries, vibrant maps to animationLevel ONLY
  - WESTERN_FAMILY_IDS
  - selectWesternFamily() — scoring + tie-break
  - applyVibeTagsToWeight() — cultural design weight adjustment
  - parseOptionalText() IS REMOVED — do not implement it

2. src/components/quiz/VibeTagPicker.tsx
  - Renders correct mode based on culturalProfile.id === 'western'
  - Western: 12 tags, 3x4, subheading about color palette
  - Cultural: 8 tags, 2x4, subheading about tone and decoration
  - Max 3 selected, replace-least-recent on 4th tap
  - Dimmed state for unchosen when max reached
  - No free text field anywhere
  - TagPreview on hover (desktop) / long-press (mobile)
  - Emits: { selectedTags: string[] }
  - aria-pressed on every tag, keyboard navigation, prefers-reduced-motion

3. src/components/quiz/TagPreview.tsx
  - Western: 3 color circles + keyword string
  - Cultural: level bar + keyword string + direction label
  - Desktop: above tag, flip logic
  - Mobile: bottom sheet
  - DOMRect positioning

4. DB migration: supabase/migrations/XXXX_add_vibe_tags.sql
  - ADD COLUMN vibe_tags TEXT[] DEFAULT '{}'
  - ADD COLUMN expressive_palette JSONB
  - Migration UPDATE from existing vibe TEXT
  - No vibe_text column

5. src/lib/renderer/designWeight.ts
  - deriveDesignWeight() now accepts vibeTags: string[]
  - Calls applyVibeTagsToWeight() as final step
  - Only for cultural couples

6. Tests: src/lib/ai/vibeTagPicker.test.ts
  - selectWesternFamily: 12-tag match, style card fallback, tie-break
  - applyVibeTagsToWeight: tags override base weight
  - vibrant: ONLY changes animationLevel, not density or motifIntensity
  - No tests for parseOptionalText — function does not exist