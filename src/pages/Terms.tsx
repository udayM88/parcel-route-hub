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

export default function Terms() {
  return (
    <PublicSiteLayout>
      <Helmet>
        <title>Terms & Conditions — ViaSetu</title>
        <meta name="description" content="Terms and Conditions for use of the ViaSetu courier aggregator platform operated by Viasetu Private Limited." />
        <link rel="canonical" href="https://www.viasetu.com/Termsandconditions" />
        <meta name="robots" content="index, follow" />
      </Helmet>

      <article className="max-w-4xl mx-auto px-6 py-12">
        <header className="mb-10 border-b border-[#E2E8F0] pb-6">
          <h1 className="text-[28px] md:text-[36px] font-extrabold text-[#0B1220] leading-tight">
            Terms and Conditions
          </h1>
          <p className="text-[14px] text-[#5A6B80] mt-2">For use of the Courier Aggregator Platform</p>
          <p className="text-[13px] text-[#5A6B80] mt-4 leading-6">
            These Terms and Conditions ("Terms") govern the access and use of the website, mobile
            application, and services provided by <strong>Viasetu Private Limited</strong>, a company
            incorporated under the Companies Act, 2013 and having its registered office at Flat No. 5,
            Building No. 3, 2nd Floor, Atur Park, Naylore Road, Koregaon Park, Pune, Maharashtra, India,
            411 001 (hereinafter referred to as the "Company" or "Platform").
          </p>
          <p className="text-[13px] text-[#5A6B80] mt-3">
            By accessing or using the Platform, the user agrees to be bound by these Terms.
          </p>
        </header>

        <Section n="1" title="Definitions">
          <p>For the purpose of these Terms:</p>
          <List items={[
            <><strong>Platform</strong> means the website, software, and mobile application operated by the Company for facilitating booking of courier and logistics services.</>,
            <><strong>User</strong> means any individual, business entity, or organization accessing or using the Platform.</>,
            <><strong>Courier Partner</strong> means independent third-party logistics companies whose services are made available through the Platform.</>,
            <><strong>Shipment</strong> means any parcel, package, or consignment booked through the Platform.</>,
            <><strong>Consignor</strong> means the person or entity sending the shipment.</>,
            <><strong>Consignee</strong> means the person or entity receiving the shipment.</>,
          ]} />
        </Section>

        <Section n="2" title="Nature of Platform Services">
          <p>The Platform operates as a technology-enabled logistics aggregation platform that facilitates booking of courier services from third-party courier partners.</p>
          <p>The Company:</p>
          <List items={[
            "Does not provide courier services directly.",
            "Does not physically handle shipments.",
            "Does not guarantee delivery timelines.",
          ]} />
          <p>All transportation and delivery services are performed solely by the respective courier partners.</p>
        </Section>

        <Section n="3" title="Intermediary Status under Information Technology Act, 2000">
          <p>The Platform functions as an intermediary within the meaning of Section 2(1)(w) of the Information Technology Act, 2000. Accordingly:</p>
          <List items={[
            "The Platform acts only as a facilitator between users and courier partners.",
            "The Platform does not control shipment handling, transportation, or delivery.",
          ]} />
          <p>The Company shall be entitled to protection under Section 79 of the Information Technology Act, 2000 for third-party actions conducted through the Platform.</p>
        </Section>

        <Section n="4" title="User Account Registration">
          <p>To access certain services, users may be required to create an account. The user agrees to:</p>
          <List items={[
            "Provide accurate and complete information.",
            "Maintain confidentiality of login credentials.",
            "Update information when necessary.",
          ]} />
          <p>The user shall be responsible for all activities conducted through their account. The Company shall not be liable for unauthorized use of user accounts.</p>
        </Section>

        <Section n="5" title="Shipment Booking">
          <p>Users may book shipments through the Platform by selecting a courier partner and providing shipment details including:</p>
          <List items={[
            "Pickup and delivery addresses.",
            "Weight and dimensions.",
            "Shipment value.",
            "Product description.",
          ]} />
          <p>The Company does not guarantee that any courier partner will accept the booking request.</p>
        </Section>

        <Section n="6" title="User Obligations">
          <p>Users agree to:</p>
          <List items={[
            "Provide accurate shipment details.",
            "Ensure proper packaging of shipments.",
            "Comply with all applicable laws and regulations.",
          ]} />
          <p>The user shall be solely responsible for any consequences arising from incorrect shipment information.</p>
        </Section>

        <Section n="7" title="Weight Discrepancy Policy">
          <p>Users must declare accurate shipment weight and dimensions at the time of booking. If the courier partner determines that the actual or volumetric weight exceeds the declared weight, the courier partner may revise the applicable shipping charges.</p>
          <p>The user agrees that:</p>
          <List items={[
            "Revised charges shall be binding.",
            "The Platform may collect additional charges from the user.",
          ]} />
          <p>Failure to pay such charges may result in suspension of services.</p>
        </Section>

        <Section n="8" title="Shipment Value Declaration & Insurance">
          <p>Users shall declare the accurate value of shipments. If insurance is not opted for, the shipment shall be transported entirely at the user's risk. Any compensation for loss or damage shall be limited to the liability terms prescribed by the courier partner.</p>
        </Section>

        <Section n="9" title="Cash on Delivery (COD) Services">
          <p>For shipments booked with COD services:</p>
          <List items={[
            "Courier partners collect payment from the consignee on behalf of the user.",
            "COD amounts shall be remitted to the user as per courier partner settlement cycles.",
          ]} />
          <p>The Platform shall not be liable for delays or discrepancies in COD remittance caused by courier partners.</p>
        </Section>

        <Section n="10" title="Prohibited and Restricted Items">
          <p>Users shall not ship items prohibited under applicable laws including but not limited to:</p>
          <List items={[
            "Narcotic drugs.",
            "Explosives or weapons.",
            "Hazardous materials.",
            "Counterfeit goods.",
            "Wildlife products prohibited under law.",
          ]} />
          <p>If prohibited items are discovered, shipments may be refused or reported to authorities.</p>
        </Section>

        <Section n="11" title="Payment Terms">
          <p>Users agree to pay all charges associated with shipments including:</p>
          <List items={[
            "Courier charges.",
            "Platform fees.",
            "Taxes and surcharges.",
          ]} />
          <p>All payments must be made through approved payment methods on the Platform. The Company reserves the right to revise pricing from time to time.</p>
        </Section>

        <Section n="12" title="Chargeback and Payment Disputes">
          <p>Users shall not initiate chargebacks with banks or payment gateways without first attempting to resolve the dispute with the Platform. In case a chargeback is initiated:</p>
          <List items={[
            "The Platform reserves the right to suspend the user's account.",
            "The Platform may recover associated costs and penalties.",
          ]} />
          <p>Users shall cooperate in resolving payment disputes.</p>
        </Section>

        <Section n="13" title="Fraudulent Shipment & KYC Compliance">
          <p>The Platform may require users to complete Know Your Customer (KYC) verification before accessing certain services. Users shall not use the Platform for:</p>
          <List items={[
            "Fraudulent shipments.",
            "Misrepresentation of shipment contents.",
            "Illegal commercial activities.",
          ]} />
          <p>The Company reserves the right to:</p>
          <List items={[
            "Suspend accounts involved in suspicious activity.",
            "Report fraudulent conduct to law enforcement authorities.",
          ]} />
        </Section>

        <Section n="14" title="Courier Partner Responsibility">
          <p>All shipping services are provided by independent courier partners. The courier partner shall be solely responsible for:</p>
          <List items={[
            "Transportation.",
            "Shipment handling.",
            "Delivery performance.",
          ]} />
          <p>The Platform shall not be liable for service failures of courier partners.</p>
        </Section>

        <Section n="15" title="Limitation of Liability">
          <p>To the maximum extent permitted by law, the Company shall not be liable for:</p>
          <List items={[
            "Shipment loss or damage.",
            "Delivery delays.",
            "Business losses.",
            "Indirect or consequential damages.",
          ]} />
          <p>In any event, the Company's total liability shall not exceed the service fee charged by the Platform for the relevant shipment.</p>
        </Section>

        <Section n="16" title="Force Majeure">
          <p>The Company shall not be liable for delays or failure in service due to events beyond reasonable control including:</p>
          <List items={[
            "Natural disasters.",
            "Government restrictions.",
            "Strikes or labor disputes.",
            "War or civil unrest.",
            "Pandemics.",
          ]} />
          <p>During such events, service obligations may be suspended.</p>
        </Section>

        <Section n="17" title="Intellectual Property">
          <p>All intellectual property rights relating to the Platform including software, trademarks, logos, and content remain the exclusive property of the Company. Unauthorized use is prohibited.</p>
        </Section>

        <Section n="18" title="Termination">
          <p>The Company reserves the right to suspend or terminate user accounts in case of:</p>
          <List items={[
            "Breach of these Terms.",
            "Fraudulent activity.",
            "Misuse of the Platform.",
          ]} />
          <p>Termination may occur without prior notice.</p>
        </Section>

        <Section n="19" title="Indemnification">
          <p>Users agree to indemnify and hold harmless the Company and its directors, employees, and affiliates from any claims arising from:</p>
          <List items={[
            "Violation of these Terms.",
            "Shipment of prohibited goods.",
            "Disputes with courier partners.",
          ]} />
        </Section>

        <Section n="20" title="Modification of Terms">
          <p>The Company reserves the right to update these Terms at any time. Continued use of the Platform after modification shall constitute acceptance of revised Terms.</p>
        </Section>

        <Section n="21" title="Governing Law and Jurisdiction">
          <p>These Terms shall be governed by the laws of India. Any disputes arising out of these Terms shall be subject to the exclusive jurisdiction of the courts of Pune, Maharashtra.</p>
        </Section>

        <div className="mt-10 pt-6 border-t border-[#E2E8F0] text-[12px] text-[#5A6B80]">
          For questions about these Terms, contact us at <a href="mailto:support@viasetu.com" className="text-[#00A8A8] font-medium">support@viasetu.com</a>.
        </div>
      </article>
    </PublicSiteLayout>
  );
}
