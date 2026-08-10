import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import PublicSiteLayout from "@/components/site/PublicSiteLayout";
import {
  Truck,
  Globe,
  ShieldCheck,
  Zap,
  MapPin,
  Star,
  ArrowRight,
  Phone,
  Mail,
  CheckCircle2,
} from "lucide-react";
import delhiveryLogo from "@/assets/delhivery.svg";
import shadowfaxLogo from "@/assets/shadowfax.svg";
import xpressbeesLogo from "@/assets/xpressbees.svg";
import shreeMarutiLogo from "@/assets/shree-maruti.svg";
import urbaneboltLogo from "@/assets/urbanebolt.svg";

const C = {
  bg: "#FFFFFF",
  bg2: "#F4F7FB",
  teal: "#00A8A8",
  text: "#0B1220",
  gray: "#5A6B80",
  border: "#E2E8F0",
};

const partners = [
  {
    name: "Delhivery",
    logo: delhiveryLogo,
    tagline: "India's Largest Supply Chain Company",
    description:
      "Delhivery is India's leading integrated logistics provider, covering 18,500+ pin codes with express parcel, freight, cross-border and warehousing services. ViaSetu integrates directly with Delhivery for real-time booking, label generation and tracking.",
    highlights: [
      { icon: MapPin, text: "18,500+ Pin codes covered" },
      { icon: Zap, text: "Express & same-day delivery" },
      { icon: Globe, text: "Cross-border shipping" },
      { icon: ShieldCheck, text: "Insurance & COD support" },
    ],
    services: ["Surface", "Air Express", "Same-Day Metro", "B2B Freight"],
  },
  {
    name: "Shadowfax",
    logo: shadowfaxLogo,
    tagline: "Last-Mile Delivery Specialist",
    description:
      "Shadowfax is India's fastest-growing last-mile logistics platform, trusted by leading e-commerce and D2C brands. ViaSetu leverages Shadowfax for reliable RVP (Reverse Pickup), hyperlocal and metro-centric deliveries.",
    highlights: [
      { icon: MapPin, text: "500+ Cities operational" },
      { icon: Zap, text: "Hyperlocal & instant delivery" },
      { icon: Truck, text: "Reverse logistics (RVP)" },
      { icon: Star, text: "Real-time rider tracking" },
    ],
    services: ["Hyperlocal", "Same-Day", "Reverse Pickup", "Metro Express"],
  },
  {
    name: "Xpressbees",
    logo: xpressbeesLogo,
    tagline: "E-Commerce Logistics Leader",
    description:
      "Xpressbees powers logistics for some of India's biggest online marketplaces. Their pan-India surface and air network, combined with deep e-commerce expertise, makes them a strong partner for high-volume B2C shipments.",
    highlights: [
      { icon: MapPin, text: "20,000+ Pin codes served" },
      { icon: Zap, text: "Same-day & next-day air" },
      { icon: Truck, text: "Heavy & bulk shipments" },
      { icon: ShieldCheck, text: "NFO (Next Flight Out)" },
    ],
    services: ["Surface", "Air Express", "Bulk B2B", "NFO"],
  },
  {
    name: "Shree Maruti",
    logo: shreeMarutiLogo,
    tagline: "Regional Express Network",
    description:
      "Shree Maruti Courier brings decades of regional expertise with a strong presence in Tier-2 and Tier-3 cities. Their reliable ground network complements ViaSetu's coverage for cost-effective surface deliveries.",
    highlights: [
      { icon: MapPin, text: "Strong Tier-2/3 coverage" },
      { icon: Zap, text: "Quick regional transit" },
      { icon: Truck, text: "Economy surface service" },
      { icon: ShieldCheck, text: "Doorstep pickup & delivery" },
    ],
    services: ["Surface Economy", "Regional Express", "Document Courier"],
  },
  {
    name: "Urbanebolt",
    logo: urbaneboltLogo,
    tagline: "Emerging Smart Logistics",
    description:
      "Urbanebolt is an emerging logistics partner focused on tech-enabled shipping with competitive pricing and straightforward API integrations. Ideal for small sellers and startups looking for affordable express options.",
    highlights: [
      { icon: MapPin, text: "Pan-India expanding network" },
      { icon: Zap, text: "Competitive express rates" },
      { icon: Truck, text: "Easy API integration" },
      { icon: Star, text: "Startup-friendly pricing" },
    ],
    services: ["Standard Express", "Economy Surface", "API-first Booking"],
  },
];

const faqs = [
  {
    q: "Which courier partners does ViaSetu integrate with?",
    a: "ViaSetu currently integrates with Delhivery, Shadowfax, Xpressbees, Shree Maruti and Urbanebolt — covering national express, last-mile, e-commerce logistics, regional networks and emerging tech-first carriers.",
  },
  {
    q: "Can I choose a specific courier partner for my shipment?",
    a: "Yes. During booking, ViaSetu shows all available partners for your origin-destination pair with live rates, ETAs and ratings — so you can pick the one that fits your timeline and budget.",
  },
  {
    q: "Do all partners support doorstep pickup?",
    a: "Most partners on ViaSetu offer doorstep pickup. Availability is shown in real time during booking based on your pickup pincode and the partner's serviceability.",
  },
  {
    q: "Which partner is best for same-day or next-day delivery?",
    a: "Delhivery and Shadowfax offer the strongest same-day and next-day metro coverage. Xpressbees also provides next-day air services for select corridors. The best option for your route is surfaced automatically.",
  },
  {
    q: "Do partners offer shipment insurance?",
    a: "Delhivery and Xpressbees offer built-in liability coverage, with optional declared-value insurance available at checkout. Coverage details are shown per partner before you confirm your booking.",
  },
  {
    q: "How is tracking unified across partners?",
    a: "ViaSetu normalizes tracking events from every partner into a single, consistent timeline — picked, in-transit, out-for-delivery and delivered — so you track all shipments in one place regardless of carrier.",
  },
];

export default function CourierPartners() {
  const navigate = useNavigate();

  return (
    <PublicSiteLayout>
      <Helmet>
        <title>Courier Partners — ViaSetu</title>
        <meta
          name="description"
          content="ViaSetu partners with India's leading courier companies — Delhivery, Shadowfax, Xpressbees, Shree Maruti and Urbanebolt — to bring you the best shipping options in one place."
        />
        <link rel="canonical" href="https://www.viasetu.com/courier-partners" />
        <meta property="og:title" content="Courier Partners — ViaSetu" />
        <meta
          property="og:description"
          content="Compare and book with India's top courier partners on a single platform."
        />
      </Helmet>

      {/* Hero */}
      <section
        className="px-6 py-16 md:py-24"
        style={{ background: `linear-gradient(180deg, ${C.bg2} 0%, ${C.bg} 100%)` }}
      >
        <div className="max-w-5xl mx-auto text-center">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[12px] font-semibold mb-6"
            style={{ background: `${C.teal}1A`, color: C.teal }}
          >
            <Truck className="h-3.5 w-3.5" /> Integrated Courier Network
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold leading-tight" style={{ color: C.text }}>
            India's Best Couriers, One Platform
          </h1>
          <p className="mt-5 text-[15px] md:text-[17px] max-w-3xl mx-auto" style={{ color: C.gray }}>
            ViaSetu brings together India's most trusted logistics providers — from national giants to
            nimble regional networks — so you can compare, book and track every shipment in one place.
          </p>
          <div className="flex flex-wrap gap-3 justify-center mt-8">
            <button
              onClick={() => navigate("/booking")}
              className="px-6 h-12 rounded-lg font-bold text-[14px] inline-flex items-center transition-transform hover:scale-[1.02]"
              style={{ background: C.teal, color: C.bg }}
            >
              Ship Now <ArrowRight className="inline h-4 w-4 ml-1" />
            </button>
            <button
              onClick={() => navigate("/contact")}
              className="px-6 h-12 rounded-lg font-semibold text-[14px] border-2 transition-colors hover:bg-[#00C8C8]/10"
              style={{ borderColor: C.teal, color: C.teal }}
            >
              Contact Us
            </button>
          </div>

          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {[
              { label: "Pin Codes Covered", value: "25,000+" },
              { label: "Monthly Bookings", value: "50,000+" },
              { label: "Active Partners", value: "5+" },
              { label: "Cities Served", value: "2,800+" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border p-5 text-center"
                style={{ background: C.bg, borderColor: C.border }}
              >
                <div className="text-2xl md:text-3xl font-extrabold" style={{ color: C.teal }}>
                  {stat.value}
                </div>
                <div className="text-[12px] font-medium mt-1" style={{ color: C.gray }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Partner Cards */}
      <section className="px-6 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold" style={{ color: C.text }}>
              Our Courier Partners
            </h2>
            <p className="mt-3 text-[15px]" style={{ color: C.gray }}>
              Handpicked logistics providers with proven reliability, coverage and service quality.
            </p>
          </div>

          <div className="space-y-8">
            {partners.map((p) => (
              <div
                key={p.name}
                className="rounded-2xl border p-6 md:p-8 transition-shadow hover:shadow-lg"
                style={{ background: C.bg, borderColor: C.border }}
              >
                <div className="flex flex-col md:flex-row gap-6 md:gap-8">
                  {/* Logo + Name */}
                  <div className="shrink-0 flex flex-col items-center md:items-start text-center md:text-left">
                    <div
                      className="h-16 w-40 rounded-xl border flex items-center justify-center p-2 mb-3"
                      style={{ background: C.bg2, borderColor: C.border }}
                    >
                      <img
                        src={p.logo}
                        alt={`${p.name} logo`}
                        className="max-h-full max-w-full object-contain"
                        loading="lazy"
                      />
                    </div>
                    <h3 className="font-bold text-[18px]" style={{ color: C.text }}>
                      {p.name}
                    </h3>
                    <p className="text-[12px] font-medium" style={{ color: C.teal }}>
                      {p.tagline}
                    </p>
                  </div>

                  {/* Description + Highlights */}
                  <div className="flex-1">
                    <p className="text-[14.5px] leading-relaxed" style={{ color: C.gray }}>
                      {p.description}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
                      {p.highlights.map((h) => (
                        <div
                          key={h.text}
                          className="flex items-center gap-2.5 text-[13px]"
                          style={{ color: C.text }}
                        >
                          <div
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg shrink-0"
                            style={{ background: `${C.teal}1A`, color: C.teal }}
                          >
                            <h.icon className="h-3.5 w-3.5" />
                          </div>
                          {h.text}
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-5">
                      {p.services.map((s) => (
                        <span
                          key={s}
                          className="px-3 py-1 rounded-full text-[11px] font-semibold"
                          style={{ background: `${C.teal}1A`, color: C.teal }}
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Multiple Partners */}
      <section className="px-6 py-16" style={{ background: C.bg2 }}>
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: C.text }}>
              Why ViaSetu Works with Multiple Partners
            </h2>
            <p className="text-[15px] leading-relaxed" style={{ color: C.gray }}>
              No single courier covers every pincode, every weight slab and every speed requirement.
              ViaSetu's multi-partner model ensures you always get the best available option for
              your specific route and timeline — automatically.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                "Live rate comparison across all partners",
                "Automatic failover if one partner is unavailable",
                "Route-optimized partner selection for fastest delivery",
                "Unified tracking regardless of which partner delivers",
                "Single booking flow — no need to visit multiple sites",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-[14px]" style={{ color: C.text }}>
                  <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0" style={{ color: C.teal }} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { value: "25,000+", label: "Pin Codes Covered" },
              { value: "5+", label: "Courier Partners" },
              { value: "24/7", label: "Booking Availability" },
              { value: "1-click", label: "Partner Comparison" },
            ].map((s) => (
              <div
                key={s.label}
                className="p-6 rounded-2xl border text-center"
                style={{ background: C.bg, borderColor: C.border }}
              >
                <div className="text-2xl font-extrabold" style={{ color: C.teal }}>
                  {s.value}
                </div>
                <div className="text-[12px] font-medium mt-1" style={{ color: C.gray }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 py-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold mb-2 text-center" style={{ color: C.text }}>
            Partner FAQs
          </h2>
          <p className="text-center text-[14px] mb-8" style={{ color: C.gray }}>
            Common questions about ViaSetu's courier partner network.
          </p>
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((f, i) => (
              <AccordionItem
                key={i}
                value={`item-${i}`}
                className="border rounded-xl px-4"
                style={{ borderColor: C.border, background: C.bg }}
              >
                <AccordionTrigger className="text-left font-semibold" style={{ color: C.text }}>
                  {f.q}
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-[14px] leading-relaxed" style={{ color: C.gray }}>
                    {f.a}
                  </p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "FAQPage",
                mainEntity: faqs.map((f) => ({
                  "@type": "Question",
                  name: f.q,
                  acceptedAnswer: { "@type": "Answer", text: f.a },
                })),
              }),
            }}
          />
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-16">
        <div
          className="max-w-5xl mx-auto rounded-3xl px-8 py-14 text-center"
          style={{ background: `linear-gradient(135deg, ${C.teal} 0%, #00C8C8 100%)`, color: C.bg }}
        >
          <h2 className="text-2xl md:text-3xl font-extrabold">
            Ready to ship with India's best courier network?
          </h2>
          <p className="mt-3 text-[15px] opacity-95 max-w-2xl mx-auto">
            Compare live rates from Delhivery, Shadowfax, Xpressbees and more — book your first
            shipment in under 60 seconds.
          </p>
          <div className="flex flex-wrap gap-3 justify-center mt-7">
            <button
              onClick={() => navigate("/booking")}
              className="px-6 h-12 inline-flex items-center rounded-lg font-bold text-[14px] transition-transform hover:scale-[1.02]"
              style={{ background: C.bg, color: C.teal }}
            >
              <Truck className="h-4 w-4 mr-2" /> Start Shipping
            </button>
            <button
              onClick={() => navigate("/contact")}
              className="px-6 h-12 inline-flex items-center rounded-lg font-semibold text-[14px] border-2 transition-colors hover:bg-white/10"
              style={{ borderColor: C.bg, color: C.bg }}
            >
              <Phone className="h-4 w-4 mr-2" /> Contact Us
            </button>
          </div>
        </div>
      </section>
    </PublicSiteLayout>
  );
}
