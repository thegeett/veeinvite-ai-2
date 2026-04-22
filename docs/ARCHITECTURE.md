# Architecture

## The CSS JSON pipeline

The defining architectural decision of VeeInvite is that the AI never
writes HTML. It styles a shared skeleton.

```
skeleton/wedding-skeleton.html
        │
        │  (layout-only CSS, {{PLACEHOLDER}} tokens, working JS)
        │
        ▼
 buildPrompt(skeleton, couple, events)
        │
        │  full skeleton + glossary + couple data + JSON schema
        │
        ▼
     Claude
        │
        │  ThemeJSON (styles, fonts, particles, content)
        │
        ▼
   validator
        │
        │  strips forbidden CSS, unapproved fonts, unsafe values
        │  returns defaults for anything missing — never throws
        │
        ▼
   renderer
        │
        │  1. buildFontUrl()
        │  2. buildStylesheet()
        │  3. injectStyles() into <head>
        │  4. inject particle script before </body> (if any)
        │  5. injectContent()    ← AI copy
        │  6. injectStructured() ← DB data (names, dates, venues) — LAST
        │
        ▼
  final HTML
        │
        ▼
   Supabase Storage (bucket: wedding-sites)
        │
        ▼
   /w/[slug] (route handler — raw HTML response)
```

## Why this shape?
- **Determinism.** The layout, sections, and form structure are the
  same for every wedding. That is not a creative decision.
- **Safety.** The AI cannot break layout, introduce CSS that hijacks
  the page, or modify the RSVP form's wiring.
- **Editability.** Changing the couple's name or the venue is a
  database update + a re-render. It never involves Claude.
- **Replayability.** `theme_json` is the source of truth. We can
  rebuild the HTML at any moment without another Claude call.

## Data flow for each operation

### Initial generation (`POST /api/generate`)
```
client  ──► /api/generate
           │ check auth → load couple + events
           │ read skeleton from disk
           │ buildPrompt → callClaude → parseThemeJSON
           │ validateAll
           │ buildSite
           │ upload to Supabase Storage (upsert coupleId/site.html)
           │ update couples.theme_json, site_html_url
           │ insert site_versions row
           ▼
        { success: true, siteUrl }
```

### Style edit (`POST /api/edit`)
Same as generate, but with `buildEditPrompt` (includes the current
`theme_json`) and appends the instruction to `couples.style_history`.

### Structured edit (`POST /api/structured`)
No Claude call. Update the allowed column, re-run validator on the
saved `theme_json`, re-run `buildSite()`, upload the new HTML.

### RSVP (`POST /api/rsvp`)
No auth. Find couple by slug. Insert row into `rsvps`.

### Guest page (`GET /w/[slug]`)
No auth. Look up couple by slug. If unpublished, return a simple
"coming soon" page. Otherwise fetch the HTML from Storage and return
it with `Content-Type: text/html`.

## Why theme_json is the source of truth
The HTML file on Storage is derived data. If we lose it, we can
rebuild it from the skeleton + `theme_json` + couple + events. This
matters for structured edits: we do **not** call Claude to update a
venue name, we just re-render.

## Validator as the safety net
The validator never throws because the entire point is to keep the
pipeline flowing even with creative but imperfect AI output. Every
field in the ContentMap has a default. Forbidden CSS properties are
silently stripped. Unapproved fonts are replaced with `Jost`. If the
entire input is `null`, we still get a ready-to-render ValidationResult.

## Rendering order matters
`injectContent()` runs before `injectStructured()`. That means real
data — names, dates, venues — always overwrites AI-generated copy in
those same fields. Skeleton placeholders for structured data (e.g.
`{{PERSON1_NAME}}`) are never touched by the ContentMap. The
structured step is the last word.
