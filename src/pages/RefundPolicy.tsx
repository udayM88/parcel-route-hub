import PublicSiteLayout from "@/components/site/PublicSiteLayout";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

const Section = ({ n, title, children }: { n: string; title: string; children: React.ReactNode }) => (
  <section className="mb-8">
    <h2 className="text-[18px] md:text-[20px] font-bold text-[#0B1220] mb-3">
      {n}. {title}
    </h2>
    <div className="text-[14px] md:text-[15px] leading-7 text-[#3A4658] space-y-3">{children}</div>
  </section>
);

const List = ({ items }: { items: (string | React.ReactNode)[] }) => (
  <ul className="list-disc pl-6 space-y-1">
    {items.map((it, i) => <li key={i}>{it}</li>)}
  </ul>
);

export default function RefundPolicy() {
  return (
    <PublicSiteLayout>
      <Helmet>
        <title>Refund &amp; Cancellation Policy — ViaSetu</title>
        <meta name="description" content="Refund and Cancellation Policy of Viasetu Private Limited — eligibility, non-refundable situations, and refund timelines." />
        <link rel="canonical" href="https://www.viasetu.com/refund-policy" />
        <meta name="robots" content="index, follow" />
      </Helmet>

      <article className="max-w-4xl mx-auto px-6 py-12">
        <header className="mb-10 border-b border-[#E2E8F0] pb-6">
          <h1 className="text-[28px] md:text-[36px] font-extrabold text-[#0B1220] leading-tight">
            Refund &amp; Cancellation Policy
          </h1>
          <p className="text-[14px] text-[#5A6B80] mt-2">Of Viasetu Private Limited</p>
          <p className="text-[13px] text-[#5A6B80] mt-4 leading-6">
            This Refund &amp; Cancellation Policy governs cancellations and refunds relating to shipment bookings
            made through the ViaSetu website or mobile application. By placing a booking on the Platform, you
            agree to the terms described below.
          </p>
        </header>

        <Section n="1" title="Shipment Cancellation">
          <p>Shipment bookings may be cancelled before pickup confirmation by the courier partner. Once pickup is completed, cancellation may not be possible.</p>
          <List items={[
            "Cancellations can be initiated from the order details page or by contacting our support team.",
            "If the courier partner fails to pick up or fulfil the shipment, the booking may be cancelled by the Platform and a refund initiated automatically.",
            "Orders that remain unpaid or incomplete (payment abandoned) are not eligible for refunds as no successful payment was captured.",
          ]} />
        </Section>

        <Section n="2" title="Refund Eligibility">
          <p>Refunds may be applicable in cases including:</p>
          <List items={[
            "Duplicate payment for the same shipment",
            "Failed transaction where the amount was debited but the booking was not created",
            "Shipment cancellation before pickup confirmation",
            "Service failure by the courier partner (e.g., pickup not completed or shipment not manifested)",
            "Multi-parcel bookings where one or more parcels fail to be created — a proportional refund for the failed parcels is processed automatically",
          ]} />
        </Section>

        <Section n="3" title="Non-Refundable Situations">
          <p>Refunds may not be applicable for:</p>
          <List items={[
            "Shipments already picked up by the courier partner",
            "Delivery delays caused by courier partners, weather, regulatory restrictions, or other external factors",
            "Incorrect shipment information (weight, dimensions, address, or product description) provided by the user",
            "Weight or dimension discrepancies charged by the courier partner where the declared shipment details were inaccurate",
          ]} />
        </Section>

        <Section n="4" title="Refund Timeline &amp; Method">
          <List items={[
            "Eligible refunds are processed within 7–10 business days through the original payment method (Razorpay).",
            "Refunds are issued for the full amount paid, inclusive of taxes, unless otherwise stated.",
            "Refund status is visible on the order details page once the order has been cancelled.",
            "If a refund fails due to banking issues, our support team will reach out to arrange an alternate resolution.",
          ]} />
        </Section>

        <Section n="5" title="Pricing &amp; Taxes">
          <List items={[
            "All prices displayed at the time of booking are inclusive of GST (18%) and all applicable charges.",
            "The amount refunded equals the amount actually charged for the cancelled or failed shipment.",
            "No Cash on Delivery (COD) is supported; all payments are prepaid and online.",
          ]} />
        </Section>

        <Section n="6" title="Contact &amp; Grievances">
          <p>
            For refund-related queries, contact us at{" "}
            <a href="mailto:support@viasetu.com" className="text-[#00A8A8] font-medium">support@viasetu.com</a>{" "}
            or call <a href="tel:+919013999909" className="text-[#00A8A8] font-medium">+91 90139 99909</a>{" "}
            (9 AM – 9 PM IST). Unresolved concerns may be escalated to our Grievance Officer as described in the{" "}
            <Link to="/privacy-policy" className="text-[#00A8A8] font-medium">Privacy Policy</Link>.
          </p>
        </Section>

        <div className="mt-10 pt-6 border-t border-[#E2E8F0] text-[12px] text-[#5A6B80]">
          Related policies: <Link to="/privacy-policy" className="text-[#00A8A8] font-medium">Privacy Policy</Link> ·{" "}
          <Link to="/terms-and-conditions" className="text-[#00A8A8] font-medium">Terms &amp; Conditions</Link>
        </div>
      </article>
    </PublicSiteLayout>
  );
}
