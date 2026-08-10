import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Loader2 } from 'lucide-react';
import type { CmsContent } from '@/lib/cms/types';
import PublicSiteLayout from '@/components/site/PublicSiteLayout';

const FALLBACK_FAQS: { title: string; body_html: string }[] = [
  {
    title: 'What is ViaSetu?',
    body_html: '<p>ViaSetu is India\'s smart courier aggregator app that lets you compare real-time prices and delivery times from leading courier partners like Delhivery, Shadowfax, Xpressbees, Urbanebolt and Shree Maruti — all in one place.</p>',
  },
  {
    title: 'Do I need an account to book a shipment?',
    body_html: '<p>Yes — a quick phone-OTP login is required to fetch live rates and create a booking. Tracking a shipment with an AWB number is completely open and does not need login.</p>',
  },
  {
    title: 'How is my final price calculated?',
    body_html: '<p>Your price = Base Fare (from courier) + 18% GST. The platform fee is already included in the displayed Base Fare so you see one clean total, rounded to whole numbers.</p>',
  },
  {
    title: 'Which payment methods are supported?',
    body_html: '<p>UPI (GPay, PhonePe, Paytm), credit/debit cards and net banking via Razorpay. Cash on Delivery (COD) is <strong>not</strong> available.</p>',
  },
  {
    title: 'When will my parcel be picked up?',
    body_html: '<p>Most doorstep pickups are scheduled within 24 hours of booking. Express partners like Delhivery and Shadowfax offer same-day pickup in metro cities during operational hours.</p>',
  },
  {
    title: 'Can I cancel my booking?',
    body_html: '<p>Yes, you can cancel before pickup from your order details page. Once the cancellation is confirmed by the partner, we trigger an automatic Razorpay refund to your original payment method.</p>',
  },
  {
    title: 'How do I track my shipment?',
    body_html: '<p>Go to the <a href="/tracking">Tracking page</a> and enter your AWB number. We normalize tracking events from every partner so you see one consistent, real-time timeline.</p>',
  },
  {
    title: 'What if my pincode is not serviceable?',
    body_html: '<p>ViaSetu checks serviceability live across all 5 partners. If one does not cover your pincode, we automatically show the others that do. We never silently fall back to India Post.</p>',
  },
  {
    title: 'Is my parcel insured during transit?',
    body_html: '<p>Delhivery and Xpressbees include built-in liability coverage. Optional declared-value insurance is shown at checkout for high-value shipments — details are displayed per partner before confirmation.</p>',
  },
  {
    title: 'Can I download a GST invoice and shipping label?',
    body_html: '<p>Yes. Every successful booking generates a GST-compliant invoice and a printable shipping label, both downloadable from the order details page.</p>',
  },
  {
    title: 'Do you support bulk or B2B shipments?',
    body_html: '<p>ViaSetu is currently optimized for individual parcel shipments. Bulk and B2B freight features are coming soon — <a href="/contact">contact us</a> for high-volume requirements.</p>',
  },
  {
    title: 'How do I become a courier partner?',
    body_html: '<p>Visit our <a href="/courier-partners">Courier Partners</a> page to learn about the partnership program, eligibility and the onboarding process.</p>',
  },
];

export default function FaqPage() {
  const [faqs, setFaqs] = useState<CmsContent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase.from('cms_content')
      .select('*')
      .eq('type', 'faq').eq('status', 'published')
      .order('faq_order', { ascending: true, nullsFirst: false });
    setFaqs((data || []) as unknown as CmsContent[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('public:cms_content:faq')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cms_content', filter: 'type=eq.faq' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const displayFaqs = faqs.length > 0
    ? faqs.map(f => ({ id: f.id, title: f.title, body_html: f.body_html || '' }))
    : FALLBACK_FAQS.map((f, i) => ({ id: `fallback-${i}`, title: f.title, body_html: f.body_html }));

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: displayFaqs.map(f => ({
      '@type': 'Question',
      name: f.title,
      acceptedAnswer: { '@type': 'Answer', text: (f.body_html || '').replace(/<[^>]+>/g, ' ') },
    })),
  };

  return (
    <PublicSiteLayout>
      <div className="container mx-auto px-4 py-16 max-w-6xl">
        <Helmet>
          <title>FAQ — Frequently Asked Questions | ViaSetu</title>
          <meta name="description" content="Answers to common questions about ViaSetu courier booking, pricing, tracking, cancellation, refunds and more." />
          <link rel="canonical" href="https://www.viasetu.com/faq" />
          <script type="application/ld+json">{JSON.stringify(schema)}</script>
        </Helmet>
        <h1 className="text-4xl md:text-5xl font-bold text-center mb-3" style={{ color: '#0B1220' }}>FAQs</h1>
        <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">Quick answers about booking, pricing, pickup, tracking and refunds on ViaSetu.</p>
        {loading ? (
          <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <Accordion
            type="single"
            collapsible
            className="grid grid-cols-1 md:grid-cols-2 md:gap-x-12"
          >
            {displayFaqs.map(f => (
              <AccordionItem
                key={f.id}
                value={f.id}
                className="border-0 border-b border-border h-fit [&[data-state=open]_.faq-icon]:rotate-45"
              >
                <AccordionTrigger className="text-left text-base md:text-lg font-semibold py-5 hover:no-underline [&>svg]:hidden gap-4" style={{ color: '#0B1220' }}>
                  <span>{f.title}</span>
                  <span className="faq-icon shrink-0 text-2xl font-light text-muted-foreground transition-transform duration-200 leading-none">+</span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="prose prose-slate max-w-none pb-2" dangerouslySetInnerHTML={{ __html: f.body_html || '' }} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>
    </PublicSiteLayout>
  );
}
