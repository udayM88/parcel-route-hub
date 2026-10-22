import { ArrowLeft, BookOpen, CheckCircle2, Code2, Download, ExternalLink, KeyRound, PackageCheck, ShieldCheck, Webhook } from "lucide-react";
import { Link } from "react-router-dom";
import PageSeo from "@/components/PageSeo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const endpoint = "https://tksfdvnogzsweteetjjw.supabase.co/functions/v1/merchant-api";
const curl = [
  `curl -X POST '${endpoint}' \\`,
  "  -H 'Authorization: Bearer YOUR_API_KEY' \\",
  "  -H 'Content-Type: application/json' \\",
  "  -d '{\"action\":\"rates\",\"pickup_pincode\":\"411001\",\"delivery_pincode\":\"560001\",\"boxes\":[{\"weight_kg\":0.5}]}'",
].join("\n");

const actions = [
  ["rates", "Get account-scoped courier quotes including GST."],
  ["create_shipment", "Create one idempotent, wallet-funded shipment after account activation."],
  ["track", "Read tenant-scoped tracking events by booking ID or AWB."],
  ["label", "Retrieve a shipping label for a booked shipment."],
  ["cancel", "Cancel an eligible shipment and initiate its wallet refund."],
  ["wallet", "Read the prepaid merchant wallet balance."],
];

export default function MerchantApiDocs() {
  return (
    <div className="min-h-screen bg-[#f4f8fa] text-[#10233f]">
      <PageSeo title="Merchant API Documentation | ViaSetu" description="Integrate ViaSetu shipping, tracking and labels into WooCommerce, Next.js or any trusted backend." path="/developers/merchant-api" />
      <header className="sticky top-0 z-40 border-b border-cyan-900/10 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <Link to="/" className="flex items-center gap-3 font-black text-xl tracking-tight"><span className="grid size-9 place-items-center rounded-xl bg-[#11a7b7] text-white">V</span>ViaSetu <span className="hidden text-xs font-bold uppercase tracking-[0.2em] text-[#5d718a] sm:inline">Developers</span></Link>
          <div className="flex items-center gap-2"><Button asChild variant="outline"><Link to="/viasetuforbusinesses"><KeyRound />Merchant login</Link></Button><Button asChild className="hidden sm:inline-flex"><a href="/downloads/viasetu-woocommerce-0.2.0.zip" download><Download />WooCommerce plugin</a></Button></div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-5 py-10 lg:px-8 lg:py-14">
        <section className="overflow-hidden rounded-[28px] border border-cyan-900/10 bg-[#082f49] text-white shadow-xl shadow-cyan-950/10">
          <div className="grid gap-8 px-6 py-10 lg:grid-cols-[1.25fr_.75fr] lg:px-12 lg:py-14">
            <div><Badge className="mb-5 bg-cyan-400/15 text-cyan-100 hover:bg-cyan-400/15">Merchant API v1 beta</Badge><h1 className="max-w-3xl text-4xl font-black tracking-tight md:text-5xl">Build shipping into your commerce workflow.</h1><p className="mt-5 max-w-2xl text-lg leading-8 text-cyan-50/75">One server-side API for rates, wallet-funded shipments, tracking, labels, cancellations and signed status webhooks.</p><div className="mt-7 flex flex-wrap gap-3"><Button asChild size="lg" className="bg-[#20c4d2] text-[#062536] hover:bg-[#45d3df]"><a href="/downloads/viasetu-js-sdk.zip" download><Download />Download JS SDK</a></Button><Button asChild size="lg" variant="outline" className="border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white"><a href="/docs/merchant-api/openapi.yaml"><BookOpen />OpenAPI specification</a></Button></div></div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5"><p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">API endpoint</p><code className="block break-all text-sm leading-6 text-cyan-50">{endpoint}</code><div className="mt-6 space-y-3 text-sm text-cyan-50/80"><p className="flex gap-2"><ShieldCheck className="size-5 shrink-0 text-cyan-300" />Scoped, revocable merchant keys</p><p className="flex gap-2"><PackageCheck className="size-5 shrink-0 text-cyan-300" />Idempotent shipment requests</p><p className="flex gap-2"><Webhook className="size-5 shrink-0 text-cyan-300" />HMAC-signed webhook delivery</p></div></div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
          <Card className="border-cyan-900/10 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="text-[#0d99a8]" />Authentication</CardTitle><CardDescription>Use a merchant key only from a trusted server.</CardDescription></CardHeader><CardContent className="space-y-4 text-sm leading-6"><code className="block overflow-x-auto rounded-xl bg-[#eef5f7] p-4">Authorization: Bearer YOUR_API_KEY</code><p>Never expose a live key in a React client component, browser bundle, mobile application or public repository.</p><p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-950">Live shipment creation is account-gated. A gated request returns <code>wallet_setup_pending</code> without creating or charging a shipment.</p></CardContent></Card>
          <Card className="border-cyan-900/10 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2"><Code2 className="text-[#0d99a8]" />First request</CardTitle><CardDescription>Check rates from any Node.js, Next.js or backend service.</CardDescription></CardHeader><CardContent><pre className="overflow-x-auto rounded-xl bg-[#071e2e] p-5 text-xs leading-6 text-cyan-50"><code>{curl}</code></pre></CardContent></Card>
        </section>

        <section><div className="mb-4 flex items-end justify-between gap-4"><div><h2 className="text-2xl font-black">API actions</h2><p className="mt-1 text-sm text-[#5d718a]">Every request is POST JSON with an action field.</p></div><Button asChild variant="outline"><a href="/docs/merchant-api/quickstart.md"><ExternalLink />Raw quickstart</a></Button></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{actions.map(([name, description]) => <Card key={name} className="border-cyan-900/10"><CardHeader><CardTitle className="font-mono text-base text-[#087f8d]">{name}</CardTitle><CardDescription className="leading-6">{description}</CardDescription></CardHeader></Card>)}</div></section>

        <section className="grid gap-5 md:grid-cols-2"><Card className="border-cyan-900/10"><CardHeader><CardTitle>JavaScript / TypeScript SDK</CardTitle><CardDescription>Typed, dependency-free server client with timeouts, structured errors and safe retries for read actions.</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-3"><Button asChild><a href="/downloads/viasetu-js-sdk.zip" download><Download />Download SDK</a></Button><Button asChild variant="outline"><a href="/docs/merchant-api/openapi.yaml"><BookOpen />OpenAPI YAML</a></Button></CardContent></Card><Card className="border-cyan-900/10"><CardHeader><CardTitle>WooCommerce connector 0.2.0</CardTitle><CardDescription>Guided setup, live checkout choices, product rules, order sync, labels, cancellations and signed webhook updates.</CardDescription></CardHeader><CardContent className="space-y-3"><p className="flex items-center gap-2 text-sm"><CheckCircle2 className="size-4 text-emerald-600" />Credentials stay on the WordPress server</p><Button asChild><a href="/downloads/viasetu-woocommerce-0.2.0.zip" download><Download />Download plugin beta</a></Button></CardContent></Card></section>

        <footer className="flex flex-col justify-between gap-4 border-t border-cyan-900/10 py-7 text-sm text-[#5d718a] sm:flex-row"><Link to="/" className="inline-flex items-center gap-2 font-bold text-[#087f8d]"><ArrowLeft className="size-4" />Back to ViaSetu</Link><span>Rate limit: 120 requests/minute by default · Errors are structured JSON</span></footer>
      </main>
    </div>
  );
}
