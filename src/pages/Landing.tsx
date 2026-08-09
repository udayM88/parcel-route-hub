import { useNavigate, Link, useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PageSeo from "@/components/PageSeo";
import Logo from "@/components/Logo";
import PublicSiteLayout from "@/components/site/PublicSiteLayout";
const AuthedHome = lazy(() => import("./Index"));
import { supabase } from "@/integrations/supabase/client";
import {
  Package, Search, CheckCircle2, ChevronDown, Menu, X,
  Linkedin, Twitter, Instagram, BookOpen, HelpCircle, Mail,
} from "lucide-react";


// Brand tokens (kept inline for the landing page only — does not affect app theme)
const C = {
  bg: "#FFFFFF",
  bg2: "#F4F7FB",
  card: "#FFFFFF",
  teal: "#00A8A8",
  white: "#0B1220",      // primary text (dark on light)
  gray: "#5A6B80",       // secondary text
  border: "#E2E8F0",
  err: "#C0392B",
  ok: "#1A7A4A",
};

const FONT_STACK = '"Montserrat", "Helvetica Neue", Arial, sans-serif';

// Partner logos
import delhiveryLogo from "@/assets/delhivery.svg";
import shadowfaxLogo from "@/assets/shadowfax.svg";
import xpressbeesLogo from "@/assets/xpressbees.svg";
import urbaneboltLogo from "@/assets/urbanebolt.svg";
import shreeMarutiLogo from "@/assets/shree-maruti.svg";

// Background imagery (logistics & courier)
import logisticsBg from "@/assets/logistics-bg.jpg";
import howItWorksDesktop from "@/assets/how-it-works-desktop.png.asset.json";
import howItWorksMobile from "@/assets/how-it-works-mobile.png.asset.json";

import personaBaker from "@/assets/persona-baker.png.asset.json";
import personaStudent from "@/assets/persona-student.png.asset.json";
import personaSeller from "@/assets/persona-seller.png.asset.json";
import warehouseBg from "@/assets/warehouse-bg.jpg";
import parcelsBg from "@/assets/parcels-bg.jpg";
import shippingBg from "@/assets/shipping-bg.jpg";
import deliveryHero from "@/assets/delivery-hero.jpg";
import heroDesktopVideo from "@/assets/hero-desktop.mp4.asset.json";
import appPreview from "@/assets/app-preview.png";
import appPreview2 from "@/assets/app-preview-2.png";



const resourceItems = [
  { href: "/blog", label: "Blog", icon: BookOpen },
  { href: "/faq", label: "FAQ", icon: HelpCircle },
  { href: "/contact", label: "Contact Us", icon: Mail },
];

const serviceItems = [
  { href: "/services/parcel-tracking", label: "Parcel Tracking" },
  { href: "/services/bulk-shipment", label: "Bulk Shipment" },
  { href: "/services/express-delivery", label: "Express Delivery" },
  { href: "/services/domestic-courier-service", label: "Domestic Courier Service" },
  { href: "/services/individual-business", label: "Individual Business" },
  { href: "/services/personal-business", label: "Personal Business" },
  { href: "/services/sme-courier-service", label: "SME Courier Service" },
  { href: "/services/doorstep-pickup", label: "Doorstep Pickup" },
];

function ServicesDropdown() {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const location = useLocation();
  useEffect(() => { setOpen(false); }, [location]);
  const handleEnter = () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); setOpen(true); };
  const handleLeave = () => { timeoutRef.current = setTimeout(() => setOpen(false), 150); };
  return (
    <div className="relative" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <button
        className="flex items-center gap-1 text-[14px] transition-colors hover:text-[#00C8C8] focus:outline-none"
        style={{ color: C.gray }}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        Our Services
        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 rounded-xl border shadow-lg p-2 animate-in fade-in zoom-in-95 duration-200"
          style={{ background: C.card, borderColor: C.border }}
        >
          {serviceItems.map((item) => (
            <Link
              key={item.label}
              to={item.href}
              className="block rounded-lg px-3 py-2 text-[13px] transition-colors hover:bg-[#00A8A8]/10 hover:text-[#00A8A8]"
              style={{ color: C.white }}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function ResourcesDropdown() {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const location = useLocation();
  useEffect(() => { setOpen(false); }, [location]);
  const handleEnter = () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); setOpen(true); };
  const handleLeave = () => { timeoutRef.current = setTimeout(() => setOpen(false), 150); };
  return (
    <div className="relative" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <button
        className="flex items-center gap-1 text-[14px] transition-colors hover:text-[#00C8C8] focus:outline-none"
        style={{ color: C.gray }}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        Resources
        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-52 rounded-xl border shadow-lg p-2 animate-in fade-in zoom-in-95 duration-200"
          style={{ background: C.card, borderColor: C.border }}
        >
          {resourceItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                to={item.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] transition-colors hover:bg-[#00A8A8]/10 hover:text-[#00A8A8]"
                style={{ color: C.white }}
              >
                <Icon className="h-4 w-4 shrink-0" style={{ color: C.teal }} />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------- NAV ---------------- */
const NavBar = ({ onSendClick, onTrackClick }: { onSendClick: () => void; onTrackClick: () => void }) => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [resourcesOpenMobile, setResourcesOpenMobile] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const [servicesOpenMobile, setServicesOpenMobile] = useState(false);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);
  const plainLinks = [
    { href: "/", label: "Home" },
    { href: "/tracking", label: "Track Parcel" },
    { href: "/about", label: "About Us" },
    { href: "/courier-partners", label: "Courier Partners" },
  ];
  return (
    <>
    <header
      className={`fixed top-0 left-0 right-0 z-[60] transition-all ${scrolled ? "backdrop-blur-sm" : ""}`}
      style={{ background: scrolled ? "rgba(255,255,255,0.92)" : C.bg, borderBottom: `1px solid ${C.border}`, height: 64 }}
    >
      <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
        <a href="/" className="flex items-center" aria-label="ViaSetu home">
          <Logo size="md" />
        </a>

        <nav className="hidden lg:flex items-center gap-6">
          <Link to="/" className="text-[14px] transition-colors hover:text-[#00C8C8]" style={{ color: C.gray }}>Home</Link>
          <ServicesDropdown />
          <Link to="/tracking" className="text-[14px] transition-colors hover:text-[#00C8C8]" style={{ color: C.gray }}>Track Parcel</Link>
          <Link to="/about" className="text-[14px] transition-colors hover:text-[#00C8C8]" style={{ color: C.gray }}>About Us</Link>
          <Link to="/courier-partners" className="text-[14px] transition-colors hover:text-[#00C8C8]" style={{ color: C.gray }}>Courier Partners</Link>
          <ResourcesDropdown />
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={onTrackClick}
            className="px-4 h-10 rounded-lg font-semibold text-[14px] border-2 transition-colors hover:bg-[#00C8C8]/10"
            style={{ borderColor: C.teal, color: C.teal }}
          >
            Track Your Parcel
          </button>
          <button
            onClick={onSendClick}
            className="px-5 h-10 rounded-lg font-bold text-[14px] transition-transform hover:scale-[1.02]"
            style={{ background: C.teal, color: C.bg }}
          >
            Send a Parcel →
          </button>
        </div>

        <button className="md:hidden text-[#0B1220]" onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu className="h-6 w-6" />
        </button>
      </div>
    </header>

    {open && createPortal(
        <div className="fixed inset-0 z-[100] md:hidden overflow-y-auto overscroll-contain" style={{ background: C.bg }}>
          <div className="sticky top-0 flex justify-between items-center px-6 h-16" style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
            <Logo size="md" />
            <button onClick={() => setOpen(false)} className="text-[#0B1220]" aria-label="Close menu"><X className="h-6 w-6" /></button>
          </div>
          <nav className="flex flex-col p-6 gap-5">
            <Link to="/" onClick={() => setOpen(false)} className="text-[#0B1220] text-lg">Home</Link>
            <div>
              <button
                onClick={() => setServicesOpenMobile((v) => !v)}
                className="flex items-center gap-2 text-lg w-full text-left text-[#0B1220]"
              >
                Our Services
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${servicesOpenMobile ? "rotate-180" : ""}`} />
              </button>
              {servicesOpenMobile && (
                <div className="mt-3 ml-3 flex flex-col gap-3 border-l-2 pl-4" style={{ borderColor: C.border }}>
                  {serviceItems.map((item) => (
                    <Link key={item.label} to={item.href} onClick={() => setOpen(false)} className="text-[14px] transition-colors hover:text-[#00C8C8]" style={{ color: C.gray }}>
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <Link to="/tracking" onClick={() => setOpen(false)} className="text-[#0B1220] text-lg">Track Parcel</Link>
            <Link to="/about" onClick={() => setOpen(false)} className="text-[#0B1220] text-lg">About Us</Link>
            <Link to="/courier-partners" onClick={() => setOpen(false)} className="text-[#0B1220] text-lg">Courier Partners</Link>
            <div>
              <button
                onClick={() => setResourcesOpenMobile((v) => !v)}
                className="flex items-center gap-2 text-lg w-full text-left text-[#0B1220]"
              >
                Resources
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${resourcesOpenMobile ? "rotate-180" : ""}`} />
              </button>
              {resourcesOpenMobile && (
                <div className="mt-3 ml-3 flex flex-col gap-3 border-l-2 pl-4" style={{ borderColor: C.border }}>
                  {resourceItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.label}
                        to={item.href}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2 text-[15px] transition-colors hover:text-[#00C8C8]"
                        style={{ color: C.gray }}
                      >
                        <Icon className="h-4 w-4" style={{ color: C.teal }} />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
            <button onClick={() => { setOpen(false); onTrackClick(); }} className="mt-4 h-12 rounded-lg border-2 font-semibold" style={{ borderColor: C.teal, color: C.teal }}>Track Your Parcel</button>
            <button onClick={() => { setOpen(false); onSendClick(); }} className="h-12 rounded-lg font-bold" style={{ background: C.teal, color: C.bg }}>Send a Parcel →</button>
          </nav>
        </div>,
      document.body
    )}
    </>
  );
};


/* ---------------- TRACK FORM ---------------- */
const TrackForm = ({ onTrack }: { onTrack: (awb: string) => void }) => {
  const [awb, setAwb] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (awb.trim()) onTrack(awb.trim());
  };
  return (
    <form onSubmit={submit} className="rounded-2xl p-5 md:p-6" style={{ background: C.bg2, border: `1px solid ${C.border}` }}>
      <label className="text-[12px] uppercase tracking-wider font-semibold" style={{ color: C.teal }}>
        Track your parcel — no login needed
      </label>
      <div className="mt-3 flex flex-col sm:flex-row gap-3">
        <input
          value={awb}
          onChange={(e) => setAwb(e.target.value)}
          placeholder="Enter AWB / Tracking Number"
          className="flex-1 h-12 rounded-lg px-4 text-[14px] outline-none focus:border-[#00C8C8]"
          style={{ background: C.card, border: `1px solid ${C.border}`, color: C.white }}
        />
        <button type="submit" className="h-12 px-6 rounded-lg font-bold text-[14px] flex items-center justify-center gap-2 whitespace-nowrap" style={{ background: C.teal, color: C.bg }}>
          <Search className="h-4 w-4" /> Track
        </button>
      </div>
    </form>
  );
};

/* ---------------- PHONE MOCKUP ---------------- */
const PhoneMockup = ({ children, src = appPreview }: { children?: React.ReactNode; src?: string }) => (
  <div className="mx-auto" style={{ width: 280 }}>
    <div className="rounded-[40px] p-3" style={{ background: "#000", border: `2px solid ${C.border}`, boxShadow: "0 30px 60px rgba(0,200,200,0.2)" }}>
      <div className="rounded-[32px] overflow-hidden" style={{ background: C.bg2, height: 560 }}>
        <img
          src={src}
          alt="Viasetu app showing courier comparison with ratings, ETA, reliability and prices"
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
    </div>
  </div>
);

/* ---------------- COUNTER ---------------- */
const Counter = ({ end, suffix = "" }: { end: number; suffix?: string }) => {
  const [v, setV] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        const dur = 1500, start = performance.now();
        const tick = (t: number) => {
          const p = Math.min(1, (t - start) / dur);
          setV(Math.floor(end * (1 - Math.pow(1 - p, 3))));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        obs.disconnect();
      }
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [end]);
  return <span ref={ref}>{v.toLocaleString("en-IN")}{suffix}</span>;
};

/* ---------------- FAQ ---------------- */
const FAQ_ITEMS: [string, string][] = [
  ["How do I compare courier prices on Viasetu?", "Sign in and enter your pickup pincode, delivery pincode and parcel weight. Viasetu instantly compares prices from our integrated courier partners — Delhivery, Shadowfax, XpressBees, UrbaneBolt and Shree Maruti — and shows you the cheapest and fastest options side by side."],
  ["Which is the cheapest courier service in India?", "Courier prices vary by route, weight and speed. Viasetu compares all integrated partners in real-time so you always get the best available price for your route."],
  ["Does Viasetu offer doorstep pickup?", "Yes. Viasetu schedules doorstep pickup from your home, office, hostel or any address across thousands of pincodes in India. No need to visit a courier shop."],
  ["How do I track my parcel on Viasetu?", "Just enter your AWB or tracking number on the home page — no login required. We provide unified real-time tracking across all our courier partners in one view."],
  ["How much can I save using Viasetu?", "Viasetu users save an average of 20–40% compared to walk-in rates at local courier shops."],
  ["Which couriers are available on Viasetu?", "Today: Delhivery, Shadowfax, XpressBees, UrbaneBolt and Shree Maruti. More partners (Blue Dart, DTDC, India Post, DHL, FedEx) are coming soon."],
  ["Is Viasetu free to use?", "Yes. Viasetu is free to use. You only pay for the courier service you book."],
  ["What payment methods does Viasetu accept?", "Viasetu accepts UPI (GPay, PhonePe, Paytm), credit cards, debit cards and net banking via Razorpay."],
];

const FAQItem = ({ q, a }: { q: string; a: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl mb-3" style={{ background: C.bg2, border: `1px solid ${C.border}` }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-5 text-left">
        <span className="text-[#0B1220] font-semibold text-[15px] pr-4">{q}</span>
        <ChevronDown className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`} style={{ color: C.teal }} />
      </button>
      <div className="overflow-hidden transition-all" style={{ maxHeight: open ? 400 : 0 }}>
        <p className="px-5 pb-5 text-[14px] leading-relaxed" style={{ color: C.gray }}>{a}</p>
      </div>
    </div>
  );
};

/* ---------------- DATA ---------------- */
const ROUTES = [
  "Mumbai to Delhi", "Delhi to Mumbai", "Pune to Delhi", "Delhi to Pune",
  "Mumbai to Bangalore", "Bangalore to Mumbai", "Chennai to Delhi", "Delhi to Chennai",
  "Hyderabad to Mumbai", "Mumbai to Hyderabad", "Pune to Mumbai", "Mumbai to Pune",
  "Delhi to Kolkata", "Kolkata to Delhi", "Bangalore to Chennai", "Chennai to Bangalore",
  "Mumbai to Chennai", "Pune to Bangalore",
];

const ACTIVE_PARTNERS: { name: string; logo: string }[] = [
  { name: "Delhivery", logo: delhiveryLogo },
  { name: "Shadowfax", logo: shadowfaxLogo },
  { name: "XpressBees", logo: xpressbeesLogo },
  { name: "UrbaneBolt", logo: urbaneboltLogo },
  { name: "Shree Maruti", logo: shreeMarutiLogo },
];
const COMING_SOON_PARTNERS = ["Blue Dart", "DTDC", "India Post", "DHL", "FedEx"];

/* ---------------- MAIN ---------------- */
const Landing = () => {
  const navigate = useNavigate();
  const [cmsPosts, setCmsPosts] = useState<Array<{ slug: string; title: string; excerpt: string | null; body_html: string | null; featured_image_url: string | null; featured_image_alt: string | null; tags: string[] | null }>>([]);
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    const authRaw = localStorage.getItem("auth_session") || localStorage.getItem("prayog_auth");
    setIsAuthed(!!authRaw);
  }, []);

  useEffect(() => {
    const load = () => {
      supabase
        .from("cms_content")
        .select("slug,title,excerpt,body_html,featured_image_url,featured_image_alt,tags")
        .eq("type", "post")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(3)
        .then(({ data }) => setCmsPosts((data as never) || []));
    };
    load();
    const channel = supabase
      .channel("public:cms_content:landing")
      .on("postgres_changes", { event: "*", schema: "public", table: "cms_content", filter: "type=eq.post" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const goSend = () => navigate("/login");
  const goTrack = () => navigate("/tracking");
  const trackAwb = (awb: string) => navigate("/tracking", { state: { awbNumber: awb } });

  if (isAuthed) {
    return (
      <Suspense fallback={<div className="min-h-screen" />}>
        <AuthedHome />
      </Suspense>
    );
  }

  return (
    <PublicSiteLayout>
      <div style={{ background: C.bg, color: C.white, fontFamily: FONT_STACK }}>
      <PageSeo
        title="Best Courier Service in India | Compare & Book — ViaSetu"
        description="Compare prices from 14+ couriers, book doorstep pickup and track every parcel in one app. Save 20-40% on every shipment."
        path="/"
      />



      {/* HERO */}
      <section
        id="hero"
        aria-label="Compare courier services India"
        className="relative pt-4 md:pt-5 lg:pt-24 pb-6 md:pb-10 px-4 md:px-6 overflow-hidden flex flex-col lg:flex-row lg:items-center"
        style={{
          minHeight: "100vh",
          backgroundColor: "#F4F7FB",
        }}
      >
        {/* Desktop-only background video */}
        <video
          className="hidden lg:block absolute inset-0 w-full h-full object-cover pointer-events-none"
          src={heroDesktopVideo.url}
          poster={deliveryHero}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          aria-hidden="true"
          style={{ zIndex: 0 }}
        />
        <div className="hidden lg:block absolute top-0 left-0 w-[600px] h-[600px] rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(0,200,200,0.15) 0%, transparent 70%)", zIndex: 2 }} />

        <div className="relative w-full lg:pl-12 self-start lg:self-center" style={{ zIndex: 3 }}>


          <div
            className="max-w-xl mx-auto md:ml-0 md:mr-auto rounded-2xl p-5 md:p-7 md:backdrop-blur-sm bg-white md:bg-white/95 shadow-sm"
          >
            <h1 className="font-bold leading-[1.2] text-[24px] md:text-[32px] lg:text-[36px] text-[#0B1220]">
              India's First Consumer Courier Aggregator Compare top couriers. Doorstep Pickup. Real-Time Tracking. All in One App.
            </h1>
            <h2 className="mt-3 text-[14px] md:text-[16px] font-normal" style={{ color: C.gray }}>
              Compare Courier Prices &amp; Book Online <span style={{ color: C.teal }}>Save Up to 40%</span> on Every Parcel
            </h2>

            <div className="mt-5 flex flex-col sm:flex-row gap-3">
              <button
                onClick={goSend}
                className="h-12 px-6 rounded-lg font-bold text-[15px] flex items-center justify-center gap-2 transition-transform hover:scale-[1.02]"
                style={{ background: C.teal, color: C.bg }}
              >
                <Package className="h-5 w-5" /> Send a Parcel →
              </button>
              <a
                href="#track"
                className="h-12 px-6 rounded-lg font-bold text-[15px] flex items-center justify-center gap-2 border-2"
                style={{ borderColor: C.teal, color: C.teal }}
              >
                <Search className="h-5 w-5" /> Track a Parcel
              </a>
            </div>

            <div id="track" className="mt-4">
              <TrackForm onTrack={trackAwb} />
            </div>

            <div className="mt-4 text-[12px] md:text-[13px] flex flex-wrap gap-x-3 gap-y-1" style={{ color: C.gray }}>
              <span>Trusted by 10,000+ users</span>
              <span>·</span>
              <span>Pan-India coverage</span>
              <span>·</span>
              <span>5 active courier partners</span>
              <span>·</span>
              <span>Avg. saving ₹180 per shipment</span>
            </div>
          </div>
        </div>

      </section>



      {/* PARTNERS */}
      <section
        id="partners"
        className="relative py-16 px-6"
        style={{
          background: `linear-gradient(rgba(244,247,251,0.90), rgba(255,255,255,0.94)), url(${warehouseBg}) center/cover no-repeat`,
        }}
      >
        <div className="max-w-7xl mx-auto relative">
          <div className="text-center text-[12px] uppercase tracking-[0.2em] mb-8" style={{ color: C.teal }}>Our Courier Partners</div>
          <style>{`
            @keyframes viasetu-marquee {
              from { transform: translateX(0); }
              to { transform: translateX(-50%); }
            }
            .viasetu-marquee-track {
              display: flex;
              width: max-content;
              animation: viasetu-marquee 18s linear infinite;
            }
            .viasetu-marquee-mask {
              mask-image: linear-gradient(to right, transparent, #000 8%, #000 92%, transparent);
              -webkit-mask-image: linear-gradient(to right, transparent, #000 8%, #000 92%, transparent);
            }
          `}</style>
          <div className="viasetu-marquee-mask overflow-hidden">
            <div className="viasetu-marquee-track">
              {[...ACTIVE_PARTNERS, ...ACTIVE_PARTNERS].map((p, i) => (
                <div
                  key={`${p.name}-${i}`}
                  className="shrink-0 flex items-center justify-center px-3 sm:px-4 md:px-6"
                  style={{ width: "calc(100vw / 3)" }}
                >
                  <div
                    className="w-full flex items-center justify-center rounded-xl"
                    style={{ background: "#FFFFFF", border: `1px solid ${C.border}`, height: 88 }}
                  >
                    <img
                      src={p.logo}
                      alt={`${p.name} logo`}
                      className="max-h-[48px] sm:max-h-[52px] md:max-h-[56px] max-w-[80%] object-contain"
                      loading="lazy"
                      draggable={false}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <style>{`
            @media (min-width: 768px) {
              .viasetu-marquee-track > div { width: calc(100vw / 4) !important; }
            }
            @media (min-width: 1024px) {
              .viasetu-marquee-track > div { width: calc(min(1280px, 100vw) / 5) !important; }
            }
          `}</style>

          <div className="text-center text-[12px] uppercase tracking-[0.2em] mt-12 mb-4" style={{ color: C.gray }}>More Partners Coming Soon</div>
          <div className="flex flex-wrap justify-center gap-3">
            {COMING_SOON_PARTNERS.map((p) => (
              <div key={p} className="px-3 py-1.5 rounded-full text-[12px] flex items-center gap-2"
                style={{ background: C.card, border: `1px dashed ${C.border}`, color: C.gray }}>
                <span>{p}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "rgba(0,200,200,0.15)", color: C.teal }}>SOON</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="relative py-20 px-6" style={{ background: C.bg2 }}>
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-[28px] md:text-[40px] font-bold text-[#0B1220]">How to Send a Parcel with Viasetu</h2>
          <p className="mt-3 text-[14px] md:text-[16px]" style={{ color: C.gray }}>4 steps. 2 minutes. Cheaper than walking into a courier shop.</p>
          {/* Desktop: 3D illustration */}
          <div className="hidden md:block mt-12">
            <img
              src={howItWorksDesktop.url}
              alt="How Viasetu works: enter shipment details, compare courier prices, book and pay securely, track every shipment live"
              className="w-full h-auto rounded-2xl"
              loading="lazy"
            />
          </div>
          {/* Mobile: step illustration */}
          <div className="md:hidden mt-10">
            <img
              src={howItWorksMobile.url}
              alt="How Viasetu works: enter shipment details, compare courier prices, book and pay securely, track every shipment live"
              className="w-full max-w-md mx-auto h-auto rounded-2xl"
              loading="lazy"
            />
          </div>
          <div className="mt-10">
            <button onClick={goSend} className="h-14 px-8 rounded-lg font-bold text-[16px]" style={{ background: C.teal, color: C.bg }}>
              Send a Parcel Now →
            </button>
          </div>
        </div>
      </section>

      {/* WHY VIASETU */}
      <section id="why-viasetu" className="relative py-20 px-6" style={{ background: `linear-gradient(rgba(244,247,251,0.90), rgba(255,255,255,0.96)), url(${shippingBg}) center/cover no-repeat` }}>
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-[28px] md:text-[40px] font-bold text-[#0B1220] leading-tight">
              Why 10,000+ Indians Choose Viasetu to Send Their Parcels
            </h2>
            <div className="mt-8 space-y-5">
              {[
                ["Save 20–40% on Every Shipment", "Compare real-time prices across all integrated couriers. Stop overpaying at local courier shops."],
                ["5 Trusted Courier Partners in One App", "Delhivery, Shadowfax, XpressBees, UrbaneBolt and Shree Maruti — compared in 10 seconds."],
                ["Doorstep Pickup Across India", "Schedule pickup from your home, office or hostel. No shop visits. No queues."],
                ["AI-Powered Delivery Predictions", "Know your parcel's estimated arrival with a confidence score — not just a vague date range."],
                ["Unified Tracking for All Shipments", "Every parcel you've ever sent — tracked in one dashboard regardless of which courier carried it."],
              ].map(([t, b]) => (
                <div key={t} className="flex gap-3 p-3 rounded-lg" style={{ borderLeft: "2px solid transparent" }}>
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: C.teal }} />
                  <div>
                    <div className="text-[#0B1220] font-bold text-[15px]">{t}</div>
                    <div className="text-[13px] mt-1" style={{ color: C.gray }}>{b}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="hidden lg:block"><PhoneMockup src={appPreview2} /></div>
        </div>
      </section>

      {/* PERSONAS */}
      <section id="user-stories" className="py-20 px-6" style={{ background: C.bg }}>
        <div className="max-w-7xl mx-auto">
          <h2 className="text-center text-[28px] md:text-[40px] font-bold text-[#0B1220]">Who Uses Viasetu? Anyone Who Ships a Parcel in India.</h2>
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            {[
              { t: "Home Bakers & Micro-Sellers", b: "Ship your products across India without visiting courier shops. Compare rates, book pickup, track deliveries — all from your phone while you run your business.", s: "Avg. saving ₹2,400/month", img: personaBaker.url, alt: "Home baker packing cake for shipping" },
              { t: "Students Living Away From Home", b: "Send clothes, books and packages home without the hassle. Get doorstep pickup at your hostel or PG. Track until it reaches your family.", s: "Doorstep pickup anywhere", img: personaStudent.url, alt: "Student packing box to send home" },
              { t: "OLX / Meesho Sellers & SMEs", b: "Ship 10–50 orders a week with full tracking visibility. Professional shipping at consumer prices — no business account needed.", s: "Unified tracking dashboard", img: personaSeller.url, alt: "Small business seller packing orders" },
            ].map((p) => (
              <div key={p.t} className="rounded-xl overflow-hidden flex flex-col" style={{ background: C.bg2, border: `1px solid ${C.border}`, borderTop: `3px solid ${C.teal}` }}>
                <img src={p.img} alt={p.alt} loading="lazy" className="w-full h-48 md:h-56 object-cover" />
                <div className="p-8 flex-1 flex flex-col">
                  <h3 className="text-[#0B1220] font-bold text-[18px] mb-3">{p.t}</h3>
                  <p className="text-[13px] leading-relaxed mb-4" style={{ color: C.gray }}>{p.b}</p>
                  <span className="inline-block text-[12px] font-bold px-3 py-1 rounded-full self-start mt-auto" style={{ background: "rgba(0,200,200,0.15)", color: C.teal }}>{p.s}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="py-10 px-6" style={{ background: `linear-gradient(90deg, ${C.teal}, #007A7A)` }}>
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 divide-x divide-white/20">
          {[
            { v: 5, s: "+", l: "Active Courier Partners" },
            { v: 21000, s: "+", l: "Pincodes Covered" },
            { v: 40, s: "%", l: "Average Savings" },
            { v: 4, s: " Steps", l: "To Send Any Parcel" },
          ].map((x, i) => (
            <div key={i} className="text-center px-4">
              <div className="text-[#0B1220] font-bold text-[32px] md:text-[42px]"><Counter end={x.v} suffix={x.s} /></div>
              <div className="text-[14px] mt-1" style={{ color: C.bg }}>{x.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* POPULAR ROUTES */}
      <section id="popular-routes" className="relative py-20 px-6" style={{ background: `linear-gradient(rgba(244,247,251,0.92), rgba(255,255,255,0.96)), url(${parcelsBg}) center/cover no-repeat` }}>
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-[28px] md:text-[40px] font-bold text-[#0B1220]">Popular Courier Routes in India</h2>
          <p className="mt-3 text-[14px] md:text-[16px]" style={{ color: C.gray }}>Compare prices and book courier pickup on India's most shipped routes</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-10">
            {ROUTES.map((r) => (
              <button
                key={r}
                onClick={goSend}
                aria-label={`Book ${r} Courier`}
                className="px-4 py-2 rounded-full text-[13px] text-[#0B1220] text-center transition-colors hover:bg-[#00C8C8] hover:text-white"
                style={{ background: C.card, border: `1px solid ${C.border}` }}
              >
                {r} Courier
              </button>
            ))}
          </div>
          <p className="mt-8 text-[13px]" style={{ color: C.gray }}>
            Can't find your route?{" "}
            <button onClick={goSend} className="underline" style={{ color: C.teal }}>
              Open the booking app →
            </button>{" "}
            to compare any pincode-to-pincode combination across India.
          </p>
        </div>
      </section>

      {/* BLOG */}
      <section id="blog" className="py-20 px-6" style={{ background: C.bg2 }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-[28px] md:text-[40px] font-bold text-[#0B1220] mb-3">From the Viasetu Blog</h2>
            <p className="text-[16px]" style={{ color: C.gray }}>
              Tips, guides and insights to ship smarter across India.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {(cmsPosts.length > 0
              ? cmsPosts.map((p) => {
                  const stripped = (p.body_html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
                  const derived = p.excerpt && p.excerpt.trim()
                    ? p.excerpt.trim()
                    : (stripped ? (stripped.length > 160 ? stripped.slice(0, 157) + "…" : stripped) : "Read the full article for more.");
                  const words = stripped ? stripped.split(" ").length : 0;
                  const mins = Math.max(1, Math.round(words / 200));
                  return {
                    slug: p.slug,
                    tag: (p.tags && p.tags[0]) || "Article",
                    img: p.featured_image_url || logisticsBg,
                    alt: p.featured_image_alt || p.title,
                    title: p.title,
                    excerpt: derived,
                    read: `${mins} min read`,
                  };
                })
              : [
                  { slug: null, tag: "Shipping Guide", img: parcelsBg, alt: "Packing fragile items", title: "How to Pack Fragile Items for Safe Delivery", excerpt: "Bubble wrap, double-boxing, and labelling tips that prevent damage during transit.", read: "5 min read" },
                  { slug: null, tag: "Compare Couriers", img: logisticsBg, alt: "Compare couriers", title: "Delhivery vs XpressBees vs Shadowfax: Which to Choose?", excerpt: "A practical breakdown of pricing, TAT and serviceability across India's top partners.", read: "7 min read" },
                  { slug: null, tag: "Cost Saving", img: shippingBg, alt: "Reduce courier costs", title: "5 Ways to Reduce Your Courier Costs in 2026", excerpt: "Volumetric weight, surface vs air, and pickup batching — small changes, big savings.", read: "4 min read" },
                ]
            ).map((p) => {
              const Card = (
                <article
                  className="rounded-2xl overflow-hidden flex flex-col cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg h-full"
                  style={{ background: C.card, border: `1px solid ${C.border}` }}
                >
                  <div className="h-44 w-full overflow-hidden">
                    <img src={p.img} alt={p.alt} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" />
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    <span
                      className="self-start text-[11px] font-semibold px-2 py-1 rounded-full mb-3"
                      style={{ background: `${C.teal}15`, color: C.teal }}
                    >
                      {p.tag}
                    </span>
                    <h3 className="text-[18px] font-bold text-[#0B1220] mb-2 leading-snug">{p.title}</h3>
                    <p className="text-[14px] mb-4 flex-1 line-clamp-3" style={{ color: C.gray }}>{p.excerpt}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px]" style={{ color: C.gray }}>{p.read}</span>
                      <span className="text-[13px] font-semibold" style={{ color: C.teal }}>Read more →</span>
                    </div>
                  </div>
                </article>
              );
              return p.slug ? (
                <Link key={p.slug} to={`/blog/${p.slug}`}>{Card}</Link>
              ) : (
                <div key={p.title}>{Card}</div>
              );
            })}
          </div>
          <div className="text-center mt-10">
            <Link
              to="/blog"
              className="inline-block px-6 h-11 leading-[44px] rounded-lg font-semibold text-[14px] border-2 transition-colors hover:bg-[#00C8C8]/10"
              style={{ borderColor: C.teal, color: C.teal }}
            >
              View all articles
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 px-6" style={{ background: C.bg }}>
        <div className="max-w-3xl mx-auto">
          <h2 className="text-center text-[28px] md:text-[40px] font-bold text-[#0B1220] mb-10">Frequently Asked Questions About Sending Parcels in India</h2>
          {FAQ_ITEMS.map(([q, a]) => <FAQItem key={q} q={q} a={a} />)}
        </div>
      </section>

      </div>
    </PublicSiteLayout>
  );
};

export default Landing;
