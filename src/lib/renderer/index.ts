/**
 * Renderer — turns (skeleton + validated JSON + DB data) into a single
 * self-contained HTML file.
 *
 * Order of operations in buildSite():
 *   1. buildFontUrl
 *   2. buildStylesheet
 *   3. injectStyles (into <head>)
 *   4. inject particle script (before </body>) if any
 *   5. injectContent    ← AI copy
 *   6. injectStructured ← DB data (always last — overwrites AI)
 */

import type {
  BuildSiteParams,
  ContentMap,
  CoupleData,
  ParticleConfig,
  StylesMap,
  WeddingEvent,
} from '../types';

// ---------------------------------------------------------------------------
// Font URL
// ---------------------------------------------------------------------------

export function buildFontUrl(fonts: string[]): string {
  const pieces: string[] = [];
  for (const raw of fonts) {
    if (!raw) continue;
    const [baseRaw, weightsRaw] = raw.split(':');
    if (!baseRaw) continue;
    const base = baseRaw.trim().replace(/\s+/g, '+');
    if (weightsRaw) {
      pieces.push(`family=${base}:${weightsRaw.trim()}`);
    } else {
      pieces.push(`family=${base}`);
    }
  }
  if (pieces.length === 0) return '';
  return `https://fonts.googleapis.com/css2?${pieces.join('&')}&display=swap`;
}

// ---------------------------------------------------------------------------
// Stylesheet
// ---------------------------------------------------------------------------

export function buildStylesheet(styles: StylesMap): string {
  const rules: string[] = [];
  for (const selector of Object.keys(styles)) {
    const props = styles[selector];
    if (!props) continue;
    const lines = Object.entries(props).map(([p, v]) => `  ${p}: ${v};`);
    if (lines.length === 0) continue;
    rules.push(`${selector} {\n${lines.join('\n')}\n}`);
  }
  return rules.join('\n\n');
}

// ---------------------------------------------------------------------------
// Particle script
// ---------------------------------------------------------------------------

export function buildParticleScript(config: ParticleConfig): string {
  if (!config || config.effect === 'none' || config.count <= 0) return '';

  const colors = JSON.stringify(
    config.colors && config.colors.length > 0 ? config.colors : ['rgba(255,255,255,0.7)'],
  );
  const count = Math.max(0, Math.min(30, Math.floor(config.count)));
  const opacity = Math.max(0, Math.min(0.7, config.opacity));
  const effect = config.effect;

  return `
<script>
(function () {
  var cvs = document.getElementById('particle-canvas');
  if (!cvs) return;
  cvs.style.opacity = ${JSON.stringify(String(opacity))};
  var ctx = cvs.getContext('2d');
  if (!ctx) return;
  var EFFECT = ${JSON.stringify(effect)};
  var COLORS = ${colors};
  var COUNT = ${count};
  var W = 0, H = 0, particles = [];

  function resize() {
    var hero = cvs.parentElement || document.body;
    W = hero.offsetWidth;
    H = hero.offsetHeight;
    cvs.width = W; cvs.height = H;
  }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function spawn() {
    particles = [];
    for (var i = 0; i < COUNT; i++) {
      particles.push(make());
    }
  }

  function make() {
    var p = { x: rand(0, W), y: rand(-H, H), color: pick(COLORS) };
    if (EFFECT === 'petals') {
      p.vx = rand(-0.4, 0.4); p.vy = rand(0.5, 1.4);
      p.size = rand(6, 14); p.rot = rand(0, Math.PI * 2); p.rv = rand(-0.02, 0.02);
    } else if (EFFECT === 'snow') {
      p.vx = rand(-0.3, 0.3); p.vy = rand(0.3, 1.0);
      p.size = rand(1.2, 3);
    } else if (EFFECT === 'fireflies') {
      p.vx = rand(-0.2, 0.2); p.vy = rand(-0.2, 0.2);
      p.size = rand(1.5, 3); p.phase = rand(0, Math.PI * 2); p.speed = rand(0.01, 0.04);
    } else if (EFFECT === 'sparkles') {
      p.vx = rand(-0.2, 0.2); p.vy = rand(0.2, 0.8);
      p.size = rand(1, 3); p.rot = rand(0, Math.PI * 2); p.rv = rand(-0.05, 0.05);
    }
    return p;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.x += p.vx; p.y += p.vy;
      if (p.y > H + 20) { particles[i] = make(); particles[i].y = -10; continue; }
      if (p.x < -20) p.x = W + 10;
      if (p.x > W + 20) p.x = -10;
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;
      if (EFFECT === 'petals') {
        p.rot += p.rv;
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * 0.55, p.size, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (EFFECT === 'snow') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (EFFECT === 'fireflies') {
        p.phase += p.speed;
        var a = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(p.phase));
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.12 * a;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (EFFECT === 'sparkles') {
        p.rot += p.rv;
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.beginPath();
        for (var k = 0; k < 8; k++) {
          var ang = (Math.PI * 2 / 8) * k;
          var r = k % 2 === 0 ? p.size : p.size * 0.4;
          var x = Math.cos(ang) * r, y = Math.sin(ang) * r;
          if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    requestAnimationFrame(draw);
  }

  function start() {
    resize();
    spawn();
    draw();
  }

  window.addEventListener('resize', function () { resize(); });
  start();
})();
</script>`.trim();
}

// ---------------------------------------------------------------------------
// Inject styles
// ---------------------------------------------------------------------------

export function injectStyles(
  skeleton: string,
  fontUrl: string,
  stylesheet: string,
): string {
  const fontLink = fontUrl
    ? `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fontUrl}">`
    : '';

  const themeTag = `<style id="ai-theme">\n${stylesheet}\n</style>`;

  const block = `${fontLink}\n${themeTag}\n</head>`;
  if (skeleton.includes('</head>')) {
    return skeleton.replace('</head>', block);
  }
  // Fallback: prepend before <body>
  return skeleton.replace('<body>', `${fontLink}${themeTag}<body>`);
}

// ---------------------------------------------------------------------------
// Inject content
// ---------------------------------------------------------------------------

export function injectContent(html: string, content: ContentMap): string {
  let out = html;
  (Object.keys(content) as (keyof ContentMap)[]).forEach((key) => {
    const token = `{{${key}}}`;
    out = out.split(token).join(content[key] ?? '');
  });
  return out;
}

// ---------------------------------------------------------------------------
// Inject structured (real DB data). Always runs last.
// ---------------------------------------------------------------------------

function escapeHtml(s: string | undefined | null): string {
  if (s === undefined || s === null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function injectStructured(
  html: string,
  couple: CoupleData,
  events: WeddingEvent[],
): string {
  const monogram =
    `${(couple.person1Name || '').trim().charAt(0).toUpperCase()}` +
    ` & ` +
    `${(couple.person2Name || '').trim().charAt(0).toUpperCase()}`;

  const subs: Record<string, string> = {
    PERSON1_NAME: escapeHtml(couple.person1Name),
    PERSON2_NAME: escapeHtml(couple.person2Name),
    WEDDING_DATE_DISPLAY: escapeHtml(couple.weddingDate),
    VENUE_NAME: escapeHtml(couple.venueName),
    VENUE_CITY: escapeHtml(couple.venueCity),
    COUNTDOWN_TARGET: escapeHtml(couple.weddingDateIso),
    SLUG: escapeHtml(couple.slug || ''),
    MONOGRAM: escapeHtml(monogram),
  };

  // Event name / time / venue come from the DB. The event "number"
  // (One / Two / Three / stylised variants) is owned by the AI and
  // populated via the ContentMap, so we don't touch it here.
  for (let i = 0; i < 3; i++) {
    const evt = events[i];
    const nKey = `EVENT_${i + 1}`;
    subs[`${nKey}_NAME`] = escapeHtml(evt?.name || '');
    subs[`${nKey}_TIME`] = escapeHtml(
      evt
        ? [evt.eventDate, evt.eventTime].filter(Boolean).join(' · ')
        : '',
    );
    subs[`${nKey}_VENUE`] = escapeHtml(evt?.venue || '');
  }

  let out = html;
  for (const [token, value] of Object.entries(subs)) {
    out = out.split(`{{${token}}}`).join(value);
  }
  return out;
}

// ---------------------------------------------------------------------------
// buildSite — orchestrates the pipeline
// ---------------------------------------------------------------------------

export function buildSite(params: BuildSiteParams): string {
  const { skeleton, styles, fonts, particles, content, couple, events } = params;

  const fontUrl = buildFontUrl(fonts);
  const stylesheet = buildStylesheet(styles);

  let html = injectStyles(skeleton, fontUrl, stylesheet);

  if (particles && particles.effect !== 'none' && particles.count > 0) {
    const particleBlock = buildParticleScript(particles);
    if (particleBlock) {
      html = html.replace('</body>', `${particleBlock}\n</body>`);
    }
  }

  html = injectContent(html, content);
  // ALWAYS LAST — real DB data overwrites anything AI-generated.
  html = injectStructured(html, couple, events);

  return html;
}
