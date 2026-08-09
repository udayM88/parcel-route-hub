import { Helmet } from 'react-helmet-async';
import type { CmsContent } from '@/lib/cms/types';

interface Props {
  content: Partial<CmsContent>;
  url: string; // full path, e.g. /blog/foo
}

export default function SeoHead({ content, url }: Props) {
  const title = content.meta_title || content.title || 'ViaSetu';
  const desc = content.meta_description || content.excerpt || '';
  // Canonical is always derived from the live URL — never use a stored override.
  // This guarantees consistency for SEO and prevents stale canonicals.
  const canonical = `https://viasetu.com${url}`;
  // No placeholder fallback — a 404 image previews worse than none.
  const ogImage = content.og_image_url || content.featured_image_url || undefined;

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': content.schema_type || 'Article',
    headline: content.title,
    description: desc,
    ...(ogImage ? { image: ogImage } : {}),
    datePublished: content.published_at,
    dateModified: content.updated_at,
    mainEntityOfPage: canonical,
    ...(content.schema_json || {}),
  };

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={desc} />
      <meta name="robots" content={content.robots || 'index,follow'} />
      <link rel="canonical" href={canonical} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={desc} />
      <meta property="og:url" content={canonical} />
      {ogImage ? <meta property="og:image" content={ogImage} /> : null}
      <meta property="og:type" content="article" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={desc} />
      {ogImage ? <meta name="twitter:image" content={ogImage} /> : null}
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
    </Helmet>
  );
}
