// Inline skeleton fixture used by renderer tests — mirrors the structure of
// layouts/layout-1-modern/skeleton.html but small enough to diff in tests.
// Real layouts live in Stream A's worktree; tests don't depend on that merge.

export const FIXTURE_SKELETON = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>{{PERSON1_NAME}} & {{PERSON2_NAME}}</title>
</head>
<body>
  <nav>
    <div class="nav-monogram">{{MONOGRAM}}</div>
    <ul class="nav-links">
      <li><a class="nav-link" href="#story">Story</a></li>
      <li><a class="nav-link" href="#events">Events</a></li>
      <li><a class="nav-link" href="#rsvp">RSVP</a></li>
      <li><a class="nav-link" href="#gallery">Gallery</a></li>
      <li><a class="nav-link" href="#faq">FAQ</a></li>
    </ul>
  </nav>

  <section class="story" id="story">
    <div class="story-grid">
      <p class="story-eyebrow">{{STORY_EYEBROW}}</p>
      <h2 class="story-heading">{{STORY_HEADING}}</h2>
      <p class="story-body">{{STORY_P1}}</p>
      <blockquote class="story-quote">{{STORY_QUOTE}}</blockquote>
    </div>
  </section>

  <section class="events" id="events">
    <div class="events-inner">
      <p class="events-eyebrow">{{EVENTS_EYEBROW}}</p>
      <h2 class="events-heading">{{EVENTS_HEADING}}</h2>
      <div class="events-grid">{{EVENTS_CARDS}}</div>
    </div>
  </section>

  <section class="rsvp" id="rsvp">
    <div class="rsvp-inner">
      <p class="rsvp-eyebrow">{{RSVP_EYEBROW}}</p>
      <h2 class="rsvp-heading">{{RSVP_HEADING}}</h2>
      <input type="hidden" name="slug" value="{{SLUG}}">
      {{RSVP_FORM}}
    </div>
  </section>

  <section class="faq" id="faq">
    <div class="faq-inner">
      <h2 class="faq-heading">{{FAQ_HEADING}}</h2>
      <div class="faq-list">
        <div class="faq-item">
          <button class="faq-question"><span>{{FAQ_1_Q}}</span><span class="faq-icon">+</span></button>
          <div class="faq-answer" style="display:none"><p>{{FAQ_1_A}}</p></div>
        </div>
      </div>
    </div>
  </section>

  <footer>
    <p class="footer-names">
      <span>{{PERSON1_NAME}} &amp; {{PERSON2_NAME}}</span>
      <span class="bilingual-secondary">{{PERSON1_NAME_BILINGUAL}}{{PERSON2_NAME_BILINGUAL}}</span>
    </p>
    <p class="footer-info">
      <span>{{WEDDING_DATE_DISPLAY}} · {{VENUE_NAME}}</span>
    </p>
    <p class="footer-tagline">{{FOOTER_TAGLINE}}</p>
  </footer>
</body>
</html>`;

export const FIXTURE_HERO = `<section class="hero">
  <div class="hero-inner">
    <h1 class="hero-names">{{PERSON1_NAME}} <span>&amp;</span> {{PERSON2_NAME}}</h1>
    <p class="hero-tagline">{{TAGLINE}}</p>
    <p class="hero-date">{{WEDDING_DATE_DISPLAY}} · {{VENUE_NAME}}, {{VENUE_CITY}}</p>
    <a class="hero-cta" href="#rsvp">{{CTA_LABEL}}</a>
  </div>
</section>`;
