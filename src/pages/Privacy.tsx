import PublicSiteLayout from "@/components/site/PublicSiteLayout";
import { Helmet } from "react-helmet-async";

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

export default function Privacy() {
  return (
    <PublicSiteLayout>
      <Helmet>
        <title>Privacy Policy — ViaSetu</title>
        <meta name="description" content="Privacy Policy, Shipping Policy, Refund Policy, Grievance Redressal and Disclaimer of Viasetu Private Limited." />
        <link rel="canonical" href="https://www.viasetu.com/Privacypolicy" />
        <meta name="robots" content="index, follow" />
      </Helmet>

      <article className="max-w-4xl mx-auto px-6 py-12">
        <header className="mb-10 border-b border-[#E2E8F0] pb-6">
          <h1 className="text-[28px] md:text-[36px] font-extrabold text-[#0B1220] leading-tight">
            Privacy Policy
          </h1>
          <p className="text-[14px] text-[#5A6B80] mt-2">Of Viasetu Private Limited</p>
          <p className="text-[13px] text-[#5A6B80] mt-4 leading-6">
            This Privacy Policy explains how <strong>Viasetu Private Limited</strong> (hereinafter referred to as the
            “Company”, “Platform”, or “we”) collects, uses, and protects personal information of users accessing the
            website or mobile application. This policy is issued in compliance with the provisions of the
            Information Technology Act, 2000 and the Information Technology (Reasonable Security Practices and
            Procedures and Sensitive Personal Data or Information) Rules, 2011.
          </p>
        </header>

        <Section n="1" title="Information We Collect">
          <p>The Company may collect the following information:</p>
          <List items={[
            "Name",
            "Contact number",
            "Email",
            "Address",
            "Pickup and delivery addresses",
            "Shipment information",
            "Payment details",
            "Device and usage information",
          ]} />
        </Section>

        <Section n="2" title="Purpose of Collecting Information">
          <p>The information collected may be used for:</p>
          <List items={[
            "Providing courier booking services",
            "Processing shipments and payments",
            "Communicating shipment updates",
            "Improving platform functionality",
            "Complying with legal obligations",
          ]} />
        </Section>

        <Section n="3" title="Sharing of Information">
          <p>User information may be shared with:</p>
          <List items={[
            "Courier partners for shipment delivery.",
            "Payment gateways for payment processing.",
            "Government authorities when required by law.",
          ]} />
          <p>The Company does not sell or rent user personal data to third parties.</p>
        </Section>

        <Section n="4" title="Data Security">
          <p>The Company adopts reasonable security practices to protect user information from unauthorized access, misuse, or disclosure.</p>
        </Section>

        <Section n="5" title="Data Retention">
          <p>Personal data may be retained as long as required for providing services or complying with legal requirements.</p>
        </Section>

        <Section n="6" title="User Rights">
          <p>Users may request:</p>
          <List items={[
            "Access to their data.",
            "Correction of inaccurate information.",
            "Deletion of data where permissible by law.",
          ]} />
        </Section>

        <Section n="7" title="Policy Updates">
          <p>The Company may update this Privacy Policy from time to time. Updated versions shall be published on the Platform.</p>
        </Section>

        <Section n="8" title="Shipping Policy">
          <p className="font-semibold text-[#0B1220]">Shipping and Delivery Policy</p>
          <p>This Shipping Policy governs shipment bookings made through the Platform.</p>

          <p className="font-medium text-[#0B1220] mt-3">Shipment Booking</p>
          <p>Users may book shipments by providing accurate shipment details including:</p>
          <List items={[
            "Pickup address",
            "Delivery address",
            "Shipment weight and dimensions",
            "Product description",
          ]} />

          <p className="font-medium text-[#0B1220] mt-3">Courier Partners</p>
          <p>All shipments are delivered by independent courier partners integrated with the Platform. The Platform only facilitates booking and tracking of shipments.</p>

          <p className="font-medium text-[#0B1220] mt-3">Delivery Timelines</p>
          <p>Estimated delivery timelines displayed on the Platform are indicative and may vary depending on:</p>
          <List items={[
            "Courier partner operations",
            "Weather conditions",
            "Regulatory restrictions",
            "Transportation disruptions",
          ]} />

          <p className="font-medium text-[#0B1220] mt-3">Shipment Tracking</p>
          <p>Users may track shipments through the tracking features provided on the Platform. Tracking information is provided by courier partners.</p>

          <p className="font-medium text-[#0B1220] mt-3">Packaging Responsibility</p>
          <p>Users are responsible for ensuring that shipments are properly packaged to avoid damage during transit.</p>
        </Section>

        <Section n="9" title="Refund and Cancellation Policy">
          <p>This policy governs cancellations and refunds relating to shipment bookings.</p>

          <p className="font-medium text-[#0B1220] mt-3">Shipment Cancellation</p>
          <p>Shipment bookings may be cancelled before pickup confirmation by the courier partner. Once pickup is completed, cancellation may not be possible.</p>

          <p className="font-medium text-[#0B1220] mt-3">Refund Eligibility</p>
          <p>Refunds may be applicable in cases including:</p>
          <List items={[
            "Duplicate payment",
            "Failed transaction with amount debited",
            "Shipment cancellation before pickup",
          ]} />

          <p className="font-medium text-[#0B1220] mt-3">Non-Refundable Situations</p>
          <p>Refunds may not be applicable for:</p>
          <List items={[
            "Shipments already picked up",
            "Delivery delays caused by courier partners",
            "Incorrect shipment information provided by users",
          ]} />

          <p className="font-medium text-[#0B1220] mt-3">Refund Timeline</p>
          <p>Eligible refunds shall be processed within 7–10 business days through the original payment method.</p>
        </Section>

        <Section n="10" title="Grievance Redressal Policy">
          <p className="font-medium text-[#0B1220]">Grievance Officer</p>
          <p>In accordance with the Information Technology Act, 2000 and the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, the Company has appointed a Grievance Officer.</p>
          <p>Users may contact the Grievance Officer for any complaints relating to:</p>
          <List items={[
            "Service issues",
            "Misuse of the Platform",
            "Data privacy concerns",
          ]} />

          <p className="font-medium text-[#0B1220] mt-3">Grievance Officer Details</p>
          <List items={[
            <>Name: <strong>Ms. Yogita Mishra</strong></>,
            <>Email: <a href="mailto:yogita@viasetu.com" className="text-[#00A8A8] font-medium">yogita@viasetu.com</a></>,
            <>Address: Flat No. 5, Building No. 3, 2nd Floor, Atur Park, Naylore Road, Koregaon Park, Pune, Maharashtra, India, 411001</>,
          ]} />
          <p className="mt-2">The Company shall acknowledge grievances within 48 hours and endeavour to resolve them within 15 days.</p>
        </Section>

        <Section n="11" title="Disclaimer Policy">
          <p className="font-semibold text-[#0B1220]">Website Disclaimer</p>
          <p>The information and services provided on the Platform/App are offered on an “as is” and “as available” basis.</p>

          <p className="font-medium text-[#0B1220] mt-3">The Company makes no warranties regarding:</p>
          <List items={[
            "Uninterrupted availability of the Platform",
            "Accuracy of shipment tracking information",
            "Performance of courier partners",
          ]} />

          <p className="font-medium text-[#0B1220] mt-3">The Company shall not be responsible for:</p>
          <List items={[
            "Shipment loss or damage caused by courier partners",
            "Delivery delays due to external factors",
            "Incorrect information provided by users",
          ]} />
          <p>Users access and use the Platform at their own risk.</p>
        </Section>

        <div className="mt-10 pt-6 border-t border-[#E2E8F0] text-[12px] text-[#5A6B80]">
          For questions about this Privacy Policy, contact us at <a href="mailto:support@viasetu.com" className="text-[#00A8A8] font-medium">support@viasetu.com</a>.
        </div>
      </article>
    </PublicSiteLayout>
  );
}
