/**
 * Generates public/sitemap.xml before `vite dev` and `vite build`.
 *
 * Sources:
 *  - Static public routes (declared below, mirroring src/App.tsx)
 *  - Service + city slugs read from src/pages/ServicePage.tsx / src/pages/CityPage.tsx
 *  - Published CMS content (posts, pages, partners) from Supabase
 *
 * lastmod is only emitted for CMS rows (real updated_at/published_at values).
 * Static pages intentionally carry no lastmod — a build timestamp is not a
 * page-change signal.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE_URL = "https://www.viasetu.com";

// Vite's .env isn't loaded into process.env for standalone scripts, so read it
// directly as a fallback — otherwise CMS URLs silently drop out of the sitemap.
function envFromDotEnv(key: string): string | undefined {
  try {
    const raw = readFileSync(resolve(".env"), "utf8");
    const line = raw.split("\n").find((l) => l.trim().startsWith(`${key}=`));
    return line?.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
  } catch {
    return undefined;
  }
}

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  envFromDotEnv("VITE_SUPABASE_URL") ||
  "https://tksfdvnogzsweteetjjw.supabase.co";
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  envFromDotEnv("VITE_SUPABASE_PUBLISHABLE_KEY") ||
  envFromDotEnv("VITE_SUPABASE_ANON_KEY") ||
  "";


interface Entry {
  path: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
}

// Public, indexable static routes. Excludes auth/user-scoped/admin/business
// routes and redirect-only paths (/home, /terms, /privacy, /about-us).
const STATIC: Entry[] = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/booking", changefreq: "daily", priority: "0.9" },
  { path: "/tracking", changefreq: "daily", priority: "0.9" },
  { path: "/blog", changefreq: "weekly", priority: "0.8" },
  { path: "/faq", changefreq: "monthly", priority: "0.7" },
  { path: "/how-it-works", changefreq: "monthly", priority: "0.7" },
  { path: "/courier-partners", changefreq: "monthly", priority: "0.7" },
  { path: "/about", changefreq: "monthly", priority: "0.6" },
  { path: "/contact", changefreq: "monthly", priority: "0.6" },
  { path: "/support", changefreq: "monthly", priority: "0.6" },
  { path: "/careers", changefreq: "monthly", priority: "0.5" },
  { path: "/terms-and-conditions", changefreq: "yearly", priority: "0.3" },
  { path: "/privacy-policy", changefreq: "yearly", priority: "0.3" },
];

function slugsFrom(file: string, exportName: string): string[] {
  try {
    const src = readFileSync(resolve(file), "utf8");
    const start = src.indexOf(`export const ${exportName}`);
    if (start === -1) return [];
    const body = src.slice(start);
    const matches = body.match(/^\s{4}slug:\s*"([^"]+)"/gm) || [];
    return matches
      .map((m) => m.match(/"([^"]+)"/)?.[1])
      .filter((s): s is string => Boolean(s));
  } catch {
    return [];
  }
}

async function cmsEntries(): Promise<Entry[]> {
  if (!SUPABASE_KEY) {
    console.warn("sitemap: no Supabase key available — skipping CMS URLs");
    return [];
  }
  const prefix: Record<string, string> = {
    post: "/blog/",
    page: "/p/",
    partner: "/courier/",
  };
  try {
    const url =
      `${SUPABASE_URL}/rest/v1/cms_content` +
      `?select=slug,type,updated_at,published_at&status=eq.published` +
      `&type=in.(post,page,partner)&order=updated_at.desc&limit=5000`;
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const rows = (await res.json()) as Array<{
      slug: string;
      type: string;
      updated_at: string | null;
      published_at: string | null;
    }>;
    return rows
      .filter((r) => r.slug && prefix[r.type])
      .map((r) => {
        const stamp = r.updated_at || r.published_at;
        return {
          path: `${prefix[r.type]}${r.slug}`,
          lastmod: stamp ? new Date(stamp).toISOString().slice(0, 10) : undefined,
          changefreq: r.type === "post" ? "weekly" : "monthly",
          priority: r.type === "post" ? "0.7" : "0.6",
        };
      });
  } catch (e) {
    console.warn("sitemap: CMS fetch failed, writing static routes only —", e);
    return [];
  }
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function render(entries: Entry[]): string {
  const urls = entries.map((e) =>
    [
      "  <url>",
      `    <loc>${BASE_URL}${xmlEscape(e.path)}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      "  </url>",
    ]
      .filter(Boolean)
      .join("\n"),
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
}

async function main() {
  const services = slugsFrom("src/pages/ServicePage.tsx", "SERVICES").map((slug) => ({
    path: `/services/${slug}`,
    changefreq: "monthly",
    priority: "0.8",
  }));
  const cities = slugsFrom("src/pages/CityPage.tsx", "CITIES").map((slug) => ({
    path: `/courier-service-in-${slug}`,
    changefreq: "monthly",
    priority: "0.8",
  }));

  const all: Entry[] = [...STATIC, ...services, ...cities, ...(await cmsEntries())];

  // De-duplicate by path, keeping the first occurrence.
  const seen = new Set<string>();
  const entries = all.filter((e) => (seen.has(e.path) ? false : (seen.add(e.path), true)));

  writeFileSync(resolve("public/sitemap.xml"), render(entries));
  console.log(
    `sitemap.xml written (${entries.length} URLs: ${STATIC.length} static, ${services.length} services, ${cities.length} cities)`,
  );
}

main();
