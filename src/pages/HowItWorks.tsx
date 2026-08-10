import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import PublicSiteLayout from "@/components/site/PublicSiteLayout";
import {
  Package,
  Search,
  CreditCard,
  MapPin,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Truck,
  Smartphone,
  Clock,
  Star,
} from "lucide-react";

const C = {
  bg: "#FFFFFF",
  bg2: "#F4F7FB",
  teal: "#00A8A8",
  text: "#0B1220",
  gray: "#5A6B80",
  border: "#E2E8F0",
};

const steps = [
  {
    n: "01",
    icon: Package,
    title: "Enter Shipment Details",
    body: "Add your pickup pincode, delivery location, parcel weight and package type. Our address intelligence automatically suggests and verifies city names from pincode.",
    duration: "~30 seconds",
    tips: ["Use exact pincode for accurate pricing", "Weight is auto-converted to kg"],
  },
  {
    n: "02",
    icon: Search,
    title: "Compare All Courier Prices",
    body: "See real-time prices, delivery speed (ETA) and reliability scores from Delhivery, Shadowfax, Xpressbees, Urbanebolt and Shree Maruti — all side by side.",
    duration: "~10 seconds",
    tips: ["Green badge = best price for your route", "Star rating reflects partner reliability"],
  },
  {
    n: "03",
    icon: CreditCard,
    title: "Book & Pay Securely",
    body: "Select your preferred partner and pay via UPI, credit/debit card or net banking through Razorpay. Doorstep pickup is scheduled automatically.",
    duration: "~30 seconds",
    tips: ["All prices include 18% GST", "Payment is auto-captured after confirmation"],
  },
  {
    n: "04",
    icon: MapPin,
    title: "Track Every Shipment Live",
    body: "Get real-time status updates from pickup to delivery in a unified timeline. We normalize tracking events across every partner so you see one consistent journey.",
    duration: "Real-time",
    tips: ["No login needed to track — just your AWB number", "SMS/email updates coming soon"],
  },
];

const faqs = [
  {
    q: "Do I need an account to compare courier prices?",
    a: "Yes — a quick phone-OTP login is required to fetch live rates from our partner APIs. This ensures your quotes are accurate and valid for booking. Tracking, however, is completely open without login.",
  },
  {
    q: "How is my final price calculated?",
    a: "Your price = Base Fare (from courier) + 18% GST + Platform Fee. The platform fee is already included in the displayed Base Fare so you see one clean total. We round to whole numbers for clarity.",
  },
  {
    q: "Which payment methods are accepted?",
    a: "ViaSetu accepts all major UPI apps (GPay, PhonePe, Paytm), credit cards, debit cards and net banking via Razorpay. Cash on Delivery (COD) is not available.",
  },
  {
    q: "How soon will my parcel be picked up?",
    a: "Most doorstep pickups are scheduled within 24 hours of booking. Express partners like Delhivery and Shadowfax offer same-day pickup in metro cities during operational hours.",
  },
  {
    q: "Can I cancel my booking after payment?",
    a: "Yes, you can cancel before pickup from your order details page. Once cancellation is confirmed by the partner, we trigger an automatic refund to your original payment method via Razorpay.",
  },
  {
    q: "Is my parcel insured during transit?",
    a: "Delhivery and Xpressbees offer built-in liability coverage. Optional declared-value insurance is available at checkout for high-value shipments. Coverage details are shown per partner before confirmation.",
  },
  {
    q: "What if my pincode is not serviceable?",
    a: "ViaSetu checks serviceability in real-time across all 5 partners. If one partner doesn't cover your pincode, we automatically show the others that do. No India Post fallback — only verified partner coverage.",
  },
  {
    q: "Can I book bulk shipments or B2B freight?",
    a: "Currently ViaSetu is optimized for individual parcel shipments. Bulk shipping and B2B freight features are coming soon. Contact us if you have a high-volume requirement.",
  },
];

export default function HowItWorks() {
  const navigate = useNavigate();

  return (
    <PublicSiteLayout>
      <Helmet>
        <title>How It Works — ViaSetu</title>
        <meta
          name="description"
          content="Learn how ViaSetu works in 4 simple steps: enter details, compare couriers, book & pay securely, and track live — all in one app."
        />
        <link rel="canonical" href="https://www.viasetu.com/how-it-works" />
        <meta property="og:title" content="How It Works — ViaSetu" />
        <meta
          property="og:description"
          content="Send a parcel in 4 simple steps: compare couriers, book doorstep pickup, and track live — all in one app."
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
            <Smartphone className="h-3.5 w-3.5" /> India's Easiest Courier App
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold leading-tight" style={{ color: C.text }}>
            Send a Parcel in 4 Easy Steps
          </h1>
          <p className="mt-5 text-[15px] md:text-[17px] max-w-3xl mx-auto" style={{ color: C.gray }}>
            No more visiting courier shops or calling for rates. Compare, book, pay and track —
            everything happens inside ViaSetu in under 2 minutes.
          </p>
          <div className="flex flex-wrap gap-3 justify-center mt-8">
            <button
              onClick={() => navigate("/login")}
              className="px-6 h-12 rounded-lg font-bold text-[14px] inline-flex items-center transition-transform hover:scale-[1.02]"
              style={{ background: C.teal, color: C.bg }}
            >
              Send a Parcel →
            </button>
            <button
              onClick={() => navigate("/tracking")}
              className="px-6 h-12 rounded-lg font-semibold text-[14px] border-2 transition-colors hover:bg-[#00C8C8]/10"
              style={{ borderColor: C.teal, color: C.teal }}
            >
              Track a Parcel
            </button>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="px-6 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold" style={{ color: C.text }}>
              Your Shipping Journey
            </h2>
            <p className="mt-3 text-[15px]" style={{ color: C.gray }}>
              From entering your address to doorstep delivery — here's what happens.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {steps.map((s) => (
              <div
                key={s.n}
                className="rounded-2xl border p-6 md:p-8 transition-shadow hover:shadow-lg"
                style={{ background: C.bg, borderColor: C.border, borderTop: `3px solid ${C.teal}` }}
              >
                <div className="flex items-start gap-5">
                  <div
                    className="h-14 w-14 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ background: `${C.teal}1A`, color: C.teal }}
                  >
                    <s.icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-[11px] font-bold px-2 py-0.5 rounded"
                        style={{ background: `${C.teal}1A`, color: C.teal }}
                      >
                        STEP {s.n}
                      </span>
                      <span className="text-[11px] font-medium flex items-center gap-1" style={{ color: C.gray }}>
                        <Clock className="h-3 w-3" /> {s.duration}
                      </span>
                    </div>
                    <h3 className="font-bold text-[18px] mb-2" style={{ color: C.text }}>
                      {s.title}
                    </h3>
                    <p className="text-[14px] leading-relaxed" style={{ color: C.gray }}>
                      {s.body}
                    </p>
                    <ul className="mt-4 space-y-1.5">
                      {s.tips.map((tip) => (
                        <li key={tip} className="flex items-start gap-2 text-[12px]" style={{ color: C.text }}>
                          <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: C.teal }} />
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What Makes It Simple */}
      <section className="px-6 py-16" style={{ background: C.bg2 }}>
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: C.text }}>
              Why It's Better Than a Courier Shop
            </h2>
            <p className="text-[15px] leading-relaxed mb-6" style={{ color: C.gray }}>
              ViaSetu replaces the entire courier booking workflow — rate negotiation, form filling,
              payment and tracking — with a single, streamlined experience.
            </p>
            <ul className="space-y-3">
              {[
                ["One app, 5+ couriers", "No need to visit multiple websites or shops"],
                ["Live price comparison", "See the cheapest option instantly, not after calling"],
                ["Doorstep pickup", "Schedule from home, hostel or office automatically"],
                ["Unified tracking", "One dashboard for every shipment, every partner"],
                ["GST-included pricing", "No surprise charges at checkout"],
              ].map(([t, b]) => (
                <li key={t} className="flex items-start gap-3 text-[14px]" style={{ color: C.text }}>
                  <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0" style={{ color: C.teal }} />
                  <div>
                    <span className="font-semibold">{t}</span>
                    <span className="block" style={{ color: C.gray }}>{b}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { value: "4", label: "Simple Steps" },
              { value: "<2 min", label: "To Book" },
              { value: "5+", label: "Courier Partners" },
              { value: "25,000+", label: "Pin Codes" },
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

      {/* Safety & Trust */}
      <section className="px-6 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold" style={{ color: C.text }}>
              Safe, Secure & Transparent
            </h2>
            <p className="mt-3 text-[15px]" style={{ color: C.gray }}>
              Every booking is protected by Razorpay-grade encryption and partner-level reliability.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5">
            {[
              {
                icon: ShieldCheck,
                title: "Razorpay Secure Payments",
                body: "All transactions are processed via PCI-DSS compliant Razorpay with instant payment confirmation.",
              },
              {
                icon: Truck,
                title: "Verified Courier Partners",
                body: "Only direct, API-integrated partners. No middlemen. Every partner is vetted for reliability.",
              },
              {
                icon: Star,
                title: "Auto-Refund on Cancellation",
                body: "If your order is cancelled or fails, we automatically trigger a Razorpay refund — no manual follow-up.",
              },
              {
                icon: MapPin,
                title: "Real-Time Serviceability",
                body: "Pincode coverage is checked live against each partner's API before you ever see a price.",
              },
              {
                icon: Clock,
                title: "Predictive ETAs",
                body: "Our AI factors weather, holidays and route load to give you a realistic delivery estimate.",
              },
              {
                icon: CheckCircle2,
                title: "GST-Compliant Invoices",
                body: "Every booking generates a full GST invoice with place-of-supply details for your records.",
              },
            ].map((c) => (
              <div
                key={c.title}
                className="rounded-2xl border p-6 text-left"
                style={{ background: C.bg, borderColor: C.border }}
              >
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: `${C.teal}1A`, color: C.teal }}
                >
                  <c.icon className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-[15px] mb-1" style={{ color: C.text }}>
                  {c.title}
                </h3>
                <p className="text-[13px] leading-relaxed" style={{ color: C.gray }}>
                  {c.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 py-16" style={{ background: C.bg2 }}>
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold mb-2 text-center" style={{ color: C.text }}>
            Frequently Asked Questions
          </h2>
          <p className="text-center text-[14px] mb-8" style={{ color: C.gray }}>
            Common questions about booking, pricing, pickup and delivery on ViaSetu.
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
            Ready to book your first shipment?
          </h2>
          <p className="mt-3 text-[15px] opacity-95 max-w-2xl mx-auto">
            Join 10,000+ Indians who ship smarter with ViaSetu. Compare prices, book pickup and track live — all in under 2 minutes.
          </p>
          <div className="flex flex-wrap gap-3 justify-center mt-7">
            <button
              onClick={() => navigate("/login")}
              className="px-6 h-12 inline-flex items-center rounded-lg font-bold text-[14px] transition-transform hover:scale-[1.02]"
              style={{ background: C.bg, color: C.teal }}
            >
              Send a Parcel <ArrowRight className="inline h-4 w-4 ml-1" />
            </button>
            <button
              onClick={() => navigate("/contact")}
              className="px-6 h-12 rounded-lg font-semibold text-[14px] border-2 transition-colors hover:bg-white/10"
              style={{ borderColor: C.bg, color: C.bg }}
            >
              Contact Us
            </button>
          </div>
        </div>
      </section>
    </PublicSiteLayout>
  );
}
