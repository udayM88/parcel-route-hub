import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { renderStaticSeoHtml } from "./generate-static-seo";

const baseHtml = `<!doctype html><html><head>
<title>Default title</title>
<meta name="robots" content="index, follow" />
<meta property="og:title" content="Default" />
<meta property="og:description" content="Default" />
<meta property="og:type" content="website" />
<meta property="og:url" content="https://www.viasetu.com/" />
<meta name="twitter:title" content="Default" />
<meta name="twitter:description" content="Default" />
</head><body><div id="root"></div><script src="/assets/app.js"></script></body></html>`;

describe("static SEO route HTML", () => {
  it("writes one route-specific description, canonical and crawlable H1", () => {
    const html = renderStaticSeoHtml(baseHtml, {
      path: "/blog/test-post",
      title: "Test & Learn | ViaSetu",
      description: "Compare <couriers> safely & quickly.",
      h1: "Test <Post>",
      type: "article",
    });

    assert.match(html, /<title>Test &amp; Learn \| ViaSetu<\/title>/);
    assert.match(html, /<meta name="description" content="Compare &lt;couriers&gt; safely &amp; quickly\." \/>/);
    assert.match(html, /<link rel="canonical" href="https:\/\/www\.viasetu\.com\/blog\/test-post" \/>/);
    assert.match(html, /<meta property="og:type" content="article" \/>/);
    assert.match(html, /<h1[^>]*>Test &lt;Post&gt;<\/h1>/);
    assert.equal((html.match(/<meta name="description"/g) || []).length, 1);
    assert.equal((html.match(/<h1/g) || []).length, 1);
    assert.match(html, /<script src="\/assets\/app\.js"><\/script>/);
  });

  it("rejects a base document without an empty React root", () => {
    assert.throws(() => renderStaticSeoHtml("<html><head><title>x</title></head><body></body></html>", {
      path: "/blog/test",
      title: "Test",
      description: "Description",
      h1: "Test",
    }), /missing an empty #root/);
  });

  it("routes extensionless production URLs to generated HTML before the SPA fallback", () => {
    const config = JSON.parse(readFileSync("vercel.json", "utf8")) as {
      rewrites: Array<{ source: string; destination: string }>;
    };
    const fallbackIndex = config.rewrites.findIndex((rewrite) => rewrite.destination === "/index.html");
    const expected = [
      ["/tracking", "/tracking/index.html"],
      ["/blog", "/blog/index.html"],
      ["/blog/:slug", "/blog/:slug/index.html"],
      ["/p/:slug", "/p/:slug/index.html"],
      ["/courier/:slug", "/courier/:slug/index.html"],
    ];

    assert.ok(fallbackIndex > -1, "SPA fallback rewrite is missing");
    for (const [source, destination] of expected) {
      const routeIndex = config.rewrites.findIndex((rewrite) => rewrite.source === source && rewrite.destination === destination);
      assert.ok(routeIndex > -1, `missing SEO rewrite for ${source}`);
      assert.ok(routeIndex < fallbackIndex, `${source} must be resolved before the SPA fallback`);
    }
  });
});
