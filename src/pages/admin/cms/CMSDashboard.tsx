import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, LayoutGrid, HelpCircle, Truck, Mail } from 'lucide-react';

const TYPES = [
  { type: 'post', label: 'Blog Posts', icon: FileText, path: '/admin/cms/posts' },
  { type: 'page', label: 'Landing Pages', icon: LayoutGrid, path: '/admin/cms/pages' },
  { type: 'faq', label: 'FAQs', icon: HelpCircle, path: '/admin/cms/faqs' },
  { type: 'partner', label: 'Partner Pages', icon: Truck, path: '/admin/cms/partners' },
] as const;

export default function CMSDashboard() {
  const [counts, setCounts] = useState<Record<string, { total: number; published: number }>>({});

  useEffect(() => {
    (async () => {
      const result: Record<string, { total: number; published: number }> = {};
      for (const t of TYPES) {
        const { count: total } = await supabase.from('cms_content').select('id', { count: 'exact', head: true }).eq('type', t.type);
        const { count: pub } = await supabase.from('cms_content').select('id', { count: 'exact', head: true }).eq('type', t.type).eq('status', 'published');
        result[t.type] = { total: total || 0, published: pub || 0 };
      }
      setCounts(result);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">CMS</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {TYPES.map(({ type, label, icon: Icon, path }) => (
          <Link key={type} to={path}>
            <Card className="hover:border-primary transition-colors h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{counts[type]?.total ?? '–'}</div>
                <p className="text-xs text-muted-foreground">{counts[type]?.published ?? 0} published</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <Link to="/admin/cms/emails" className="block">
        <Card className="hover:border-primary transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Email Notifications</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Enable or disable order emails, edit templates and subjects, manage To / CC / Reply-To,
              send test emails and review delivery logs.
            </p>
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
