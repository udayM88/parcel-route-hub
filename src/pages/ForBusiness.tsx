import { useState } from "react";
import { Helmet } from "react-helmet-async";
import PublicSiteLayout from "@/components/site/PublicSiteLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  Briefcase, ArrowRight, IndianRupee, Truck, BarChart3, Headphones,
  ShieldCheck, Boxes, Loader2, CheckCircle2, AlertCircle,
} from "lucide-react";

const C = {
  bg: "#FFFFFF",
  bg2: "#F4F7FB",
  teal: "#00A8A8",
  text: "#0B1220",
  gray: "#5A6B80",
  border: "#E2E8F0",
  danger: "#DC2626",
};

const VOLUMES = ["1-50", "51-200", "201-500", "501-1,000", "1,001-5,000", "5,000+"];
const VOLUME_LABELS: Record<string, string> = {
  "1-50": "1 – 50 shipments",
  "51-200": "51 – 200 shipments",
  "201-500": "201 – 500 shipments",
  "501-1,000": "501 – 1,000 shipments",
  "1,001-5,000": "1,001 – 5,000 shipments",
  "5,000+": "5,000+ shipments",
};

const BUSINESS_TYPES = [
  "D2C / Online Store",
  "Marketplace Seller (Amazon, Flipkart, Meesho)",
  "Home Business / Micro Seller",
  "Retail Shop / Distributor",
  "Manufacturer / Wholesaler",
  "Services / Other",
];

const BENEFITS = [
  { icon: IndianRupee, title: "Negotiated bulk rates", text: "Business pricing across all our courier partners — one invoice, no hidden charges." },
  { icon: Boxes, title: "Multi-box bookings", text: "Book several boxes to the same destination in a single flow, with per-box labels." },
  { icon: Truck, title: "Doorstep pickup", text: "Scheduled pickups from your warehouse or store, six days a week." },
  { icon: BarChart3, title: "One dashboard", text: "Track shipped, in-transit and delivered volumes with downloadable labels and invoices." },
  { icon: ShieldCheck, title: "Reliable partners", text: "Delhivery, XpressBees, Shadowfax, Shree Maruti and UrbaneBolt in one place." },
  { icon: Headphones, title: "Priority support", text: "A dedicated point of contact for escalations, disputes and NDR handling." },
];

type Fields = {
  name: string; company_name: string; email: string; phone: string;
  business_type: string; monthly_volume: string;
};

const EMPTY: Fields = { name: "", company_name: "", email: "", phone: "", business_type: "", monthly_volume: "" };

export default function ForBusiness() {
  const [form, setForm] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const set = (k: keyof Fields, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const validate = () => {
    const e: Partial<Record<keyof Fields, string>> = {};
    if (form.name.trim().length < 2) e.name = "Please enter your full name";
    if (form.company_name.trim().length < 2) e.company_name = "Please enter your business name";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) e.email = "Please enter a valid email address";
    if (!/^[6-9]\d{9}$/.test(form.phone.replace(/\D/g, ""))) e.phone = "Enter a valid 10-digit mobile number";
    if (!form.business_type) e.business_type = "Please select your business type";
    if (!form.monthly_volume) e.monthly_volume = "Please select your monthly volume";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (status === "loading" || status === "success") return;
    if (!validate()) return;

    setStatus("loading");
    setMessage("");
    try {
      const { data, error } = await supabase.functions.invoke("business-inquiry", {
        body: {
          name: form.name.trim(),
          company_name: form.company_name.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.replace(/\D/g, ""),
          business_type: form.business_type,
          monthly_volume: form.monthly_volume,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      setStatus("success");
      setMessage(
        (data as any)?.duplicate
          ? "We already have your inquiry — our team will reach out shortly."
          : "Thanks! Your inquiry has been received. Our business team will contact you within one working day.",
      );
      setForm(EMPTY);
    } catch (err) {
      setStatus("error");
      setMessage("Something went wrong while submitting. Please try again or email support@viasetu.com.");
    }
  };

  const inputCls = (bad?: string) =>
    `w-full h-12 rounded-lg border px-4 text-[14px] outline-none transition-colors focus:border-[#00A8A8] ${bad ? "border-[#DC2626]" : ""}`;

  return (
    <PublicSiteLayout>
      <Helmet>
        <title>ViaSetu for Business — Bulk Courier Rates & Pickup</title>
        <meta name="description" content="Ship more, pay less. Business courier rates, doorstep pickup, multi-box bookings and one dashboard for Indian businesses. Get a custom quote from ViaSetu." />
        <link rel="canonical" href="https://www.viasetu.com/for-business" />
      </Helmet>

      {/* Hero */}
      <section className="px-6 py-16 md:py-24" style={{ background: `linear-gradient(180deg, ${C.bg2} 0%, ${C.bg} 100%)` }}>
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[12px] font-semibold mb-6"
               style={{ background: `${C.teal}1A`, color: C.teal }}>
            <Briefcase className="h-3.5 w-3.5" /> For Business
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold leading-tight" style={{ color: C.text }}>
            For Business
          </h1>
          <p className="mt-5 text-[15px] md:text-[17px] max-w-3xl mx-auto" style={{ color: C.gray }}>
            Ship more and pay less. ViaSetu gives growing Indian businesses bulk courier rates, scheduled doorstep
            pickups and a single dashboard across India's top courier partners.
          </p>
          <div className="flex flex-wrap gap-3 justify-center mt-8">
            <a href="#inquiry"
               className="px-6 h-12 inline-flex items-center rounded-lg font-bold text-[14px] transition-transform hover:scale-[1.02]"
               style={{ background: C.teal, color: C.bg }}>
              Get Business Pricing <ArrowRight className="inline h-4 w-4 ml-1" />
            </a>
          </div>
        </div>
      </section>

      {/* Value proposition */}
      <section className="px-6 py-14 md:py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold" style={{ color: C.text }}>
            One partner for all your shipping
          </h2>
          <p className="mt-4 text-[15px] md:text-[16px]" style={{ color: C.gray }}>
            Stop juggling multiple courier portals and rate sheets. Compare live rates, book in bulk, print labels and
            track every parcel from one place — with transparent, GST-inclusive pricing built for volume.
          </p>
        </div>
      </section>

      {/* Benefits */}
      <section className="px-6 pb-16" style={{ background: C.bg }}>
        <div className="max-w-6xl mx-auto grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {BENEFITS.map((b) => {
            const Icon = b.icon;
            return (
              <div key={b.title} className="p-6 rounded-2xl border transition-shadow hover:shadow-lg"
                   style={{ background: C.bg, borderColor: C.border }}>
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl mb-4"
                     style={{ background: `${C.teal}1A`, color: C.teal }}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-[16px]" style={{ color: C.text }}>{b.title}</h3>
                <p className="text-[13.5px] mt-2 leading-relaxed" style={{ color: C.gray }}>{b.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Inquiry form */}
      <section id="inquiry" className="px-6 py-16" style={{ background: C.bg2 }}>
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold" style={{ color: C.text }}>Business Inquiry</h2>
            <p className="mt-3 text-[15px]" style={{ color: C.gray }}>
              Tell us a little about your business and we'll send across a custom rate card.
            </p>
          </div>

          <form onSubmit={submit} noValidate
                className="p-6 md:p-8 rounded-2xl border shadow-sm"
                style={{ background: C.bg, borderColor: C.border }}>
            <div className="grid md:grid-cols-2 gap-5">
              <div className="md:col-span-1">
                <label htmlFor="bi-name" className="block text-[13px] font-semibold mb-2" style={{ color: C.text }}>Name</label>
                <input id="bi-name" value={form.name} onChange={(e) => set("name", e.target.value)}
                       maxLength={100} autoComplete="name" placeholder="Your full name"
                       className={inputCls(errors.name)} style={{ borderColor: errors.name ? C.danger : C.border, color: C.text }} />
                {errors.name && <p className="text-[12px] mt-1.5" style={{ color: C.danger }}>{errors.name}</p>}
              </div>

              <div className="md:col-span-1">
                <label htmlFor="bi-company" className="block text-[13px] font-semibold mb-2" style={{ color: C.text }}>Company / Business Name</label>
                <input id="bi-company" value={form.company_name} onChange={(e) => set("company_name", e.target.value)}
                       maxLength={150} autoComplete="organization" placeholder="Registered or trade name"
                       className={inputCls(errors.company_name)} style={{ borderColor: errors.company_name ? C.danger : C.border, color: C.text }} />
                {errors.company_name && <p className="text-[12px] mt-1.5" style={{ color: C.danger }}>{errors.company_name}</p>}
              </div>

              <div className="md:col-span-1">
                <label htmlFor="bi-email" className="block text-[13px] font-semibold mb-2" style={{ color: C.text }}>Email</label>
                <input id="bi-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)}
                       maxLength={255} autoComplete="email" placeholder="you@company.com"
                       className={inputCls(errors.email)} style={{ borderColor: errors.email ? C.danger : C.border, color: C.text }} />
                {errors.email && <p className="text-[12px] mt-1.5" style={{ color: C.danger }}>{errors.email}</p>}
              </div>

              <div className="md:col-span-1">
                <label htmlFor="bi-phone" className="block text-[13px] font-semibold mb-2" style={{ color: C.text }}>Phone Number</label>
                <input id="bi-phone" type="tel" inputMode="numeric" value={form.phone}
                       onChange={(e) => set("phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
                       autoComplete="tel" placeholder="10-digit mobile number"
                       className={inputCls(errors.phone)} style={{ borderColor: errors.phone ? C.danger : C.border, color: C.text }} />
                {errors.phone && <p className="text-[12px] mt-1.5" style={{ color: C.danger }}>{errors.phone}</p>}
              </div>

              <div className="md:col-span-1">
                <label htmlFor="bi-type" className="block text-[13px] font-semibold mb-2" style={{ color: C.text }}>Business Type</label>
                <select id="bi-type" value={form.business_type} onChange={(e) => set("business_type", e.target.value)}
                        className={`${inputCls(errors.business_type)} bg-white`}
                        style={{ borderColor: errors.business_type ? C.danger : C.border, color: form.business_type ? C.text : C.gray }}>
                  <option value="">Select business type</option>
                  {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                {errors.business_type && <p className="text-[12px] mt-1.5" style={{ color: C.danger }}>{errors.business_type}</p>}
              </div>

              <div className="md:col-span-1">
                <label htmlFor="bi-volume" className="block text-[13px] font-semibold mb-2" style={{ color: C.text }}>Monthly Shipment Volume</label>
                <select id="bi-volume" value={form.monthly_volume} onChange={(e) => set("monthly_volume", e.target.value)}
                        className={`${inputCls(errors.monthly_volume)} bg-white`}
                        style={{ borderColor: errors.monthly_volume ? C.danger : C.border, color: form.monthly_volume ? C.text : C.gray }}>
                  <option value="">Select monthly volume</option>
                  {VOLUMES.map((v) => <option key={v} value={v}>{VOLUME_LABELS[v]}</option>)}
                </select>
                {errors.monthly_volume && <p className="text-[12px] mt-1.5" style={{ color: C.danger }}>{errors.monthly_volume}</p>}
              </div>
            </div>

            {status === "success" && (
              <div className="mt-6 flex items-start gap-2 rounded-lg p-4 text-[13.5px]"
                   style={{ background: `${C.teal}12`, color: C.text }} role="status">
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" style={{ color: C.teal }} />
                <span>{message}</span>
              </div>
            )}
            {status === "error" && (
              <div className="mt-6 flex items-start gap-2 rounded-lg p-4 text-[13.5px]"
                   style={{ background: "#FEF2F2", color: C.danger }} role="alert">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{message}</span>
              </div>
            )}

            <button type="submit" disabled={status === "loading" || status === "success"}
                    className="mt-6 w-full h-12 rounded-lg font-bold text-[14px] inline-flex items-center justify-center gap-2 transition-transform hover:scale-[1.01] disabled:opacity-60 disabled:hover:scale-100"
                    style={{ background: C.teal, color: C.bg }}>
              {status === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
              {status === "loading" ? "Submitting…" : status === "success" ? "Inquiry Submitted" : "Submit Inquiry"}
            </button>

            <p className="mt-4 text-[12px] text-center" style={{ color: C.gray }}>
              We'll only use these details to contact you about business shipping.
            </p>
          </form>
        </div>
      </section>
    </PublicSiteLayout>
  );
}
