import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import RichTextEditor from '@/components/admin/cms/RichTextEditor';
import MediaUpload, { uploadCmsImage } from '@/components/admin/cms/MediaUpload';
import SEOPanel from '@/components/admin/cms/SEOPanel';
import TagInput from '@/components/admin/cms/TagInput';
import { CONTENT_TYPE_LABELS, CONTENT_TYPE_PATHS, slugify, type CmsContent, type CmsContentType } from '@/lib/cms/types';
import { analyzeSeo } from '@/lib/cms/seo-score';
import { Loader2, Save, ArrowLeft, ExternalLink, Plus, Eye } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  type: CmsContentType;
}

export default function ContentEditor({ type }: Props) {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<Partial<CmsContent>>({
    type, title: '', slug: '', body_html: '', status: 'draft',
    schema_type: type === 'faq' ? 'FAQPage' : 'Article',
    robots: 'index,follow', tags: [],
  });
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [authors, setAuthors] = useState<Array<{ id: string; name: string }>>([]);
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [creatingCat, setCreatingCat] = useState(false);
  const [authorDialogOpen, setAuthorDialogOpen] = useState(false);
  const [newAuthorName, setNewAuthorName] = useState('');
  const [creatingAuthor, setCreatingAuthor] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const loadCategories = () =>
    supabase.from('cms_categories').select('id,name').order('name').then(({ data }) => setCategories(data || []));
  const loadAuthors = () =>
    supabase.from('cms_authors').select('id,name').order('name').then(({ data }) => setAuthors(data || []));


  useEffect(() => {
    loadCategories();
    loadAuthors();
  }, []);

  const createAuthor = async () => {
    const name = newAuthorName.trim();
    if (!name) return;
    setCreatingAuthor(true);
    const { data: row, error } = await supabase.from('cms_authors')
      .insert({ name, slug: slugify(name) }).select('id,name').single();
    setCreatingAuthor(false);
    if (error) { toast.error(error.message); return; }
    await loadAuthors();
    patch({ author_id: row.id });
    setNewAuthorName('');
    setAuthorDialogOpen(false);
    toast.success('Author created');
  };


  const createCategory = async () => {
    const name = newCatName.trim();
    if (!name) return;
    setCreatingCat(true);
    const { data: row, error } = await supabase.from('cms_categories')
      .insert({ name, slug: slugify(name) }).select('id,name').single();
    setCreatingCat(false);
    if (error) { toast.error(error.message); return; }
    await loadCategories();
    patch({ category_id: row.id });
    setNewCatName('');
    setCatDialogOpen(false);
    toast.success('Category created');
  };


  // Track whether the user has manually edited the slug so auto-sync stops touching it.
  const slugTouchedRef = useRef(false);
  // Guard so we never re-hydrate from DB after first load (would wipe in-progress edits).
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (isNew) { hydratedRef.current = true; return; }
    if (hydratedRef.current) return;
    supabase.from('cms_content').select('*').eq('id', id!).single().then(({ data, error }) => {
      if (error) { toast.error(error.message); navigate(-1); return; }
      setData(data as unknown as CmsContent);
      slugTouchedRef.current = true; // existing record — never auto-overwrite
      hydratedRef.current = true;
      setLoading(false);
    });
  }, [id, isNew, navigate]);

  const patch = useCallback((p: Partial<CmsContent>) => setData((d) => ({ ...d, ...p })), []);

  const handleTitleChange = (title: string) => {
    if (isNew && !slugTouchedRef.current) {
      patch({ title, slug: slugify(title) });
    } else {
      patch({ title });
    }
  };

  const handleSlugChange = (raw: string) => {
    slugTouchedRef.current = true;
    patch({ slug: slugify(raw) });
  };

  const ensureUniqueSlug = async (base: string, excludeId?: string): Promise<string> => {
    let slug = base;
    let n = 1;
    while (n < 100) {
      let q = supabase.from('cms_content').select('id').eq('type', type).eq('slug', slug).limit(1);
      if (excludeId) q = q.neq('id', excludeId);
      const { data: rows } = await q;
      if (!rows || rows.length === 0) return slug;
      n += 1;
      slug = `${base}-${n}`;
    }
    return `${base}-${Date.now()}`;
  };

  const save = async (publish?: boolean) => {
    if (saving) return;
    if (!data.title?.trim()) { toast.error('Title required'); return; }
    if (!data.slug?.trim()) { toast.error('Slug required'); return; }
    setSaving(true);
    try {
      const seo = analyzeSeo(data);
      const uniqueSlug = await ensureUniqueSlug(slugify(data.slug), isNew ? undefined : id!);
      const nowIso = new Date().toISOString();
      const willPublish = publish === true;
      const newPublishedAt = willPublish && !data.published_at ? nowIso : data.published_at;
      const newStatus = publish === undefined
        ? (data.status || 'draft')
        : (willPublish ? 'published' : 'draft');

      const payload: Record<string, unknown> = {
        ...data,
        slug: uniqueSlug,
        type,
        seo_score: seo.score,
        status: newStatus,
        published_at: newPublishedAt,
      };
      delete payload.id;
      delete payload.created_at;
      delete payload.updated_at;
      // canonical_url is managed by a DB trigger from (type, slug). Never send it from the client.
      delete payload.canonical_url;

      if (isNew) {
        const { data: row, error } = await supabase.from('cms_content').insert(payload as never).select('id').single();
        if (error) { toast.error(error.message); return; }
        // Sync local state so a remount/re-fetch doesn't surprise the user.
        patch({ slug: uniqueSlug, status: newStatus as CmsContent['status'], published_at: newPublishedAt as string | null });
        toast.success(willPublish ? 'Published' : 'Created');
        hydratedRef.current = true; // route changes but data already current
        navigate(`/admin/cms/${type}s/${row.id}`, { replace: true });
      } else {
        const { error } = await supabase.from('cms_content').update(payload as never).eq('id', id!);
        if (error) { toast.error(error.message); return; }
        patch({ slug: uniqueSlug, status: newStatus as CmsContent['status'], published_at: newPublishedAt as string | null });
        toast.success(willPublish ? 'Published' : 'Saved');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const publicUrl = `${CONTENT_TYPE_PATHS[type]}/${data.slug}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/cms/${type}s`)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <h1 className="text-xl font-semibold">{isNew ? `New ${CONTENT_TYPE_LABELS[type]}` : `Edit ${CONTENT_TYPE_LABELS[type]}`}</h1>
        </div>
        <div className="flex gap-2">
          {!isNew && data.status === 'published' && (
            <Button variant="outline" size="sm" asChild>
              <a href={publicUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 mr-1" /> View</a>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
            <Eye className="h-4 w-4 mr-1" /> Preview
          </Button>
          <Button variant="outline" size="sm" onClick={() => save(false)} disabled={saving}>
            <Save className="h-4 w-4 mr-1" /> Save Draft
          </Button>
          <Button size="sm" onClick={() => save(true)} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : data.status === 'published' ? 'Update' : 'Publish'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input id="title" value={data.title || ''} onChange={(e) => handleTitleChange(e.target.value)} className="text-lg" />
              </div>
              <div>
                <Label htmlFor="slug">Slug</Label>
                <div className="flex items-center gap-1 text-sm">
                  <span className="text-muted-foreground">{CONTENT_TYPE_PATHS[type]}/</span>
                  <Input id="slug" value={data.slug || ''} onChange={(e) => handleSlugChange(e.target.value)} />
                </div>
              </div>
              <div>
                <Label htmlFor="excerpt">Excerpt</Label>
                <Textarea id="excerpt" value={data.excerpt || ''} onChange={(e) => patch({ excerpt: e.target.value })} rows={2} />
              </div>
            </CardContent>
          </Card>

          {type === 'faq' ? (
            <Card>
              <CardHeader><CardTitle className="text-base">Answer</CardTitle></CardHeader>
              <CardContent>
                <RichTextEditor value={data.body_html || ''} onChange={(html) => patch({ body_html: html })}
                  onInsertImage={async () => {
                    const f = await pickFile(); return f ? uploadCmsImage(f) : null;
                  }} />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader><CardTitle className="text-base">Content</CardTitle></CardHeader>
              <CardContent>
                <RichTextEditor value={data.body_html || ''} onChange={(html) => patch({ body_html: html })}
                  onInsertImage={async () => {
                    const f = await pickFile(); return f ? uploadCmsImage(f) : null;
                  }} />
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Publish</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium capitalize">{data.status}</span>
              </div>
              {type === 'post' && (
                <>
                  <div>
                    <Label>Category</Label>
                    <div className="flex gap-1">
                      <Select value={data.category_id || 'none'} onValueChange={(v) => patch({ category_id: v === 'none' ? null : v })}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="None" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" size="icon" title="New category" onClick={() => setCatDialogOpen(true)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label>Author</Label>
                    <div className="flex gap-1">
                      <Select value={data.author_id || 'none'} onValueChange={(v) => patch({ author_id: v === 'none' ? null : v })}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="None" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {authors.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" size="icon" title="New author" onClick={() => setAuthorDialogOpen(true)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label>Tags</Label>
                    <TagInput value={data.tags || []} onChange={(tags) => patch({ tags })} />
                  </div>

                </>
              )}
              {type === 'partner' && (
                <div>
                  <Label>Partner Code</Label>
                  <Input value={data.partner_code || ''} onChange={(e) => patch({ partner_code: e.target.value })} placeholder="dhl, delhivery..." />
                </div>
              )}
              {type === 'faq' && (
                <div>
                  <Label>Display Order</Label>
                  <Input type="number" value={data.faq_order ?? ''} onChange={(e) => patch({ faq_order: e.target.value ? Number(e.target.value) : null })} />
                </div>
              )}
            </CardContent>
          </Card>

          {type !== 'faq' && (
            <Card>
              <CardContent className="pt-6 space-y-2">
                <MediaUpload value={data.featured_image_url} onChange={(url) => patch({ featured_image_url: url })} />
                {data.featured_image_url && (
                  <div>
                    <Label htmlFor="alt">Alt Text</Label>
                    <Input id="alt" value={data.featured_image_alt || ''} onChange={(e) => patch({ featured_image_alt: e.target.value })} />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">SEO (Yoast)</CardTitle></CardHeader>
            <CardContent><SEOPanel content={data} onChange={patch} /></CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4" /> Preview
              <span className="text-xs font-normal text-muted-foreground">{publicUrl}</span>
            </DialogTitle>
          </DialogHeader>
          <article className="pb-4">
            <h1 className="text-2xl md:text-3xl font-bold mb-3">{data.title || 'Untitled'}</h1>
            {data.excerpt && <p className="text-muted-foreground mb-4">{data.excerpt}</p>}
            {data.featured_image_url && (
              <img src={data.featured_image_url} alt={data.featured_image_alt || data.title || ''}
                className="w-full rounded-xl mb-6" />
            )}
            <div className="cms-content prose prose-slate max-w-none"
              dangerouslySetInnerHTML={{ __html: data.body_html || '<p class="text-muted-foreground">No content yet.</p>' }} />
            {data.tags && data.tags.length > 0 && (
              <div className="mt-8 pt-4 border-t flex flex-wrap gap-2">
                {data.tags.map(t => <span key={t} className="text-xs px-2 py-1 rounded bg-muted">#{t}</span>)}
              </div>
            )}
          </article>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>New category</DialogTitle></DialogHeader>
          <div>
            <Label htmlFor="cat-name">Name</Label>
            <Input id="cat-name" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); createCategory(); } }} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialogOpen(false)}>Cancel</Button>
            <Button onClick={createCategory} disabled={creatingCat || !newCatName.trim()}>
              {creatingCat ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={authorDialogOpen} onOpenChange={setAuthorDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>New author</DialogTitle></DialogHeader>
          <div>
            <Label htmlFor="author-name">Name</Label>
            <Input id="author-name" value={newAuthorName} onChange={(e) => setNewAuthorName(e.target.value)} autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); createAuthor(); } }} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAuthorDialogOpen(false)}>Cancel</Button>
            <Button onClick={createAuthor} disabled={creatingAuthor || !newAuthorName.trim()}>
              {creatingAuthor ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function pickFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = () => resolve(input.files?.[0] || null);
    input.click();
  });
}
