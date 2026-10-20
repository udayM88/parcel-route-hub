import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, CheckCircle2, Code2, ExternalLink, Plug, ShieldCheck, Store, Webhook } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageSeo from "@/components/PageSeo";
import wooCommerceLogo from "@/assets/merchant-console/woocommerce.png";
import wordPressLogo from "@/assets/merchant-console/wordpress.png";
import shopifyLogo from "@/assets/merchant-console/shopify.svg";

type IntegrationTab = "channels" | "plugins" | "api";

const integrationCards = [
  {
    title: "WooCommerce",
    description: "Import orders, create shipments and return tracking updates to your WordPress store.",
    logo: wooCommerceLogo,
    logoAlt: "WooCommerce",
    status: "Plugin planned",
  },
  {
    title: "Shopify",
    description: "A future channel connector for store orders, fulfilment status and shipment tracking.",
    logo: shopifyLogo,
    logoAlt: "Shopify",
    status: "Roadmap",
  },
];

export default function BusinessIntegrations() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const requestedTab = params.get("tab");
  const [tab, setTab] = useState<IntegrationTab>(requestedTab === "plugins" || requestedTab === "api" ? requestedTab : "channels");

  useEffect(() => {
    const next = params.get("tab");
    setTab(next === "plugins" || next === "api" ? next : "channels");
  }, [params]);

  const changeTab = (value: string) => {
    const next = value as IntegrationTab;
    setTab(next);
    setParams(next === "channels" ? {} : { tab: next }, { replace: true });
  };

  return (
    <div className="flex flex-col gap-5">
      <PageSeo title="Integrations | ViaSetu Merchant Console" description="Connect e-commerce channels, plugins and server-side APIs." path="/viasetuforbusinesses/integrations" />
      <div className="merchant-integration-heading flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Integration Hub</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Connect a storefront or use ViaSetu's merchant API from your server. No connection is created until you explicitly complete its setup.</p>
        </div>
        <Button onClick={() => navigate("/viasetuforbusinesses/developers")}>
          <Code2 data-icon="inline-start" />
          Open developer tools
        </Button>
      </div>

      <Tabs value={tab} onValueChange={changeTab} className="flex flex-col gap-4">
        <TabsList className="w-full justify-start overflow-x-auto border bg-card/90 p-1 shadow-sm md:w-fit">
          <TabsTrigger value="channels"><Store data-icon="inline-start" />Channels</TabsTrigger>
          <TabsTrigger value="plugins"><Plug data-icon="inline-start" />Plugins</TabsTrigger>
          <TabsTrigger value="api"><Webhook data-icon="inline-start" />API & Webhooks</TabsTrigger>
        </TabsList>

        <TabsContent value="channels" className="mt-0">
          <div className="grid gap-4 lg:grid-cols-2">
            {integrationCards.map((item) => (
              <Card key={item.title} className="merchant-surface">
                <CardHeader className="flex-row items-start gap-4">
                  <div className="merchant-logo-tile grid size-14 shrink-0 place-items-center rounded-xl border p-2">
                    <img src={item.logo} alt={item.logoAlt} className="max-h-full max-w-full object-contain" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-lg">{item.title}</CardTitle>
                      <Badge variant="secondary">{item.status}</Badge>
                    </div>
                    <CardDescription className="mt-2">{item.description}</CardDescription>
                  </div>
                </CardHeader>
                <CardFooter className="justify-between border-t pt-4">
                  <span className="text-xs text-muted-foreground">Account-scoped integration</span>
                  <Button variant="outline" disabled>Configure <ArrowRight data-icon="inline-end" /></Button>
                </CardFooter>
              </Card>
            ))}
            <Card className="merchant-surface">
              <CardHeader className="flex-row items-start gap-4">
                <div className="merchant-logo-tile grid size-14 shrink-0 place-items-center rounded-xl border text-primary"><Code2 /></div>
                <div>
                  <CardTitle className="text-lg">Custom website or app</CardTitle>
                  <CardDescription className="mt-2">Use a merchant API key from a Next.js server, backend service or another trusted server environment.</CardDescription>
                </div>
              </CardHeader>
              <CardFooter className="justify-end border-t pt-4">
                <Button variant="outline" onClick={() => navigate("/viasetuforbusinesses/developers")}>View API access <ExternalLink data-icon="inline-end" /></Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="plugins" className="mt-0">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <Card className="merchant-surface">
              <CardHeader className="flex-row items-start gap-4">
                <div className="merchant-logo-tile grid size-16 shrink-0 place-items-center rounded-2xl border p-2">
                  <img src={wordPressLogo} alt="WordPress" className="max-h-full max-w-full object-contain" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle>ViaSetu for WooCommerce</CardTitle>
                    <Badge>Planned</Badge>
                  </div>
                  <CardDescription className="mt-2">The approved plugin will sync orders server-to-server, create labels and push shipment status back to WooCommerce.</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {["Scoped merchant key", "Idempotent order import", "AWB and label sync", "Signed webhook updates"].map((feature) => (
                  <div key={feature} className="flex items-center gap-2 rounded-lg border bg-card/70 p-3 text-sm font-semibold transition-colors hover:border-primary/30 hover:bg-accent/60">
                    <CheckCircle2 className="size-4 text-primary" />{feature}
                  </div>
                ))}
              </CardContent>
              <CardFooter className="border-t pt-4">
                <Button disabled>Plugin package not released</Button>
              </CardFooter>
            </Card>
            <Card className="merchant-surface">
              <CardHeader>
                <CardTitle className="text-base">Release gate</CardTitle>
                <CardDescription>The plugin remains disabled until the live shipment API passes refund, rate-verification and replay tests.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <div className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" />Server-side credentials only</div>
                <div className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" />Signed package and update channel</div>
                <div className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" />Rollback-tested release</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="api" className="mt-0">
          <Alert>
            <ShieldCheck />
            <AlertTitle>Use API keys only on a trusted server</AlertTitle>
            <AlertDescription>Never place a live merchant key in React browser code, WordPress JavaScript or a public repository.</AlertDescription>
          </Alert>
          <Card className="merchant-surface mt-4">
            <CardHeader>
              <CardTitle>Merchant API workspace</CardTitle>
              <CardDescription>Create or revoke scoped keys and review request examples in the existing developer screen.</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button onClick={() => navigate("/viasetuforbusinesses/developers")}>Manage API keys <ArrowRight data-icon="inline-end" /></Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
