import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import type { CmsContent } from '@/lib/cms/types';
import { Loader2, ArrowRight } from 'lucide-react';
import PublicSiteLayout from '@/components/site/PublicSiteLayout';

const TEAL = '#00A8A8';
const BORDER = '#E2E8F0';
const GRAY = '#5A6B80';

export default function Blog() {
  const [posts, setPosts] = useState<CmsContent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase.from('cms_content')
      .select('*')
      .eq('type', 'post').eq('status', 'published')
      .order('published_at', { ascending: false });
    setPosts((data || []) as unknown as CmsContent[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('public:cms_content:blog')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cms_content', filter: 'type=eq.post' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const [featured, ...rest] = posts;

  return (
    <PublicSiteLayout>
      <Helmet>
        <title>ViaSetu Blog — Courier Tips, Guides & News</title>
        <meta name="description" content="Read the latest courier tips, shipping guides, and logistics news from ViaSetu." />
        <link rel="canonical" href="https://www.viasetu.com/blog" />
      </Helmet>

      <section className="px-6 py-12 md:py-16" style={{ background: '#F4F7FB' }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-[12px] uppercase tracking-[0.2em] mb-3" style={{ color: TEAL }}>The ViaSetu Blog</div>
          <h1 className="text-[32px] md:text-[44px] font-bold leading-tight" style={{ color: '#0B1220' }}>
            Courier tips, shipping guides &amp; logistics news
          </h1>
          <p className="mt-3 text-[16px] max-w-2xl" style={{ color: GRAY }}>
            Practical insights to help you ship smarter across India — from packing tips to courier comparisons.
          </p>
        </div>
      </section>

      <section className="px-6 py-10 md:py-14">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="flex justify-center p-16"><Loader2 className="h-6 w-6 animate-spin" style={{ color: TEAL }} /></div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16" style={{ color: GRAY }}>No posts yet — check back soon.</div>
          ) : (
            <>
              {featured && (
                <Link to={`/blog/${featured.slug}`} className="block group mb-10">
                  <article className="grid md:grid-cols-2 gap-6 rounded-2xl overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lg" style={{ background: '#FFFFFF', border: `1px solid ${BORDER}` }}>
                    <div className="h-64 md:h-full overflow-hidden" style={{ background: '#F4F7FB' }}>
                      {featured.featured_image_url && (
                        <img src={featured.featured_image_url} alt={featured.featured_image_alt || featured.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      )}
                    </div>
                    <div className="p-6 md:p-10 flex flex-col justify-center">
                      <span className="self-start text-[11px] font-semibold px-2 py-1 rounded-full mb-4" style={{ background: `${TEAL}15`, color: TEAL }}>
                        {(featured.tags && featured.tags[0]) || 'Featured'}
                      </span>
                      <h2 className="text-[24px] md:text-[30px] font-bold leading-snug mb-3" style={{ color: '#0B1220' }}>{featured.title}</h2>
                      {featured.excerpt && <p className="text-[15px] mb-5" style={{ color: GRAY }}>{featured.excerpt}</p>}
                      <div className="flex items-center gap-2 text-[14px] font-semibold" style={{ color: TEAL }}>
                        Read article <ArrowRight className="h-4 w-4" />
                      </div>
                      {featured.published_at && (
                        <div className="text-[12px] mt-4" style={{ color: GRAY }}>{new Date(featured.published_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                      )}
                    </div>
                  </article>
                </Link>
              )}

              {rest.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {rest.map(p => (
                    <Link key={p.id} to={`/blog/${p.slug}`} className="group">
                      <article className="rounded-2xl overflow-hidden flex flex-col h-full transition-all hover:-translate-y-1 hover:shadow-lg" style={{ background: '#FFFFFF', border: `1px solid ${BORDER}` }}>
                        <div className="h-44 overflow-hidden" style={{ background: '#F4F7FB' }}>
                          {p.featured_image_url && (
                            <img src={p.featured_image_url} alt={p.featured_image_alt || p.title} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                          )}
                        </div>
                        <div className="p-5 flex flex-col flex-1">
                          <span className="self-start text-[11px] font-semibold px-2 py-1 rounded-full mb-3" style={{ background: `${TEAL}15`, color: TEAL }}>
                            {(p.tags && p.tags[0]) || 'Article'}
                          </span>
                          <h3 className="text-[17px] font-bold leading-snug mb-2" style={{ color: '#0B1220' }}>{p.title}</h3>
                          {p.excerpt && <p className="text-[14px] mb-4 flex-1 line-clamp-3" style={{ color: GRAY }}>{p.excerpt}</p>}
                          <div className="flex items-center justify-between text-[13px]">
                            <span style={{ color: GRAY }}>{p.published_at ? new Date(p.published_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</span>
                            <span className="font-semibold" style={{ color: TEAL }}>Read more →</span>
                          </div>
                        </div>
                      </article>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </PublicSiteLayout>
  );
}
