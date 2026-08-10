import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import PublicSiteLayout from "@/components/site/PublicSiteLayout";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowRight,
  PackageSearch,
  Truck,
  MapPin,
  ScanLine,
  CheckCircle2,
  Eye,
  Smile,
  ShieldCheck,
  AlertCircle,
  Layers,
  Search,
  Clock,
  Users,
  Building2,
  Store,
  GraduationCap,
  Briefcase,
} from "lucide-react";
import { SERVICES } from "./ServicePage";

const C = {
  bg: "#FFFFFF",
  bg2: "#F4F7FB",
  teal: "#00A8A8",
  text: "#0B1220",
  gray: "#5A6B80",
  border: "#E2E8F0",
};

const STEPS = [
  {
    icon: PackageSearch,
    title: "Step 1: Shipment Booking",
    body:
      "When a parcel is booked with a courier company, a unique Air Waybill (AWB) number or tracking ID is generated.",
  },
  {
    icon: Truck,
    title: "Step 2: Parcel Pickup",
    body:
      "The shipment is collected from the sender and scanned into the courier network.",
  },
  {
    icon: ScanLine,
    title: "Step 3: Transit Movement",
    body:
      "The parcel moves through multiple logistics hubs and sorting centers. Each scan creates a new tracking event.",
  },
  {
    icon: MapPin,
    title: "Step 4: Destination Arrival",
    body:
      "The shipment reaches the destination city and is prepared for final delivery.",
  },
  {
    icon: CheckCircle2,
    title: "Step 5: Delivery Confirmation",
    body:
      "Once the parcel is successfully delivered, the tracking system updates the shipment status and records proof of delivery.",
  },
];

const BENEFITS = [
  {
    icon: Eye,
    title: "Better Shipment Visibility",
    body: "Know exactly where your parcel is throughout the delivery journey.",
  },
  {
    icon: Smile,
    title: "Improved Customer Experience",
    body:
      "Customers appreciate transparent delivery updates and accurate shipment information.",
  },
  {
    icon: ShieldCheck,
    title: "Reduced Delivery Uncertainty",
    body:
      "Tracking updates help eliminate guesswork and improve confidence during transit.",
  },
  {
    icon: AlertCircle,
    title: "Faster Issue Resolution",
    body:
      "Early visibility helps identify delays, exceptions, or delivery challenges before they become major problems.",
  },
  {
    icon: Building2,
    title: "Better Business Operations",
    body:
      "Businesses can proactively communicate shipment updates and improve customer satisfaction.",
  },
];

const STATUSES = [
  ["Shipment Booked", "The shipment has been registered with the courier company and is awaiting pickup."],
  ["Picked Up", "The courier partner has collected the parcel from the sender."],
  ["In Transit", "The shipment is moving between courier hubs and distribution centers."],
  ["Arrived at Facility", "The parcel has reached a sorting or processing center."],
  ["Out for Delivery", "The shipment is with the delivery executive and is expected to be delivered soon."],
  ["Delivery Attempted", "The courier attempted delivery but was unable to complete it."],
  ["Delivered", "The parcel has been successfully delivered to the recipient."],
];

const DELAYS = [
  "Severe weather conditions",
  "Public holidays",
  "Incorrect delivery address",
  "High shipment volumes",
  "Transportation disruptions",
  "Operational constraints",
  "Failed delivery attempts",
];

const WHY_CHOOSE = [
  ["Single Tracking Experience", "Track shipments without switching between multiple courier websites."],
  ["Easy AWB Lookup", "Simply enter your tracking number and get instant shipment information."],
  ["Real-Time Updates", "Access the latest parcel movement and delivery events."],
  ["Business & Personal Use", "Suitable for online sellers, SMEs, enterprises, freelancers, and individuals."],
  ["Faster Access To Shipment Information", "Get delivery visibility from pickup to final destination."],
];

const FAQS = [
  {
    q: "How can I track my parcel online?",
    a: "Enter your AWB number or tracking ID on ViaSetu parcel tracking page to instantly view shipment updates and delivery status.",
  },
  {
    q: "What is the difference between parcel tracking and courier tracking?",
    a: "There is no major difference. Both terms refer to monitoring the movement and delivery status of a shipment.",
  },
  {
    q: "What is an AWB number?",
    a: "An AWB number is a unique shipment reference number assigned by a courier company for tracking purposes.",
  },
  {
    q: "Can I track shipments from multiple courier partners?",
    a: "Yes. ViaSetu helps users access shipment tracking information through a single platform.",
  },
  {
    q: "How accurate is parcel tracking?",
    a: "Tracking accuracy depends on courier scan updates. Most shipment events are updated whenever the parcel reaches a logistics checkpoint.",
  },
  {
    q: "Why is my parcel showing \"In Transit\"?",
    a: "This means the shipment is currently moving between courier facilities and has not yet reached the final delivery location.",
  },
  {
    q: "What should I do if tracking updates stop?",
    a: "Tracking updates may temporarily pause while the parcel is moving between logistics hubs. If updates remain unavailable for an extended period, contact the courier partner or customer support.",
  },
];

const USERS = [
  { icon: Users, label: "Online shoppers" },
  { icon: Store, label: "Small businesses" },
  { icon: Layers, label: "D2C brands" },
  { icon: Building2, label: "eCommerce sellers" },
  { icon: GraduationCap, label: "Students" },
  { icon: Briefcase, label: "Working professionals" },
  { icon: Users, label: "Corporate teams" },
  { icon: Truck, label: "Logistics managers" },
];

export default function ParcelTrackingPage() {
  const navigate = useNavigate();
  const related = SERVICES.filter((s) => s.slug !== "parcel-tracking").slice(0, 4);

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <PublicSiteLayout>
      <Helmet>
        <title>Parcel Tracking in India | Track Courier & Shipment Online | ViaSetu</title>
        <meta
          name="description"
          content="Track any parcel online with ViaSetu. Check courier status, AWB tracking, shipment location, delivery updates, and real-time parcel tracking across leading courier partners in India."
        />
        <link rel="canonical" href="https://www.viasetu.com/services/parcel-tracking" />
        <meta property="og:title" content="Parcel Tracking in India | Track Courier & Shipment Online | ViaSetu" />
        <meta property="og:description" content="Track any parcel online with ViaSetu across leading courier partners in India." />
        <meta property="og:url" content="https://www.viasetu.com/services/parcel-tracking" />
        <script type="application/ld+json">{JSON.stringify(faqLd)}</script>
      </Helmet>

      {/* HERO */}
      <section className="px-4 sm:px-6 py-12 sm:py-16" style={{ background: C.bg2 }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-[11px] sm:text-[12px] font-bold uppercase tracking-wider mb-3" style={{ color: C.teal }}>
            Parcel Tracking
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4 leading-tight" style={{ color: C.text }}>
            Track Any Parcel Online Across Multiple Courier Partners
          </h1>
          <p className="text-base sm:text-lg md:text-xl mb-4" style={{ color: C.gray }}>
            Looking for a simple way to track your parcel online?
          </p>
          <p className="text-[14px] sm:text-[15px] leading-relaxed mb-4" style={{ color: C.gray }}>
            ViaSetu helps individuals, businesses, online sellers, and eCommerce brands monitor
            shipments from multiple courier partners through a single tracking platform. Enter your
            AWB number or tracking ID to instantly check parcel location, delivery progress, transit
            history, and expected delivery updates.
          </p>
          <p className="text-[14px] sm:text-[15px] leading-relaxed mb-6" style={{ color: C.gray }}>
            Whether you're waiting for an important document, a customer order, a business shipment,
            or a personal package, ViaSetu gives you real-time parcel tracking without switching
            between multiple courier websites.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => navigate("/tracking")}
              className="px-5 h-11 rounded-lg font-bold text-[14px] inline-flex items-center justify-center gap-2 w-full sm:w-auto"
              style={{ background: C.teal, color: "#fff" }}
            >
              Track Your Parcel <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => navigate("/login")}
              className="px-5 h-11 rounded-lg font-semibold text-[14px] border-2 w-full sm:w-auto"
              style={{ borderColor: C.teal, color: C.teal }}
            >
              Book a Shipment
            </button>
          </div>
        </div>
      </section>

      {/* What is parcel tracking */}
      <section className="px-4 sm:px-6 py-12 sm:py-14">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4" style={{ color: C.text }}>
            What Is Parcel Tracking?
          </h2>
          <p className="text-[14px] sm:text-[15px] leading-relaxed mb-4" style={{ color: C.gray }}>
            Parcel tracking is the process of monitoring a shipment as it moves from the sender to
            the recipient. Every parcel is assigned a unique tracking number or AWB number when it
            is booked with a courier company.
          </p>
          <p className="text-[14px] sm:text-[15px] leading-relaxed mb-4" style={{ color: C.gray }}>
            As the shipment moves through pickup centers, sorting facilities, transit hubs, and
            delivery stations, tracking updates are recorded and shared digitally. These updates
            help customers know where their parcel is, its current delivery status, and when it is
            expected to arrive.
          </p>
          <p className="text-[14px] sm:text-[15px] leading-relaxed" style={{ color: C.gray }}>
            Today, parcel tracking has become an essential part of modern logistics because it
            provides transparency, reduces uncertainty, and improves the overall shipping experience
            for both senders and recipients.
          </p>
        </div>
      </section>

      {/* How parcel tracking works */}
      <section className="px-4 sm:px-6 py-12 sm:py-14" style={{ background: C.bg2 }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3" style={{ color: C.text }}>
            How Parcel Tracking Works
          </h2>
          <p className="text-[14px] sm:text-[15px] mb-8" style={{ color: C.gray }}>
            Understanding how parcel tracking works can help customers better interpret shipment updates.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {STEPS.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="p-5 rounded-xl border bg-white"
                style={{ borderColor: C.border }}
              >
                <div
                  className="h-10 w-10 rounded-lg inline-flex items-center justify-center mb-3"
                  style={{ background: `${C.teal}15`, color: C.teal }}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-[15px] mb-2" style={{ color: C.text }}>
                  {title}
                </h3>
                <p className="text-[13.5px] leading-relaxed" style={{ color: C.gray }}>
                  {body}
                </p>
              </div>
            ))}
          </div>
          <p className="text-[14px] sm:text-[15px] mt-6" style={{ color: C.gray }}>
            ViaSetu makes it easy to view these updates in one place without visiting multiple
            courier websites.
          </p>
        </div>
      </section>

      {/* AWB number */}
      <section className="px-4 sm:px-6 py-12 sm:py-14">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4" style={{ color: C.text }}>
            What Is an AWB Number?
          </h2>
          <p className="text-[14px] sm:text-[15px] leading-relaxed mb-4" style={{ color: C.gray }}>
            An AWB (Air Waybill) number is a unique shipment identification number assigned by a
            courier or logistics company.
          </p>
          <p className="text-[14px] sm:text-[15px] leading-relaxed mb-3" style={{ color: C.gray }}>
            The AWB number acts as a digital reference for the shipment and allows customers to:
          </p>
          <ul className="space-y-2 mb-4">
            {["Track parcel status", "Monitor delivery progress", "View shipment history", "Check transit updates", "Verify successful delivery"].map((t) => (
              <li key={t} className="flex items-start gap-3 text-[14px]" style={{ color: C.text }}>
                <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" style={{ color: C.teal }} />
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <p className="text-[14px] sm:text-[15px] leading-relaxed" style={{ color: C.gray }}>
            If you want to track a courier online, the AWB number is usually the fastest way to
            retrieve shipment information.
          </p>
        </div>
      </section>

      {/* About ViaSetu parcel tracking */}
      <section className="px-4 sm:px-6 py-12 sm:py-14" style={{ background: C.bg2 }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-[11px] sm:text-[12px] font-bold uppercase tracking-wider mb-2" style={{ color: C.teal }}>
            About ViaSetu Parcel Tracking
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold mb-4" style={{ color: C.text }}>
            Track Multiple Courier Shipments From One Platform
          </h2>
          <p className="text-[14px] sm:text-[15px] leading-relaxed mb-4" style={{ color: C.gray }}>
            Managing shipment tracking across different courier providers can be frustrating. Many
            customers end up searching for individual courier websites just to check a parcel status.
          </p>
          <p className="text-[14px] sm:text-[15px] leading-relaxed mb-4" style={{ color: C.gray }}>
            ViaSetu simplifies the process by bringing parcel tracking into a centralized platform.
          </p>
          <p className="text-[14px] sm:text-[15px] leading-relaxed mb-4" style={{ color: C.gray }}>
            Instead of manually identifying the courier company, users can simply enter a tracking
            number and receive the latest shipment updates from supported courier networks.
          </p>
          <p className="text-[14px] sm:text-[15px] leading-relaxed" style={{ color: C.gray }}>
            Whether the shipment was booked through ViaSetu or directly with a courier partner,
            users can easily monitor parcel movement, transit milestones, delivery attempts, and
            successful delivery confirmations.
          </p>
        </div>
      </section>

      {/* Benefits */}
      <section className="px-4 sm:px-6 py-12 sm:py-14">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3" style={{ color: C.text }}>
            Benefits of Real-Time Shipment Tracking
          </h2>
          <p className="text-[14px] sm:text-[15px] mb-8" style={{ color: C.gray }}>
            Real-time parcel tracking offers advantages for both businesses and individual users.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {BENEFITS.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="p-5 rounded-xl border bg-white"
                style={{ borderColor: C.border }}
              >
                <div
                  className="h-10 w-10 rounded-lg inline-flex items-center justify-center mb-3"
                  style={{ background: `${C.teal}15`, color: C.teal }}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-[15px] mb-2" style={{ color: C.text }}>
                  {title}
                </h3>
                <p className="text-[13.5px] leading-relaxed" style={{ color: C.gray }}>
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Status meanings */}
      <section className="px-4 sm:px-6 py-12 sm:py-14" style={{ background: C.bg2 }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3" style={{ color: C.text }}>
            Common Parcel Tracking Status Meanings
          </h2>
          <p className="text-[14px] sm:text-[15px] mb-6" style={{ color: C.gray }}>
            Many customers see shipment updates but are unsure what they actually mean.
          </p>
          <div className="divide-y rounded-xl border bg-white" style={{ borderColor: C.border }}>
            {STATUSES.map(([title, desc]) => (
              <div key={title} className="p-4 sm:p-5">
                <div className="font-bold text-[15px] mb-1" style={{ color: C.text }}>
                  {title}
                </div>
                <div className="text-[13.5px] leading-relaxed" style={{ color: C.gray }}>
                  {desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Delays */}
      <section className="px-4 sm:px-6 py-12 sm:py-14">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4" style={{ color: C.text }}>
            Why Parcel Deliveries Sometimes Get Delayed
          </h2>
          <p className="text-[14px] sm:text-[15px] leading-relaxed mb-4" style={{ color: C.gray }}>
            While most shipments move smoothly through courier networks, delays can occasionally
            occur.
          </p>
          <p className="text-[14px] sm:text-[15px] mb-3" style={{ color: C.gray }}>Common reasons include:</p>
          <ul className="grid sm:grid-cols-2 gap-2 mb-4">
            {DELAYS.map((d) => (
              <li key={d} className="flex items-start gap-3 text-[14px]" style={{ color: C.text }}>
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: C.teal }} />
                <span>{d}</span>
              </li>
            ))}
          </ul>
          <p className="text-[14px] sm:text-[15px] leading-relaxed" style={{ color: C.gray }}>
            Tracking updates help customers stay informed when such situations arise.
          </p>
        </div>
      </section>

      {/* Multi-courier */}
      <section className="px-4 sm:px-6 py-12 sm:py-14" style={{ background: C.bg2 }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4" style={{ color: C.text }}>
            Multi-Courier Tracking Made Easy
          </h2>
          <p className="text-[14px] sm:text-[15px] leading-relaxed mb-4" style={{ color: C.gray }}>
            India's logistics ecosystem consists of multiple courier providers serving different
            regions and delivery requirements.
          </p>
          <p className="text-[14px] sm:text-[15px] leading-relaxed mb-4" style={{ color: C.gray }}>
            Instead of searching individual tracking portals, ViaSetu helps users access shipment
            updates through a unified experience.
          </p>
          <p className="text-[14px] sm:text-[15px] mb-3" style={{ color: C.gray }}>This makes it easier to:</p>
          <ul className="space-y-2 mb-4">
            {["Track courier status online", "Check parcel movement", "Monitor delivery progress", "Access shipment history", "Stay informed about delivery timelines"].map((t) => (
              <li key={t} className="flex items-start gap-3 text-[14px]" style={{ color: C.text }}>
                <Search className="h-5 w-5 shrink-0 mt-0.5" style={{ color: C.teal }} />
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <p className="text-[14px] sm:text-[15px] leading-relaxed" style={{ color: C.gray }}>
            For businesses handling frequent shipments, centralized parcel tracking improves
            operational efficiency and customer communication.
          </p>
        </div>
      </section>

      {/* Why choose */}
      <section className="px-4 sm:px-6 py-12 sm:py-14">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold mb-6" style={{ color: C.text }}>
            Why Choose ViaSetu For Parcel Tracking?
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {WHY_CHOOSE.map(([title, desc]) => (
              <div
                key={title}
                className="p-5 rounded-xl border bg-white"
                style={{ borderColor: C.border }}
              >
                <div
                  className="h-10 w-10 rounded-lg inline-flex items-center justify-center mb-3"
                  style={{ background: `${C.teal}15`, color: C.teal }}
                >
                  <Clock className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-[15px] mb-2" style={{ color: C.text }}>
                  {title}
                </h3>
                <p className="text-[13.5px] leading-relaxed" style={{ color: C.gray }}>
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 sm:px-6 py-12 sm:py-14" style={{ background: C.bg2 }}>
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold mb-6" style={{ color: C.text }}>
            Frequently Asked Questions
          </h2>
          <Accordion type="single" collapsible className="bg-white rounded-xl border px-4 sm:px-6" style={{ borderColor: C.border }}>
            {FAQS.map((f, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-left text-[14px] sm:text-[15px] font-bold" style={{ color: C.text }}>
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-[13.5px] sm:text-[14px] leading-relaxed" style={{ color: C.gray }}>
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Who uses */}
      <section className="px-4 sm:px-6 py-12 sm:py-14">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3" style={{ color: C.text }}>
            Who Uses Parcel Tracking?
          </h2>
          <p className="text-[14px] sm:text-[15px] mb-6" style={{ color: C.gray }}>
            Parcel tracking is commonly used by:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {USERS.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="p-4 rounded-xl border bg-white flex items-center gap-3"
                style={{ borderColor: C.border }}
              >
                <div
                  className="h-9 w-9 rounded-lg inline-flex items-center justify-center shrink-0"
                  style={{ background: `${C.teal}15`, color: C.teal }}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-[13.5px] sm:text-[14px] font-semibold" style={{ color: C.text }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 sm:px-6 py-12 sm:py-14" style={{ background: C.bg2 }}>
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3" style={{ color: C.text }}>
            Ready to track your parcel?
          </h2>
          <p className="text-[14px] sm:text-[15px] mb-6" style={{ color: C.gray }}>
            Enter your AWB number on ViaSetu for instant shipment updates.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => navigate("/tracking")}
              className="px-5 h-11 rounded-lg font-bold text-[14px] inline-flex items-center justify-center gap-2"
              style={{ background: C.teal, color: "#fff" }}
            >
              Track Your Parcel <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => navigate("/login")}
              className="px-5 h-11 rounded-lg font-semibold text-[14px] border-2"
              style={{ borderColor: C.teal, color: C.teal }}
            >
              Book a Shipment
            </button>
          </div>
        </div>
      </section>

      {/* Related services */}
      <section
        className="px-4 sm:px-6 py-12 sm:py-14"
        style={{ background: C.bg, borderTop: `1px solid ${C.border}` }}
      >
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold mb-6" style={{ color: C.text }}>
            Explore other services
          </h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            {related.map((r) => (
              <Link
                key={r.slug}
                to={`/services/${r.slug}`}
                className="block p-4 rounded-xl border bg-white hover:border-[#00A8A8] transition-colors"
                style={{ borderColor: C.border }}
              >
                <div className="font-bold text-[14px] mb-1" style={{ color: C.text }}>
                  {r.title}
                </div>
                <div className="text-[12px]" style={{ color: C.gray }}>
                  {r.tagline}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </PublicSiteLayout>
  );
}
