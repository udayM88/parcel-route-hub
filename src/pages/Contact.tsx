import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import PublicSiteLayout from "@/components/site/PublicSiteLayout";
import { Mail, Phone, MapPin, ArrowRight, MessageCircle } from "lucide-react";

const C = {
  bg: "#FFFFFF",
  bg2: "#F4F7FB",
  teal: "#00A8A8",
  text: "#0B1220",
  gray: "#5A6B80",
  border: "#E2E8F0",
};

export default function Contact() {
  const navigate = useNavigate();

  return (
    <PublicSiteLayout>
      <Helmet>
        <title>Contact Us — ViaSetu</title>
        <meta name="description" content="Get in touch with ViaSetu — India's consumer-first courier aggregator." />
        <link rel="canonical" href="https://www.viasetu.com/contact" />
      </Helmet>

      {/* Hero */}
      <section className="px-6 py-16 md:py-24" style={{ background: `linear-gradient(180deg, ${C.bg2} 0%, ${C.bg} 100%)` }}>
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[12px] font-semibold mb-6"
               style={{ background: `${C.teal}1A`, color: C.teal }}>
            <MessageCircle className="h-3.5 w-3.5" /> Contact Us
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold leading-tight" style={{ color: C.text }}>
            We're here to help.
          </h1>
          <p className="mt-5 text-[15px] md:text-[17px] max-w-3xl mx-auto" style={{ color: C.gray }}>
            Have a question about your shipment, a partnership inquiry, or just want to say hello? Reach out and our team will get back to you.
          </p>
        </div>
      </section>

      {/* Contact Cards */}
      <section className="px-6 py-16">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
          <a href="mailto:support@viasetu.com" className="p-6 rounded-2xl border transition-shadow hover:shadow-lg" style={{ background: C.bg, borderColor: C.border }}>
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl mb-4" style={{ background: `${C.teal}1A`, color: C.teal }}>
              <Mail className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-[16px]" style={{ color: C.text }}>Email Us</h3>
            <p className="text-[13.5px] mt-2" style={{ color: C.gray }}>support@viasetu.com</p>
            <p className="text-[12.5px] mt-1" style={{ color: C.teal }}>We reply within 24 hours</p>
          </a>

          <a href="tel:+919013999909" className="p-6 rounded-2xl border transition-shadow hover:shadow-lg" style={{ background: C.bg, borderColor: C.border }}>
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl mb-4" style={{ background: `${C.teal}1A`, color: C.teal }}>
              <Phone className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-[16px]" style={{ color: C.text }}>Call Us</h3>
            <p className="text-[13.5px] mt-2" style={{ color: C.gray }}>+91 90139 99909</p>
            <p className="text-[12.5px] mt-1" style={{ color: C.teal }}>Mon–Sat, 9 AM – 7 PM IST</p>
          </a>

          <div className="p-6 rounded-2xl border" style={{ background: C.bg, borderColor: C.border }}>
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl mb-4" style={{ background: `${C.teal}1A`, color: C.teal }}>
              <MapPin className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-[16px]" style={{ color: C.text }}>Visit Us</h3>
            <p className="text-[13.5px] mt-2" style={{ color: C.gray }}>
              ViaSetu Technologies Pvt. Ltd.<br />
              Pune, Maharashtra, India
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-16" style={{ background: C.bg2 }}>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold" style={{ color: C.text }}>Ready to ship smarter?</h2>
          <p className="mt-3 text-[15px]" style={{ color: C.gray }}>
            Join thousands of Indians who trust ViaSetu for fast, transparent courier bookings.
          </p>
          <div className="flex flex-wrap gap-3 justify-center mt-7">
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
        </div>
      </section>
    </PublicSiteLayout>
  );
}
