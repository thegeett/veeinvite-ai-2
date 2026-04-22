/**
 * Static pipeline verification — runs without Next.js or Supabase.
 *
 *   node scripts/verify-pipeline.mjs
 *
 * It uses tsx (available globally in this sandbox) to transpile the
 * TypeScript modules. If you're running this on your own machine after
 * `npm install`, use `npx tsx scripts/verify-pipeline.mjs` instead.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

const { validateAll, CONTENT_DEFAULTS } = await import(
  join(projectRoot, 'src/lib/validator/index.ts')
);
const { buildSite } = await import(
  join(projectRoot, 'src/lib/renderer/index.ts')
);

const skeleton = readFileSync(
  join(projectRoot, 'skeleton/wedding-skeleton.html'),
  'utf-8',
);

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ok  ${msg}`);
}

console.log('Test 1: validateAll(null) returns complete defaults');
{
  const res = validateAll(null);
  assert(res && typeof res === 'object', 'returns a result');
  assert(res.validContent && Object.keys(res.validContent).length >= 40, 'validContent populated');
  for (const key of Object.keys(CONTENT_DEFAULTS)) {
    assert(key in res.validContent, `content has key ${key}`);
  }
  assert(Array.isArray(res.validFonts) && res.validFonts.length > 0, 'validFonts fallback');
  assert(res.validParticles.effect === 'none', 'particles default to none');
}

console.log('\nTest 2: validateStyles strips forbidden properties');
{
  const res = validateAll({
    styles: {
      '.hero': {
        background: 'black',
        display: 'grid',             // forbidden
        'font-family': "'Jost', sans-serif",
      },
    },
    fonts: ['Jost', 'EvilFont'],
    particles: { effect: 'magic', count: 1000, opacity: 9, colors: ['red'] },
    content: {},
  });
  assert(res.validStyles['.hero'].background === 'black', 'kept background');
  assert(!('display' in res.validStyles['.hero']), 'stripped display');
  assert(res.validFonts.length === 1 && res.validFonts[0] === 'Jost', 'dropped unapproved font');
  assert(res.validParticles.effect === 'none', 'unknown effect falls back to none');
  assert(res.validParticles.count <= 30, 'count clamped');
  assert(res.validParticles.opacity <= 0.7, 'opacity clamped');
}

console.log('\nTest 3: validateStyles rejects dangerous values');
{
  const res = validateAll({
    styles: {
      '.hero': {
        background: 'url("javascript:alert(1)")',
        color: 'white',
      },
    },
  });
  assert(!res.validStyles['.hero']?.background, 'rejected javascript: url');
  assert(res.validStyles['.hero']?.color === 'white', 'kept color');
}

console.log('\nTest 4: buildSite produces HTML without placeholder tokens');
{
  const res = validateAll({
    styles: {
      '.hero': { background: '#111', color: '#faf' },
      '.hero-names': { color: '#fff', 'font-family': "'Fraunces', serif", 'font-size': '4rem' },
    },
    fonts: ['Fraunces:wght@300;400'],
    particles: { effect: 'petals', count: 20, opacity: 0.5, colors: ['#fff'] },
    content: {
      TAGLINE: 'A test tagline',
      CTA_LABEL: 'RSVP',
    },
  });

  const couple = {
    id: 'test-id',
    slug: 'emma-james',
    person1Name: 'Emma',
    person2Name: 'James',
    weddingDate: '21 June 2026',
    weddingDateIso: '2026-06-21T14:00:00Z',
    venueName: 'Kew Gardens',
    venueCity: 'London',
    style: 'Bohemian Garden',
    vibe: 'whimsical',
    story: 'Met at a festival.',
    culturalContext: 'British',
  };

  const events = [
    { name: 'Ceremony', eventDate: '21 June 2026', eventTime: '2:00 PM', venue: 'The Lawn', number: 'One' },
    { name: 'Reception', eventDate: '21 June 2026', eventTime: '4:00 PM', venue: 'The Pavilion', number: 'Two' },
    { name: 'After Party', eventDate: '21 June 2026', eventTime: '9:00 PM', venue: 'The Orangery', number: 'Three' },
  ];

  const html = buildSite({
    skeleton,
    styles: res.validStyles,
    fonts: res.validFonts,
    particles: res.validParticles,
    content: res.validContent,
    couple,
    events,
  });

  assert(html.includes('<style id="ai-theme">'), 'stylesheet injected');
  assert(html.includes('Emma'), 'person1 name injected');
  assert(html.includes('James'), 'person2 name injected');
  assert(html.includes('Kew Gardens'), 'venue injected');
  assert(!html.match(/\{\{[A-Z_0-9]+\}\}/), 'no remaining placeholder tokens');
  assert(html.includes('particle-canvas'), 'particle canvas present');
  assert(html.includes('id="rsvp-form"'), 'RSVP form intact');
  assert(html.includes('value="emma-james"'), 'slug injected into hidden input');
  assert(html.includes('name="slug"'), 'slug field remains a name="slug"');
}

console.log('\nTest 5: injectStructured overwrites AI content for structured fields');
{
  // If the AI wrote a value to PERSON1_NAME (it shouldn't, but just in case),
  // the structured injection must win.
  // Our ContentMap does NOT include PERSON1_NAME, so this is a defence test
  // that structured really is the final pass.
  const res = validateAll({ styles: {}, content: {} });
  const html = buildSite({
    skeleton,
    styles: res.validStyles,
    fonts: res.validFonts,
    particles: res.validParticles,
    content: res.validContent,
    couple: {
      id: 'x',
      slug: 'test',
      person1Name: 'REAL',
      person2Name: 'NAME',
      weddingDate: '',
      weddingDateIso: '',
      venueName: '',
      venueCity: '',
      style: '',
      vibe: '',
      story: '',
      culturalContext: '',
    },
    events: [],
  });
  assert(html.includes('REAL'), 'real name present');
  assert(html.includes('NAME'), 'real partner name present');
}

console.log('\nAll pipeline checks passed.');
