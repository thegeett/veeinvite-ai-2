import { createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Params {
  params: { slug: string };
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function notFoundHtml(): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Invitation not found</title>
<style>
html,body{margin:0;padding:0;background:#0b0b0f;color:#faf7f2;font-family:system-ui,sans-serif;}
.wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:3rem;text-align:center;}
h1{font-size:2rem;font-weight:400;letter-spacing:0.04em;margin:0 0 0.8rem;}
p{opacity:.6;margin:0;}
</style></head><body><div class="wrap"><div><h1>Invitation not found</h1><p>We couldn't find the wedding you're looking for.</p></div></div></body></html>`;
}

function comingSoonHtml(p1: string, p2: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(p1)} & ${escapeHtml(p2)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:wght@300;400&display=swap">
<style>
html,body{margin:0;padding:0;background:#0b0b0f;color:#faf7f2;font-family:'Fraunces',Georgia,serif;}
.wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:3rem;text-align:center;}
h1{font-size:clamp(2.5rem,8vw,5rem);font-weight:300;margin:0 0 1rem;}
p{opacity:.6;margin:0;letter-spacing:.12em;text-transform:uppercase;font-size:.8rem;font-family:system-ui,sans-serif;}
.amp{display:block;font-style:italic;font-size:.6em;opacity:.7;margin:.2em 0;}
</style></head><body><div class="wrap"><div>
<h1>${escapeHtml(p1)}<span class="amp">&amp;</span>${escapeHtml(p2)}</h1>
<p>Our website is on its way</p>
</div></div></body></html>`;
}

export async function GET(_request: Request, { params }: Params) {
  const slug = params.slug;
  const service = createServiceRoleClient();

  const { data: couple, error } = await service
    .from('couples')
    .select('id, slug, person1_name, person2_name, site_html_url, is_published')
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    console.error('[/w/[slug]] lookup error', error);
    return new Response(notFoundHtml(), {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  if (!couple) {
    return new Response(notFoundHtml(), {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  if (!couple.is_published || !couple.site_html_url) {
    return new Response(
      comingSoonHtml(
        (couple.person1_name as string) || 'Us',
        (couple.person2_name as string) || 'You',
      ),
      {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      },
    );
  }

  try {
    const res = await fetch(couple.site_html_url as string, { cache: 'no-store' });
    if (!res.ok) {
      return new Response(notFoundHtml(), {
        status: 502,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
    const html = await res.text();
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (err) {
    console.error('[/w/[slug]] fetch failed', err);
    return new Response(notFoundHtml(), {
      status: 502,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}
