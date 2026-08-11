import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import EmailNotificationsPanel from '@/components/admin/email/EmailNotificationsPanel';

export default function CmsEmails() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/cms"><ArrowLeft className="h-4 w-4 mr-1" /> CMS</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Email Notifications</h1>
          <p className="text-sm text-muted-foreground">
            Manage notification templates, recipients, test sends and delivery logs.
          </p>
        </div>
      </div>
      <EmailNotificationsPanel />
    </div>
  );
}
