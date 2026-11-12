import { mkdir, readFile, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const SITE_URL = "https://www.viasetu.com";

export interface StaticSeoRoute {
  path: string;
  title: string;
  description: string;
  h1: string;
  robots?: string;
  type?: "website" | "article";
}

interface CmsSeoRow {
  slug: string;
  type: "post" | "page" | "partner";
  title: string;
  meta_title: string | null;
  meta_description: string | null;
  excerpt: string | null;
  robots: string | null;
}

const STATIC_ROUTES: StaticSeoRoute[] = [
  {
    path: "/tracking",
    title: "Track Parcel — Unified Courier Tracking | ViaSetu",
    description: "Track shipments from Delhivery, XpressBees, Shadowfax, Shree Maruti and other couriers in one place by AWB number.",
    h1: "Track Your Shipment",
  },
  {
    path: "/blog",
    title: "ViaSetu Blog — Courier Tips, Guides & News",
    description: "Read the latest courier tips, shipping guides, and logistics news from ViaSetu.",
    h1: "Courier tips, shipping guides & logistics news",
  },
];

function envFromDotEnv(key: string): string | undefined {
  try {
    const raw = readFileSync(resolve(".env"), "utf8");
    const line = raw.split(/\r?\n/).find((entry) => entry.trim().startsWith(`${key}=`));
    return line?.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
  } catch {
    return undefined;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function upsertHeadTag(html: string, pattern: RegExp, tag: string): string {
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", `    ${tag}\n  </head>`);
}

export function renderStaticSeoHtml(baseHtml: string, route: StaticSeoRoute): string {
  const canonical = `${SITE_URL}${route.path}`;
  const title = escapeHtml(route.title.trim());
  const description = escapeHtml(route.description.trim());
  const h1 = escapeHtml(route.h1.trim());
  const robots = escapeHtml(route.robots?.trim() || "index,follow");
  const type = route.type || "website";

  let html = baseHtml.replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`);
  html = upsertHeadTag(html, /<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${description}" />`);
  html = upsertHeadTag(html, /<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${escapeHtml(canonical)}" />`);
  html = upsertHeadTag(html, /<meta\s+name=["']robots["'][^>]*>/i, `<meta name="robots" content="${robots}" />`);
  html = upsertHeadTag(html, /<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${title}" />`);
  html = upsertHeadTag(html, /<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${description}" />`);
  html = upsertHeadTag(html, /<meta\s+property=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${escapeHtml(canonical)}" />`);
  html = upsertHeadTag(html, /<meta\s+property=["']og:type["'][^>]*>/i, `<meta property="og:type" content="${type}" />`);
  html = upsertHeadTag(html, /<meta\s+name=["']twitter:title["'][^>]*>/i, `<meta name="twitter:title" content="${title}" />`);
  html = upsertHeadTag(html, /<meta\s+name=["']twitter:description["'][^>]*>/i, `<meta name="twitter:description" content="${description}" />`);

  const fallback = [
    '<main data-static-seo="true" style="max-width:72rem;margin:0 auto;padding:4rem 1.5rem;font-family:Inter,system-ui,-apple-system,sans-serif;color:#0b1220">',
    `<h1 style="margin:0 0 1rem;font-size:2.25rem;line-height:1.15">${h1}</h1>`,
    `<p style="max-width:48rem;margin:0;color:#5a6b80;font-size:1rem;line-height:1.6">${description}</p>`,
    "</main>",
  ].join("");

  if (!/<div\s+id=["']root["']>\s*<\/div>/i.test(html)) {
    throw new Error("static SEO: dist/index.html is missing an empty #root element");
  }
  return html.replace(/<div\s+id=["']root["']>\s*<\/div>/i, `<div id="root">${fallback}</div>`);
}

async function fetchCmsRoutes(): Promise<StaticSeoRoute[]> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || envFromDotEnv("VITE_SUPABASE_URL") || "https://tksfdvnogzsweteetjjw.supabase.co";
  const supabaseKey =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    envFromDotEnv("VITE_SUPABASE_PUBLISHABLE_KEY") ||
    envFromDotEnv("VITE_SUPABASE_ANON_KEY");

  if (!supabaseKey) throw new Error("static SEO: no Supabase publishable/anon key is available");

  const query = new URL(`${supabaseUrl}/rest/v1/cms_content`);
  query.searchParams.set("select", "slug,type,title,meta_title,meta_description,excerpt,robots");
  query.searchParams.set("status", "eq.published");
  query.searchParams.set("type", "in.(post,page,partner)");
  query.searchParams.set("order", "type.asc,slug.asc");
  query.searchParams.set("limit", "5000");

  const response = await fetch(query, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  });
  if (!response.ok) throw new Error(`static SEO: CMS fetch failed (${response.status} ${await response.text()})`);

  const prefix: Record<CmsSeoRow["type"], string> = { post: "/blog", page: "/p", partner: "/courier" };
  const rows = (await response.json()) as CmsSeoRow[];
  return rows.flatMap((row) => {
    const description = row.meta_description?.trim() || row.excerpt?.trim();
    if (!row.slug || !row.title?.trim() || !description || !prefix[row.type]) {
      console.warn(`static SEO: skipped incomplete CMS metadata for ${row.type || "unknown"}/${row.slug || "unknown"}`);
      return [];
    }
    return [{
      path: `${prefix[row.type]}/${row.slug}`,
      title: row.meta_title?.trim() || row.title.trim(),
      description,
      h1: row.title.trim(),
      robots: row.robots?.trim() || "index,follow",
      type: row.type === "post" ? "article" as const : "website" as const,
    }];
  });
}

export async function generateStaticSeoPages(distDir = resolve("dist")): Promise<number> {
  const baseHtml = await readFile(resolve(distDir, "index.html"), "utf8");
  const cmsRoutes = await fetchCmsRoutes();
  const routes = Array.from(new Map([...STATIC_ROUTES, ...cmsRoutes].map((route) => [route.path, route])).values());

  for (const route of routes) {
    if (!/^\/[a-z0-9/_-]+$/.test(route.path)) {
      throw new Error(`static SEO: unsafe route path ${route.path}`);
    }
    const output = resolve(distDir, route.path.slice(1), "index.html");
    if (!output.startsWith(resolve(distDir))) throw new Error(`static SEO: output escaped dist for ${route.path}`);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, renderStaticSeoHtml(baseHtml, route), "utf8");
  }

  console.log(`static SEO: wrote ${routes.length} route HTML files (${STATIC_ROUTES.length} static, ${cmsRoutes.length} CMS)`);
  return routes.length;
}
