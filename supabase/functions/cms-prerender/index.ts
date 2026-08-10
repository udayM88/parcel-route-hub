// Edge function that returns the SPA's index.html with per-post meta tags
// injected so social-preview crawlers (WhatsApp, LinkedIn, Facebook, X) see
// the correct title/description/og:image when a blog URL is shared.
// Wired up via vercel.json rewrite for /blog/:slug.

import { createClient } from "npm:@supabase/supabase-js@2";

const SITE = "https://www.viasetu.com";
const ORIGIN = "https://www.viasetu.com"; // origin to fetch the built index.html from

function esc(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripHtml(html: string): string {
  return (html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  // Slug may come via query (?slug=...) or as last path segment.
  const slug = url.searchParams.get("slug") || url.pathname.split("/").filter(Boolean).pop() || "";

  // Fetch the deployed SPA shell. We rewrite asset URLs as-is.
  let shell = "";
  try {
    const r = await fetch(`${ORIGIN}/index.html`, { headers: { "cache-control": "no-cache" } });
    shell = await r.text();
  } catch (_) {
    shell = "<!doctype html><html><head></head><body><div id=\"root\"></div></body></html>";
  }

  let title = "ViaSetu Blog";
  let description = "Courier tips, shipping guides and logistics news from ViaSetu.";
  let image = `${SITE}/og-image.png`;
  let canonical = `${SITE}/blog/${slug}`;
  let publishedAt: string | null = null;
  let updatedAt: string | null = null;

  if (slug) {
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data } = await supabase
        .from("cms_content")
        .select("title,meta_title,meta_description,excerpt,body_html,featured_image_url,og_image_url,canonical_url,published_at,updated_at,slug,status,type")
        .eq("slug", slug)
        .eq("type", "post")
        .eq("status", "published")
        .maybeSingle();

      if (data) {
        title = data.meta_title || data.title || title;
        description = (data.meta_description || data.excerpt || stripHtml(data.body_html || "").slice(0, 160) || description).slice(0, 300);
        image = data.og_image_url || data.featured_image_url || image;
        // Canonical is ALWAYS the live URL for this slug — never the stored override.
        canonical = `${SITE}/blog/${data.slug}`;
        publishedAt = data.published_at;
        updatedAt = data.updated_at;
      }
    } catch (e) {
      console.error("cms-prerender: lookup failed", e);
    }
  }

  const ldJson = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    description,
    image,
    datePublished: publishedAt,
    dateModified: updatedAt,
    mainEntityOfPage: canonical,
    author: { "@type": "Organization", name: "ViaSetu" },
    publisher: { "@type": "Organization", name: "ViaSetu", logo: { "@type": "ImageObject", url: `${SITE}/logo.png` } },
  });

  const injected = `
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${esc(canonical)}" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${esc(canonical)}" />
    <meta property="og:image" content="${esc(image)}" />
    <meta property="og:image:secure_url" content="${esc(image)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:site_name" content="ViaSetu" />
    <meta property="og:locale" content="en_IN" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <meta name="twitter:image" content="${esc(image)}" />
    <script type="application/ld+json">${ldJson}</script>
  `;

  // Strip existing <title>, <meta name="description">, canonical and any og:/twitter: tags
  // from the shell so our per-post tags win for non-JS crawlers.
  let out = shell
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace(/<meta\s+name=["']description["'][^>]*>/gi, "")
    .replace(/<link\s+rel=["']canonical["'][^>]*>/gi, "")
    .replace(/<meta\s+property=["']og:[^"']+["'][^>]*>/gi, "")
    .replace(/<meta\s+name=["']twitter:[^"']+["'][^>]*>/gi, "");

  // Inject right after <head>
  out = out.replace(/<head[^>]*>/i, (m) => `${m}\n${injected}`);

  return new Response(out, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
});
