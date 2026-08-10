import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import PublicSiteLayout from "@/components/site/PublicSiteLayout";
import {
  Truck,
  ShieldCheck,
  Sparkles,
  Cpu,
  HeartHandshake,
  Users,
  Target,
  Eye,
  Compass,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import aboutHero from "@/assets/about-hero.jpg";
import aboutTeam from "@/assets/about-team.jpg";
import aboutTech from "@/assets/about-tech.jpg";

const C = {
  bg: "#FFFFFF",
  bg2: "#F4F7FB",
  teal: "#00A8A8",
  text: "#0B1220",
  gray: "#5A6B80",
  border: "#E2E8F0",
};

const values = [
  { icon: ShieldCheck, title: "Trust & Transparency", text: "Upfront pricing, real ETAs and zero hidden fees on every booking." },
  { icon: HeartHandshake, title: "Customer Obsession", text: "We sweat the small details so every parcel reaches with a smile." },
  { icon: Sparkles, title: "Simplicity", text: "One app, every courier. We remove friction from end-to-end shipping." },
  { icon: Users, title: "Partnership", text: "We grow alongside our courier partners — fair, reliable, long-term." },
];

const whyChoose = [
  { title: "Compare 5+ Trusted Couriers", text: "Delhivery, Xpressbees, Shadowfax, Shree Maruti, UrbaneBolt — all in one place." },
  { title: "Best Price, Always", text: "Live rate cards plus volumetric pricing surface the most economical option instantly." },
  { title: "Doorstep Pickup", text: "Schedule pickup from your home or office in a few taps — no queues, no paperwork." },
  { title: "Unified Tracking", text: "Track every shipment across every partner from a single dashboard with live status updates." },
  { title: "Secure Payments", text: "Razorpay-powered checkout with automatic refunds on failed or cancelled bookings." },
  { title: "Human Support", text: "Real people on chat and email to resolve issues fast — not chatbots running in loops." },
];

const techPoints = [
  "AI-powered courier recommendations matched to weight, distance and SLA",
  "Real-time serviceability checks across every partner's pincode network",
  "Predictive ETAs that adjust for weather, holidays and weight",
  "Smart address intelligence with Google Places + India Post verification",
  "Auto-reconciliation, instant invoicing and label generation in one flow",
];

const faqs = [
  { q: "What is ViaSetu?", a: "ViaSetu is India's first consumer-first courier aggregator. We let individuals and small businesses compare prices across top courier partners, book doorstep pickup and track every shipment from one place." },
  { q: "Which courier partners are available on ViaSetu?", a: "We currently work with Delhivery, Xpressbees, Shadowfax, Shree Maruti Courier and UrbaneBolt — with more partners being onboarded continuously." },
  { q: "How does ViaSetu decide the best courier for my parcel?", a: "Our smart ranking engine evaluates live rates, transit time, partner ratings and serviceability for your pincode pair, then surfaces the most relevant options with clear Budget, Fastest and Top Rated tags." },
  { q: "Are there any hidden charges?", a: "Never. The price you see at checkout is the price you pay — it already includes all taxes, fuel, and platform charges. We do not offer Cash on Delivery." },
  { q: "How do I track my shipment?", a: "Every booking gets a unified tracking page on ViaSetu. You can also use the Track Your Parcel option on the home page with your AWB or order ID." },
  { q: "What happens if my booking fails or is cancelled?", a: "Refunds are processed automatically via Razorpay. You can monitor the refund status from your order details page." },
  { q: "Is ViaSetu meant for businesses or individuals?", a: "Both. Today we focus on individuals and small senders. Bulk shipping for businesses is on the way." },
  { q: "How do I contact ViaSetu support?", a: "Email us at support@viasetu.com or use the in-app Support section — our team responds within working hours." },
];

export default function About() {
  const navigate = useNavigate();

  return (
    <PublicSiteLayout>
      <Helmet>
        <title>About ViaSetu — India's Consumer-First Courier Aggregator</title>
        <meta
          name="description"
          content="Learn about ViaSetu — our mission, vision, values and technology-driven approach to simplifying courier booking across India."
        />
        <link rel="canonical" href="https://www.viasetu.com/about" />
        <meta property="og:title" content="About ViaSetu" />
        <meta property="og:description" content="Compare couriers, book pickup, track shipments — India's first consumer-first courier aggregator." />
      </Helmet>

      {/* Hero */}
      <section className="px-6 py-16 md:py-24" style={{ background: `linear-gradient(180deg, ${C.bg2} 0%, ${C.bg} 100%)` }}>
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[12px] font-semibold mb-6"
               style={{ background: `${C.teal}1A`, color: C.teal }}>
            <Truck className="h-3.5 w-3.5" /> About ViaSetu
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold leading-tight" style={{ color: C.text }}>
            Simplifying parcel delivery for every Indian.
          </h1>
          <p className="mt-5 text-[15px] md:text-[17px] max-w-3xl mx-auto" style={{ color: C.gray }}>
            ViaSetu is India's first consumer-first courier aggregator. We bring together the country's most trusted courier partners on a single
            platform — so you can compare prices, schedule doorstep pickup and track every shipment without juggling apps, calls or paperwork.
          </p>
          <div className="flex flex-wrap gap-3 justify-center mt-8">
            <button onClick={() => navigate("/login")}
              className="px-6 h-12 rounded-lg font-bold text-[14px] transition-transform hover:scale-[1.02]"
              style={{ background: C.teal, color: C.bg }}>
              Send a Parcel <ArrowRight className="inline h-4 w-4 ml-1" />
            </button>
            <button onClick={() => navigate("/tracking")}
              className="px-6 h-12 rounded-lg font-semibold text-[14px] border-2 transition-colors hover:bg-[#00C8C8]/10"
              style={{ borderColor: C.teal, color: C.teal }}>
              Track Your Parcel
            </button>
          </div>
          <div className="mt-12 max-w-5xl mx-auto rounded-3xl overflow-hidden border shadow-xl" style={{ borderColor: C.border }}>
            <img
              src={aboutHero}
              alt="ViaSetu delivery partner handing a parcel to a happy customer at the doorstep"
              width={1600}
              height={1024}
              className="w-full h-auto block"
            />
          </div>
        </div>
      </section>

      {/* Company Overview */}
      <section className="px-6 py-16">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-10 items-start">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: C.text }}>Company Overview</h2>
            <p className="text-[15px] leading-relaxed" style={{ color: C.gray }}>
              Shipping a parcel in India has historically meant standing in queues, comparing rates by phone, and hoping for the best. ViaSetu was
              built to change that. By aggregating India's leading courier partners under one roof and pairing them with a clean, mobile-first
              experience, we make sending a parcel as easy as ordering food online.
            </p>
            <p className="mt-4 text-[15px] leading-relaxed" style={{ color: C.gray }}>
              From a single student sending books home to a small D2C brand fulfilling daily orders, ViaSetu is built for everyone who ships in
              India — with transparent pricing, dependable pickup and a single tracking dashboard for every order.
            </p>
          </div>
          <div className="space-y-5">
            <div className="rounded-2xl overflow-hidden border shadow-md" style={{ borderColor: C.border }}>
              <img
                src={aboutTeam}
                alt="ViaSetu team collaborating on logistics technology"
                width={1280}
                height={896}
                loading="lazy"
                className="w-full h-auto block"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              {[
                { icon: Target, title: "Our Mission", text: "Make courier booking transparent, affordable and effortless for every Indian." },
                { icon: Eye, title: "Our Vision", text: "Become the default delivery layer for India's next billion shippers." },
                { icon: Compass, title: "Our Promise", text: "Best price. Fastest pickup. One tracking view. Real human support." },
                { icon: HeartHandshake, title: "Our Culture", text: "Customer-first, partner-friendly, builder-led and proudly Indian." },
              ].map((b) => (
                <div key={b.title} className="p-5 rounded-2xl border" style={{ background: C.bg, borderColor: C.border }}>
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl mb-3"
                    style={{ background: `${C.teal}1A`, color: C.teal }}>
                    <b.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-[15px]" style={{ color: C.text }}>{b.title}</h3>
                  <p className="text-[13.5px] mt-1.5" style={{ color: C.gray }}>{b.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose ViaSetu */}
      <section className="px-6 py-16" style={{ background: C.bg2 }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold" style={{ color: C.text }}>Why Choose ViaSetu</h2>
            <p className="mt-3 text-[15px]" style={{ color: C.gray }}>Built for individuals and small senders who deserve a better courier experience.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {whyChoose.map((w) => (
              <div key={w.title} className="p-6 rounded-2xl border transition-shadow hover:shadow-lg"
                style={{ background: C.bg, borderColor: C.border }}>
                <CheckCircle2 className="h-6 w-6 mb-3" style={{ color: C.teal }} />
                <h3 className="font-bold text-[16px]" style={{ color: C.text }}>{w.title}</h3>
                <p className="text-[13.5px] mt-2 leading-relaxed" style={{ color: C.gray }}>{w.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Technology Approach */}
      <section className="px-6 py-16">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold mb-4"
                 style={{ background: `${C.teal}1A`, color: C.teal }}>
              <Cpu className="h-3.5 w-3.5" /> Technology-Driven
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: C.text }}>Our Technology-Driven Approach</h2>
            <p className="text-[15px] leading-relaxed mb-5" style={{ color: C.gray }}>
              Under the hood, ViaSetu is an intelligence layer that talks to multiple courier APIs in real time — comparing rates, validating
              addresses, predicting ETAs and orchestrating pickup, payment, invoicing and tracking in a single, automated flow.
            </p>
            <ul className="space-y-3">
              {techPoints.map((t) => (
                <li key={t} className="flex items-start gap-3 text-[14px]" style={{ color: C.text }}>
                  <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0" style={{ color: C.teal }} />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-5">
            <div className="rounded-2xl overflow-hidden border shadow-md" style={{ borderColor: C.border, background: C.bg2 }}>
              <img
                src={aboutTech}
                alt="Illustration of ViaSetu's logistics network connecting Indian cities"
                width={1280}
                height={896}
                loading="lazy"
                className="w-full h-auto block"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              {values.map((v) => (
                <div key={v.title} className="p-5 rounded-2xl border" style={{ background: C.bg2, borderColor: C.border }}>
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl mb-3"
                    style={{ background: `${C.teal}1A`, color: C.teal }}>
                    <v.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-[14px]" style={{ color: C.text }}>{v.title}</h3>
                  <p className="text-[12.5px] mt-1.5" style={{ color: C.gray }}>{v.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Commitment */}
      <section className="px-6 py-16" style={{ background: C.bg2 }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold" style={{ color: C.text }}>Our Commitment</h2>
            <p className="mt-3 text-[15px]" style={{ color: C.gray }}>
              We win only when both sides of the network — customers and partners — thrive.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-7 rounded-2xl border" style={{ background: C.bg, borderColor: C.border }}>
              <h3 className="text-lg font-bold mb-3" style={{ color: C.text }}>To Our Customers</h3>
              <ul className="space-y-2.5 text-[14px]" style={{ color: C.gray }}>
                <li>• Honest, all-inclusive pricing on every booking.</li>
                <li>• Doorstep pickup with reliable, time-bound delivery.</li>
                <li>• A single, real-time tracking view across every partner.</li>
                <li>• Fast refunds and responsive human support when something goes wrong.</li>
              </ul>
            </div>
            <div className="p-7 rounded-2xl border" style={{ background: C.bg, borderColor: C.border }}>
              <h3 className="text-lg font-bold mb-3" style={{ color: C.text }}>To Our Delivery Partners</h3>
              <ul className="space-y-2.5 text-[14px]" style={{ color: C.gray }}>
                <li>• Quality bookings with verified addresses and pre-paid payments.</li>
                <li>• Transparent reconciliation and on-time settlements.</li>
                <li>• Technology that reduces failed pickups and undelivered shipments.</li>
                <li>• A long-term partnership built on trust and shared growth.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 py-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold mb-2 text-center" style={{ color: C.text }}>Frequently Asked Questions</h2>
          <p className="text-center text-[14px] mb-8" style={{ color: C.gray }}>
            Everything you wanted to know about ViaSetu and how we work.
          </p>
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="border rounded-xl px-4" style={{ borderColor: C.border, background: C.bg }}>
                <AccordionTrigger className="text-left font-semibold" style={{ color: C.text }}>
                  {f.q}
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-[14px] leading-relaxed" style={{ color: C.gray }}>{f.a}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
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
      </section>

      {/* CTA */}
      <section className="px-6 py-16">
        <div className="max-w-5xl mx-auto rounded-3xl px-8 py-14 text-center"
             style={{ background: `linear-gradient(135deg, ${C.teal} 0%, #00C8C8 100%)`, color: C.bg }}>
          <h2 className="text-2xl md:text-3xl font-extrabold">Ready to ship smarter?</h2>
          <p className="mt-3 text-[15px] opacity-95 max-w-2xl mx-auto">
            Join thousands of Indians who trust ViaSetu for fast, transparent and affordable courier bookings — every single day.
          </p>
          <div className="flex flex-wrap gap-3 justify-center mt-7">
            <button onClick={() => navigate("/login")}
              className="px-6 h-12 rounded-lg font-bold text-[14px] transition-transform hover:scale-[1.02]"
              style={{ background: C.bg, color: C.teal }}>
              Send a Parcel <ArrowRight className="inline h-4 w-4 ml-1" />
            </button>
            <a href="mailto:support@viasetu.com"
              className="px-6 h-12 inline-flex items-center rounded-lg font-semibold text-[14px] border-2 transition-colors hover:bg-white/10"
              style={{ borderColor: C.bg, color: C.bg }}>
              Get in Touch
            </a>
          </div>
        </div>
      </section>
    </PublicSiteLayout>
  );
}
