import { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { analyzeSeo } from '@/lib/cms/seo-score';
import type { CmsContent } from '@/lib/cms/types';
import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface Props {
  content: Partial<CmsContent>;
  onChange: (patch: Partial<CmsContent>) => void;
}

export default function SEOPanel({ content, onChange }: Props) {
  const analysis = useMemo(() => analyzeSeo(content), [
    content.title, content.slug, content.body_html, content.excerpt,
    content.meta_title, content.meta_description, content.focus_keyphrase,
    content.featured_image_url, content.featured_image_alt,
  ]);
  const ringColor = analysis.rating === 'good' ? 'text-green-600' : analysis.rating === 'ok' ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">SEO Score</span>
          <span className={`text-lg font-bold ${ringColor}`}>{analysis.score}/100</span>
        </div>
        <Progress value={analysis.score} className="h-2" />
        <ul className="space-y-1.5 text-xs">
          {analysis.checks.map((c) => (
            <li key={c.id} className="flex items-start gap-2">
              {c.status === 'good' && <CheckCircle2 className="h-3.5 w-3.5 text-green-600 mt-0.5 shrink-0" />}
              {c.status === 'warning' && <AlertCircle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />}
              {c.status === 'bad' && <XCircle className="h-3.5 w-3.5 text-red-600 mt-0.5 shrink-0" />}
              <span><strong className="font-medium">{c.label}:</strong> {c.message}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3">
        <div>
          <Label htmlFor="focus_keyphrase">Focus Keyphrase</Label>
          <Input id="focus_keyphrase" value={content.focus_keyphrase || ''}
            onChange={(e) => onChange({ focus_keyphrase: e.target.value })}
            placeholder="e.g. cheapest courier delhi to mumbai" />
        </div>
        <div>
          <Label htmlFor="meta_title">Meta Title <span className="text-xs text-muted-foreground">({(content.meta_title || '').length}/60)</span></Label>
          <Input id="meta_title" value={content.meta_title || ''}
            onChange={(e) => onChange({ meta_title: e.target.value })} maxLength={70} />
        </div>
        <div>
          <Label htmlFor="meta_description">Meta Description <span className="text-xs text-muted-foreground">({(content.meta_description || '').length}/160)</span></Label>
          <Textarea id="meta_description" value={content.meta_description || ''}
            onChange={(e) => onChange({ meta_description: e.target.value })} rows={3} maxLength={180} />
        </div>
        <div>
          <Label>Canonical URL</Label>
          <div className="flex items-center rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            <span className="truncate" title={content.canonical_url || ''}>
              {content.canonical_url || 'Auto-generated on save from the slug above'}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Canonical URLs are managed automatically and stay in sync with the live URL whenever the slug changes.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Schema Type</Label>
            <Select value={content.schema_type || 'Article'} onValueChange={(v) => onChange({ schema_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Article">Article</SelectItem>
                <SelectItem value="BlogPosting">BlogPosting</SelectItem>
                <SelectItem value="WebPage">WebPage</SelectItem>
                <SelectItem value="FAQPage">FAQPage</SelectItem>
                <SelectItem value="Product">Product</SelectItem>
                <SelectItem value="Organization">Organization</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Robots</Label>
            <Select value={content.robots || 'index,follow'} onValueChange={(v) => onChange({ robots: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="index,follow">index, follow</SelectItem>
                <SelectItem value="noindex,follow">noindex, follow</SelectItem>
                <SelectItem value="index,nofollow">index, nofollow</SelectItem>
                <SelectItem value="noindex,nofollow">noindex, nofollow</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded border p-3 bg-muted/30">
          <div className="text-xs text-muted-foreground mb-1">Google preview</div>
          <div className="text-blue-700 text-base truncate">{content.meta_title || content.title || 'Title'}</div>
          <div className="text-green-700 text-xs truncate">https://www.viasetu.com/{content.slug || 'slug'}</div>
          <div className="text-sm text-foreground line-clamp-2">{content.meta_description || 'Meta description preview...'}</div>
        </div>
      </div>
    </div>
  );
}
