import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import PublicSiteLayout from "@/components/site/PublicSiteLayout";
import { ArrowRight, CheckCircle2 } from "lucide-react";

const C = {
  bg: "#FFFFFF",
  bg2: "#F4F7FB",
  teal: "#00A8A8",
  text: "#0B1220",
  gray: "#5A6B80",
  border: "#E2E8F0",
};

export type ServiceSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  subsections?: { heading: string; body: string }[];
};

export type ServiceFaq = { q: string; a: string };

export type ServiceCTA = { label: string; to: string };

export type ServiceInternalLink = { label: string; to: string };

export type ServiceContent = {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  features: string[];
  metaDescription: string;
  metaTitle?: string;
  h1?: string;
  heroParagraphs?: string[];
  ctas?: ServiceCTA[];
  sections?: ServiceSection[];
  faqs?: ServiceFaq[];
  closingHeading?: string;
  closingParagraphs?: string[];
  internalLinks?: ServiceInternalLink[];
};

export const SERVICES: ServiceContent[] = [
  {
    slug: "parcel-tracking",
    title: "Parcel Tracking",
    tagline: "Track every shipment across every courier — in one place.",
    description:
      "ViaSetu unifies tracking from Delhivery, Xpressbees, Shadowfax, Shree Maruti and UrbaneBolt. Enter any AWB and we automatically detect the partner network and surface the latest status, location and ETA.",
    features: [
      "Universal AWB lookup across 5+ courier partners",
      "Live status updates with timestamped scans",
      "Predictive ETA adjusted for weather and holidays",
      "Works for shipments booked on ViaSetu or elsewhere",
    ],
    metaDescription:
      "Track any courier parcel by AWB number across Delhivery, Xpressbees, Shadowfax and more on ViaSetu.",
  },

  // ─────────────────────────────────────────────────────────────
  // BULK SHIPMENT
  // ─────────────────────────────────────────────────────────────
  {
    slug: "bulk-shipment",
    title: "Bulk Shipment Services",
    tagline: "Ship Hundreds of Orders Faster, Smarter, and More Cost-Effectively",
    description:
      "ViaSetu's Bulk Shipment Service helps businesses, eCommerce sellers, D2C brands, distributors, wholesalers, and warehouses manage multiple shipments through a single platform. Upload orders in bulk, compare courier rates instantly, schedule consolidated pickups, and track every shipment from one dashboard.",
    features: [
      "Bulk order upload and processing in a single workflow",
      "Instant courier rate comparison across partners",
      "Consolidated pickup scheduling for multiple parcels",
      "Centralised tracking dashboard for every shipment",
      "Invoice and reconciliation support in one place",
      "Scalable logistics built for growing shipment volumes",
    ],
    metaTitle: "Bulk Shipment Services in India | Bulk Courier & Logistics Solutions | ViaSetu",
    metaDescription:
      "Manage bulk shipments efficiently with ViaSetu. Compare courier rates, upload orders in bulk, schedule pickups, reduce shipping costs, and streamline logistics operations across India.",
    h1: "Bulk Shipment Services",
    heroParagraphs: [
      "Managing large volumes of shipments shouldn't slow down your business.",
      "ViaSetu's Bulk Shipment Service helps businesses, eCommerce sellers, D2C brands, distributors, wholesalers, and warehouses manage multiple shipments through a single platform. Upload orders in bulk, compare courier rates instantly, schedule consolidated pickups, and track every shipment from one dashboard.",
      "Whether you're shipping 50 orders a day or thousands each month, ViaSetu helps simplify logistics while reducing operational effort and shipping costs.",
    ],
    ctas: [
      { label: "Book Bulk Shipment", to: "/login" },
      { label: "Request a Demo", to: "/contact" },
    ],
    sections: [
      {
        heading: "What Is Bulk Shipment?",
        paragraphs: [
          "Bulk shipment refers to the process of shipping multiple parcels, packages, or orders together through a streamlined logistics workflow.",
          "Instead of booking each shipment individually, businesses can process large volumes of orders simultaneously using bulk shipping tools, automated workflows, and centralized courier management.",
          "Bulk shipment solutions are commonly used by eCommerce brands, online sellers, manufacturers, distributors, wholesalers, and businesses that regularly handle high shipping volumes.",
          "The primary goal of bulk shipping is to save time, reduce shipping costs, improve operational efficiency, and create a smoother delivery experience for customers.",
        ],
      },
      {
        heading: "How Bulk Shipment Works",
        paragraphs: [
          "Businesses handling multiple daily orders often face challenges such as manual booking, courier coordination, invoice management, and shipment tracking. ViaSetu simplifies this process.",
        ],
        subsections: [
          { heading: "Step 1: Upload Orders", body: "Upload multiple shipment orders through a single file or order management system." },
          { heading: "Step 2: Compare Courier Rates", body: "Instantly compare shipping rates and service options from multiple courier partners." },
          { heading: "Step 3: Select Best Shipping Option", body: "Choose the most suitable courier based on cost, speed, serviceability, or delivery requirements." },
          { heading: "Step 4: Schedule Pickup", body: "Arrange a consolidated pickup for multiple shipments at once." },
          { heading: "Step 5: Track Deliveries", body: "Monitor every shipment from dispatch to delivery through a centralized dashboard." },
        ],
      },
      {
        heading: "Who Needs Bulk Shipment Services?",
        subsections: [
          { heading: "D2C Brands", body: "Growing direct-to-consumer brands need efficient shipping systems to fulfill customer orders quickly and reliably." },
          { heading: "Ecommerce Sellers", body: "Marketplace sellers on platforms like Amazon, Flipkart, and their own online stores often process dozens or hundreds of shipments daily." },
          { heading: "Manufacturers", body: "Manufacturers regularly dispatch products to dealers, distributors, and retail partners across different regions." },
          { heading: "Distributors & Wholesalers", body: "Bulk logistics helps maintain supply chain efficiency while reducing shipping complexity." },
          { heading: "Warehouses & Fulfillment Centers", body: "Warehouse operations benefit from centralized shipment processing and courier management." },
          { heading: "Subscription-Based Businesses", body: "Brands delivering recurring orders can automate shipping workflows and improve delivery consistency." },
        ],
      },
      {
        heading: "Benefits of Bulk Shipment Management",
        paragraphs: ["Businesses that rely on manual shipping processes often encounter delays, errors, and operational inefficiencies. Bulk shipment solutions help solve these challenges."],
        bullets: [
          "Save operational time by processing multiple orders in a single workflow",
          "Reduce shipping costs by comparing courier partners for every order",
          "Improve delivery performance by matching couriers to destination and timeline",
          "Centralised shipment visibility from one platform",
          "Simplify logistics operations across bookings, pickups, tracking and invoices",
          "Scale shipping operations without significantly increasing overhead",
        ],
      },
      {
        heading: "What You Get With ViaSetu Bulk Shipment Services",
        bullets: [
          "Bulk order upload — process multiple orders simultaneously",
          "Courier rate comparison across supported partners before booking",
          "Consolidated pickup scheduling for multiple parcels and orders",
          "Centralised tracking dashboard for all shipments",
          "Shipping cost optimisation by pricing, speed and coverage",
          "Invoice and reconciliation support in one place",
          "Business-friendly logistics management built to scale",
        ],
      },
      {
        heading: "Common Bulk Shipping Challenges",
        subsections: [
          { heading: "Managing Multiple Courier Partners", body: "Different courier providers offer varying rates, service areas, and delivery speeds." },
          { heading: "High Shipping Costs", body: "Businesses often struggle to identify the most cost-effective shipping option for each order." },
          { heading: "Manual Shipment Processing", body: "Creating shipments individually consumes valuable operational time." },
          { heading: "Tracking Multiple Deliveries", body: "Monitoring hundreds of active shipments can become difficult without centralized visibility." },
          { heading: "Scaling Logistics Operations", body: "Growing order volumes require more efficient systems and workflows." },
        ],
      },
      {
        heading: "Bulk Shipment vs Individual Shipment",
        paragraphs: [
          "Many businesses start by creating shipments individually. While this works at lower volumes, it becomes inefficient as order counts increase.",
          "Bulk shipment solutions allow businesses to process multiple orders together, automate repetitive tasks, reduce manual errors, and improve shipping efficiency.",
          "For businesses shipping regularly, bulk logistics management often results in better operational performance and lower shipping costs compared to manual shipment creation.",
        ],
      },
      {
        heading: "Industries That Benefit From Bulk Shipping",
        bullets: [
          "Ecommerce Businesses",
          "D2C Brands",
          "Manufacturers",
          "Retail Chains",
          "Subscription Businesses",
          "Wholesalers",
          "Distributors",
          "Warehouses",
          "Fulfillment Centers",
          "B2B Companies",
        ],
      },
    ],
    faqs: [
      { q: "What is a bulk shipment service?", a: "Bulk shipment service allows businesses to process and manage multiple shipments simultaneously rather than creating individual shipment bookings." },
      { q: "Who can use bulk shipment services?", a: "Bulk shipment solutions are commonly used by eCommerce businesses, D2C brands, wholesalers, distributors, manufacturers, warehouses, and high-volume sellers." },
      { q: "How does bulk order upload work?", a: "Businesses can upload multiple shipment details through supported file formats or integrated systems, enabling faster shipment creation." },
      { q: "Can bulk shipping reduce logistics costs?", a: "Yes. Comparing multiple courier options and consolidating shipping operations often helps businesses optimise shipping expenses." },
      { q: "How many shipments can be processed at once?", a: "The number depends on business requirements and operational capacity, but bulk shipment systems are designed to handle large shipment volumes efficiently." },
      { q: "Can I track all bulk shipments from one dashboard?", a: "Yes. ViaSetu provides centralized shipment visibility, allowing businesses to monitor multiple deliveries from a single platform." },
      { q: "Is bulk shipping suitable for small businesses?", a: "Absolutely. Small and growing businesses can benefit from streamlined shipping workflows and reduced operational effort." },
    ],
    closingHeading: "Why Bulk Shipping Matters In Modern Commerce",
    closingParagraphs: [
      "Fast and reliable delivery has become an essential customer expectation. Businesses that manage shipping efficiently are often able to improve customer satisfaction, streamline operations, and scale more effectively.",
      "Bulk shipment solutions help businesses move beyond manual logistics processes and build a more efficient shipping infrastructure capable of supporting long-term growth.",
      "Whether you're managing daily orders, seasonal demand spikes, or large-scale distribution operations, a structured bulk shipping process can significantly improve logistics performance.",
    ],
    internalLinks: [
      { label: "Parcel Tracking", to: "/services/parcel-tracking" },
      { label: "Express Delivery", to: "/services/express-delivery" },
      { label: "Domestic Courier Service", to: "/services/domestic-courier-service" },
      { label: "SME Courier Service", to: "/services/sme-courier-service" },
      { label: "Homepage", to: "/" },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // EXPRESS DELIVERY
  // ─────────────────────────────────────────────────────────────
  {
    slug: "express-delivery",
    title: "Express Delivery Service",
    tagline: "Fast, Reliable Delivery When Time Matters Most",
    description:
      "Whether you're sending important business documents, customer orders, legal paperwork, medical supplies, gifts, or urgent packages, ViaSetu helps you find the fastest courier options available through a single platform. Compare same-day and next-day delivery services, choose the best courier partner for your timeline, and track every shipment until it reaches its destination.",
    features: [
      "Same-day shipping options for eligible locations",
      "Next-day delivery for urgent parcels",
      "Priority pickup and priority handling",
      "Real-time tracking end-to-end",
      "Compare ETAs across multiple courier partners",
      "Nationwide coverage across major cities",
    ],
    metaTitle: "Express Delivery Service in India | Same Day & Next Day Courier Delivery | ViaSetu",
    metaDescription:
      "Need urgent parcel delivery? Book same-day and next-day express delivery across India with ViaSetu. Compare courier partners, track shipments in real time, and deliver faster.",
    h1: "Express Delivery Service",
    heroParagraphs: [
      "Some shipments simply cannot wait.",
      "Whether you're sending important business documents, customer orders, legal paperwork, medical supplies, gifts, or urgent packages, ViaSetu helps you find the fastest courier options available through a single platform.",
      "Compare same-day and next-day delivery services, choose the best courier partner for your timeline, and track every shipment until it reaches its destination.",
      "When speed matters, ViaSetu helps you deliver with confidence.",
    ],
    ctas: [
      { label: "Book Express Delivery", to: "/login" },
      { label: "Get Instant Shipping Rates", to: "/booking" },
    ],
    sections: [
      {
        heading: "What Is Express Delivery?",
        paragraphs: [
          "Express delivery is a premium shipping service designed to transport parcels, documents, and packages faster than standard courier services.",
          "Unlike regular shipping, express courier services prioritize speed throughout the logistics process. Shipments are processed faster, moved through dedicated transportation networks, and delivered within shorter timelines.",
        ],
        bullets: [
          "Same-day delivery",
          "Next-day delivery",
          "Priority shipping",
          "Time-sensitive courier services",
          "Urgent parcel transportation",
        ],
      },
      {
        heading: "How Express Delivery Works",
        subsections: [
          { heading: "Step 1: Shipment Booking", body: "Book your parcel through ViaSetu and compare available express courier options." },
          { heading: "Step 2: Courier Selection", body: "Choose the fastest shipping service based on destination, delivery timeline, and cost." },
          { heading: "Step 3: Priority Processing", body: "The shipment receives priority handling throughout pickup, sorting, and transit." },
          { heading: "Step 4: Accelerated Transportation", body: "Parcels move through optimized air or surface transportation routes." },
          { heading: "Step 5: Final Delivery", body: "The shipment reaches the recipient within the selected delivery timeframe." },
        ],
      },
      {
        heading: "When Should You Use Express Delivery?",
        subsections: [
          { heading: "Time-Sensitive Business Documents", body: "Contracts, agreements, compliance paperwork, and financial documents often need rapid delivery." },
          { heading: "Ecommerce Orders", body: "Customers increasingly expect faster shipping and delivery experiences." },
          { heading: "Urgent Personal Deliveries", body: "Send important items to family members, friends, or colleagues without unnecessary delays." },
          { heading: "Medical & Healthcare Shipments", body: "Critical healthcare-related deliveries often require expedited transportation." },
          { heading: "Legal Documents", body: "Court filings, contracts, and legal notices frequently depend on strict deadlines." },
          { heading: "Corporate Logistics", body: "Businesses use express delivery to keep operations moving efficiently." },
        ],
      },
      {
        heading: "Benefits of Express Delivery Services",
        bullets: [
          "Faster delivery times and shorter transit periods",
          "Better customer experience and stronger trust",
          "Reduced business delays and operational disruptions",
          "Improved reliability through priority handling",
          "Real-time shipment visibility across every stage",
          "Flexible options — same-day, next-day, expedited",
        ],
      },
      {
        heading: "Same-Day Delivery vs Next-Day Delivery",
        subsections: [
          { heading: "Same-Day Delivery", body: "Ideal when a shipment must arrive within the same business day — urgent documents, medical deliveries, business-critical packages, last-minute shipments." },
          { heading: "Next-Day Delivery", body: "Fast shipping with broader service availability — ecommerce orders, business shipments, customer deliveries, high-priority parcels." },
        ],
        paragraphs: ["The right option depends on urgency, destination, and delivery expectations."],
      },
      {
        heading: "Why Businesses Choose Express Delivery",
        paragraphs: [
          "Modern customers expect speed. Research consistently shows that faster delivery options influence purchasing decisions and customer satisfaction.",
        ],
        bullets: [
          "Improve customer experience",
          "Reduce delivery complaints",
          "Meet critical deadlines",
          "Increase repeat purchases",
          "Gain competitive advantages",
          "Improve order fulfilment performance",
        ],
      },
      {
        heading: "Common Reasons Express Deliveries Are Needed",
        subsections: [
          { heading: "Missed Business Deadlines", body: "Urgent shipping helps prevent delays in important projects." },
          { heading: "Customer Expectations", body: "Fast delivery can improve customer satisfaction and retention." },
          { heading: "Last-Minute Requirements", body: "Unexpected situations often require immediate shipping solutions." },
          { heading: "Inventory Replenishment", body: "Businesses use expedited shipping to avoid stock shortages." },
          { heading: "Emergency Deliveries", body: "Critical shipments often require accelerated transportation." },
        ],
      },
      {
        heading: "Who Uses Express Delivery?",
        bullets: [
          "Ecommerce Brands",
          "D2C Companies",
          "Corporate Teams",
          "Legal Professionals",
          "Healthcare Providers",
          "Manufacturers",
          "Startups",
          "Small Businesses",
          "Marketplace Sellers",
          "Individual Customers",
        ],
      },
    ],
    faqs: [
      { q: "What is express delivery?", a: "Express delivery is a shipping service designed to deliver parcels faster than standard courier services." },
      { q: "How fast is express delivery?", a: "Delivery speed depends on location, courier partner, and service availability. Common options include same-day and next-day delivery." },
      { q: "Is express delivery available across India?", a: "Availability depends on courier service coverage and destination locations." },
      { q: "What can I send through express delivery?", a: "Documents, parcels, ecommerce orders, business shipments, gifts, and other eligible items can typically be shipped through express delivery services." },
      { q: "How do I track an express shipment?", a: "You can use the shipment tracking number or AWB number to monitor delivery progress in real time." },
      { q: "Is express delivery more expensive?", a: "Express services generally cost more than standard shipping because they prioritise faster transportation and handling." },
      { q: "Can businesses use express delivery regularly?", a: "Yes. Many businesses rely on express shipping for urgent customer orders and time-sensitive logistics operations." },
    ],
    closingHeading: "Why Fast Delivery Matters Today",
    closingParagraphs: [
      "Customer expectations around delivery speed have changed significantly over the last decade. Businesses are no longer competing solely on product quality or pricing. Delivery experience has become a major factor in customer satisfaction and brand loyalty.",
      "Fast, reliable shipping helps businesses meet customer expectations while enabling individuals to send important shipments without unnecessary delays.",
      "Whether you're delivering a contract across the city, shipping an urgent customer order, or sending a critical package to another state, express delivery ensures your shipment reaches its destination as quickly as possible.",
    ],
    internalLinks: [
      { label: "Parcel Tracking", to: "/services/parcel-tracking" },
      { label: "Bulk Shipment Services", to: "/services/bulk-shipment" },
      { label: "Domestic Courier Service", to: "/services/domestic-courier-service" },
      { label: "SME Courier Service", to: "/services/sme-courier-service" },
      { label: "Homepage", to: "/" },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // DOMESTIC COURIER SERVICE
  // ─────────────────────────────────────────────────────────────
  {
    slug: "domestic-courier-service",
    title: "Domestic Courier Service",
    tagline: "Send Parcels Anywhere in India with Confidence",
    description:
      "ViaSetu helps individuals and businesses compare courier options, book shipments online, schedule doorstep pickups, and track deliveries from one platform. From major metro cities to smaller towns and remote locations, our domestic courier network helps connect senders and recipients across India with reliable parcel delivery solutions.",
    features: [
      "Nationwide delivery across thousands of serviceable pin codes",
      "Multiple courier options with rate comparison",
      "Doorstep pickup from home, office or warehouse",
      "Real-time parcel tracking end-to-end",
      "One dashboard for bookings, tracking and support",
      "Reliable service for individuals and businesses",
    ],
    metaTitle: "Domestic Courier Service in India | Fast & Reliable Parcel Delivery | ViaSetu",
    metaDescription:
      "Send parcels anywhere in India with ViaSetu's domestic courier service. Compare courier rates, schedule pickups, track shipments, and access nationwide delivery coverage from a single platform.",
    h1: "Domestic Courier Service",
    heroParagraphs: [
      "Whether you're sending important documents, customer orders, business shipments, gifts, or personal packages, finding a reliable courier service shouldn't be complicated.",
      "ViaSetu helps individuals and businesses compare courier options, book shipments online, schedule doorstep pickups, and track deliveries from one platform.",
      "From major metro cities to smaller towns and remote locations, our domestic courier network helps connect senders and recipients across India with reliable parcel delivery solutions.",
    ],
    ctas: [
      { label: "Book a Courier", to: "/login" },
      { label: "Get Shipping Rates", to: "/booking" },
    ],
    sections: [
      {
        heading: "What Is a Domestic Courier Service?",
        paragraphs: [
          "A domestic courier service is a logistics solution that transports parcels, documents, packages, and shipments within a country's borders.",
          "In India, domestic courier services help individuals and businesses send items between cities, states, districts, and serviceable pin codes through organised transportation and delivery networks.",
        ],
        bullets: [
          "Faster delivery options",
          "Doorstep pickup services",
          "Real-time parcel tracking",
          "Delivery notifications",
          "Shipment visibility",
          "Flexible delivery solutions",
        ],
      },
      {
        heading: "How Domestic Courier Services Work",
        subsections: [
          { heading: "Step 1: Shipment Booking", body: "Book your parcel online and enter sender and receiver details." },
          { heading: "Step 2: Parcel Pickup", body: "A courier partner collects the shipment from the pickup location." },
          { heading: "Step 3: Sorting & Processing", body: "The parcel is routed through logistics hubs and sorting facilities." },
          { heading: "Step 4: Transportation", body: "The shipment travels through air, road, or surface courier networks." },
          { heading: "Step 5: Last-Mile Delivery", body: "The parcel reaches the destination city and is delivered to the recipient." },
        ],
      },
      {
        heading: "Why Domestic Courier Services Matter",
        paragraphs: [
          "India's growing economy relies heavily on efficient logistics and parcel transportation. Businesses depend on courier networks to deliver products to customers, while individuals use courier services for documents, gifts, personal belongings, and important packages.",
        ],
        bullets: [
          "Improve delivery speed for business and personal shipments",
          "Expand geographic reach across thousands of locations",
          "Simplify logistics through online booking and tracking",
          "Improve shipment visibility for customers",
          "Support business growth in more locations",
        ],
      },
      {
        heading: "Who Uses Domestic Courier Services?",
        subsections: [
          { heading: "Ecommerce Businesses", body: "Online stores rely on courier services to fulfil customer orders nationwide." },
          { heading: "Small Businesses", body: "Growing businesses use courier services to manage daily shipments and customer deliveries." },
          { heading: "D2C Brands", body: "Direct-to-consumer brands depend on reliable logistics to maintain customer satisfaction." },
          { heading: "Corporate Teams", body: "Companies regularly send documents, contracts, samples, and business materials." },
          { heading: "Students & Professionals", body: "Courier services help transport educational documents and personal items." },
          { heading: "Individual Customers", body: "Families and individuals use courier services to send parcels across India." },
        ],
      },
      {
        heading: "What You Get With ViaSetu Domestic Courier Services",
        bullets: [
          "Nationwide delivery coverage across thousands of pin codes",
          "Multiple courier options — compare pricing, speed and coverage",
          "Doorstep pickup without visiting a courier office",
          "Real-time parcel tracking from pickup to delivery",
          "Rate comparison before booking",
          "Simplified shipping experience from one platform",
        ],
      },
      {
        heading: "Types of Shipments You Can Send",
        subsections: [
          { heading: "Documents", body: "Contracts, certificates, legal papers, and business documents." },
          { heading: "Ecommerce Orders", body: "Customer purchases and product deliveries." },
          { heading: "Business Shipments", body: "Samples, inventory, promotional materials, and operational supplies." },
          { heading: "Personal Parcels", body: "Gifts, household items, and personal belongings." },
          { heading: "Educational Documents", body: "Applications, transcripts, certificates, and academic materials." },
          { heading: "Corporate Deliveries", body: "Business communications and office-related shipments." },
        ],
      },
      {
        heading: "Common Challenges in Domestic Shipping",
        subsections: [
          { heading: "Finding Reliable Courier Partners", body: "Different couriers offer varying levels of coverage and service quality." },
          { heading: "Comparing Shipping Costs", body: "Customers often struggle to identify the best shipping option." },
          { heading: "Tracking Multiple Shipments", body: "Managing several deliveries simultaneously can become difficult." },
          { heading: "Delivery Delays", body: "Weather, holidays, incorrect addresses, and operational constraints can affect delivery timelines." },
          { heading: "Limited Service Availability", body: "Not all courier providers serve every location." },
        ],
      },
      {
        heading: "Domestic Courier Service vs Traditional Postal Services",
        paragraphs: [
          "While both courier services and postal networks help transport parcels, courier services generally focus on speed, tracking visibility, and convenience.",
        ],
        bullets: [
          "Faster delivery timelines",
          "Doorstep pickup",
          "Online booking",
          "Real-time shipment tracking",
          "Delivery notifications",
        ],
      },
    ],
    faqs: [
      { q: "What is a domestic courier service?", a: "A domestic courier service transports parcels, documents, and shipments between locations within the same country." },
      { q: "How long does domestic parcel delivery take?", a: "Delivery timelines depend on the destination, courier partner, and shipping service selected." },
      { q: "Can I send parcels anywhere in India?", a: "Delivery coverage depends on serviceable locations and courier network availability." },
      { q: "How do I track my shipment?", a: "You can use your tracking number or AWB number to monitor shipment progress." },
      { q: "What items can be shipped through domestic courier services?", a: "Documents, parcels, ecommerce orders, gifts, business shipments, and personal packages can typically be shipped, subject to courier guidelines." },
      { q: "Is doorstep pickup available?", a: "Yes. Many courier partners offer pickup services directly from the sender's location." },
      { q: "Can businesses use domestic courier services regularly?", a: "Absolutely. Businesses frequently use domestic courier solutions for customer deliveries, inventory movement, and operational logistics." },
    ],
    closingHeading: "Why Reliable Domestic Shipping Is Important",
    closingParagraphs: [
      "As ecommerce, digital commerce, and interstate business continue to grow, reliable courier services have become more important than ever.",
      "Customers expect timely deliveries, shipment visibility, and hassle-free logistics experiences. Businesses require dependable courier partners to maintain customer satisfaction and operational efficiency.",
      "With ViaSetu, customers can simplify courier selection, compare rates, manage shipments, and track deliveries through a single platform designed to make shipping easier.",
    ],
    internalLinks: [
      { label: "Parcel Tracking", to: "/services/parcel-tracking" },
      { label: "Express Delivery", to: "/services/express-delivery" },
      { label: "Bulk Shipment Services", to: "/services/bulk-shipment" },
      { label: "SME Courier Service", to: "/services/sme-courier-service" },
      { label: "Homepage", to: "/" },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // INDIVIDUAL BUSINESS
  // ─────────────────────────────────────────────────────────────
  {
    slug: "individual-business",
    title: "Individual Business Shipping",
    tagline: "Built for Freelancers, Creators, Home Businesses & Solo Founders",
    description:
      "Whether you're selling handmade products, shipping customer orders, running an Instagram store, freelancing, or launching your first online business, ViaSetu makes shipping simple from day one. Book shipments when needed, compare courier rates instantly, schedule pickups, and track deliveries through a single platform.",
    features: [
      "Ship without complex enterprise requirements",
      "Flexible pay-as-you-ship model — no monthly minimums",
      "Courier rate comparison before every booking",
      "Doorstep pickup scheduling",
      "Centralised shipment tracking dashboard",
      "Nationwide delivery coverage",
    ],
    metaTitle: "Shipping Solutions for Individuals & Small Businesses | ViaSetu",
    metaDescription:
      "Start shipping without GST registration or a business account. ViaSetu helps freelancers, creators, Instagram sellers, home businesses, and solo founders ship parcels easily across India.",
    h1: "Individual Business Shipping",
    heroParagraphs: [
      "Starting a business is exciting. Managing shipping often isn't.",
      "Whether you're selling handmade products, shipping customer orders, running an Instagram store, freelancing, or launching your first online business, ViaSetu makes shipping simple from day one.",
      "You don't need large shipping volumes, enterprise contracts, or complicated logistics systems. Book shipments when needed, compare courier rates instantly, schedule pickups, and track deliveries through a single platform.",
      "Start small, ship confidently, and scale at your own pace.",
    ],
    ctas: [
      { label: "Start Shipping Today", to: "/login" },
      { label: "Compare Courier Rates", to: "/booking" },
    ],
    sections: [
      {
        heading: "What Is Individual Business Shipping?",
        paragraphs: [
          "Individual business shipping refers to logistics solutions designed specifically for freelancers, entrepreneurs, home businesses, creators, and small online sellers who need professional shipping services without enterprise-level requirements.",
          "Unlike large businesses that process hundreds of shipments daily, individual sellers often need flexibility, affordability, and simple tools that allow them to manage deliveries without operational complexity.",
          "Modern shipping platforms help independent businesses access courier services, parcel tracking, and delivery management that were once available only to larger organisations.",
        ],
      },
      {
        heading: "Who Is This Service For?",
        subsections: [
          { heading: "Freelancers", body: "Send contracts, project materials, prototypes, samples, and client documents." },
          { heading: "Instagram Sellers", body: "Ship products directly to customers without managing multiple courier accounts." },
          { heading: "Home-Based Businesses", body: "Deliver handmade products, personalised gifts, food items, fashion products, and specialty goods." },
          { heading: "Solo Founders", body: "Manage shipping operations without investing in expensive logistics infrastructure." },
          { heading: "Content Creators", body: "Send merchandise, promotional products, giveaways, and customer orders." },
          { heading: "Small Ecommerce Businesses", body: "Start shipping professionally before scaling into larger logistics operations." },
        ],
      },
      {
        heading: "Common Shipping Challenges For Small Businesses",
        subsections: [
          { heading: "Finding Reliable Courier Partners", body: "Choosing the right courier service can be confusing when multiple options exist." },
          { heading: "High Shipping Costs", body: "Small businesses often struggle to access competitive shipping rates." },
          { heading: "Lack of Logistics Experience", body: "Many entrepreneurs are shipping products for the first time." },
          { heading: "Managing Deliveries Manually", body: "Tracking orders through multiple courier websites consumes valuable time." },
          { heading: "Scaling Operations", body: "Shipping processes that work for ten orders may not work for one hundred." },
        ],
      },
      {
        heading: "How Individual Business Shipping Works",
        subsections: [
          { heading: "Step 1: Create Your Shipment", body: "Enter shipment details including sender, recipient, parcel size, and destination." },
          { heading: "Step 2: Compare Courier Options", body: "Review available courier services and shipping costs." },
          { heading: "Step 3: Select Your Preferred Courier", body: "Choose the service that best matches your budget and delivery timeline." },
          { heading: "Step 4: Schedule Pickup", body: "Arrange parcel collection directly from your location." },
          { heading: "Step 5: Track Delivery Progress", body: "Monitor shipment movement until successful delivery." },
        ],
      },
      {
        heading: "Why Small Businesses Need Professional Shipping",
        bullets: [
          "Build customer trust with reliable delivery",
          "Improve customer satisfaction with smooth shipping",
          "Support business growth as order volumes rise",
          "Reduce operational stress with automated workflows",
          "Create professional experiences for a stronger brand",
        ],
      },
      {
        heading: "What You Get With ViaSetu",
        bullets: [
          "Ship without complex requirements — no enterprise contracts",
          "Flexible pay-as-you-ship model",
          "Courier rate comparison before booking",
          "Doorstep pickup scheduling",
          "Shipment tracking from a centralised dashboard",
          "Nationwide delivery coverage",
          "Easy logistics management without specialised expertise",
        ],
      },
      {
        heading: "Shipping Solutions For Different Business Stages",
        subsections: [
          { heading: "Just Starting Out", body: "Ship occasional customer orders without long-term commitments." },
          { heading: "Growing Business", body: "Manage increasing shipment volumes while maintaining delivery quality." },
          { heading: "Expanding Brand", body: "Build repeatable shipping processes that support business growth." },
          { heading: "Scaling Operations", body: "Transition into more advanced logistics workflows as order volumes increase." },
        ],
      },
      {
        heading: "Individual Shipping vs Traditional Courier Booking",
        paragraphs: [
          "Many small businesses begin by visiting individual courier offices or managing shipments manually. While this works initially, it often becomes inefficient as orders increase.",
        ],
        bullets: [
          "Compare courier options faster",
          "Manage shipments more efficiently",
          "Access shipment tracking easily",
          "Simplify delivery management",
          "Improve operational consistency",
        ],
      },
    ],
    faqs: [
      { q: "Can I ship parcels without a GST number?", a: "Shipping requirements depend on shipment type and courier partner policies. Many individual users and small sellers can ship personal parcels and eligible products without needing a formal business setup." },
      { q: "Is this service suitable for first-time online sellers?", a: "Yes. The platform is designed to support individuals and small businesses starting their shipping journey." },
      { q: "Can freelancers use courier services for client deliveries?", a: "Absolutely. Freelancers frequently use shipping services to send contracts, samples, documents, and project materials." },
      { q: "Can I schedule pickups from home?", a: "Yes. Pickup availability depends on courier partner service coverage." },
      { q: "How can I track my shipments?", a: "You can track shipments using the assigned tracking number or AWB number." },
      { q: "Is this service only for ecommerce businesses?", a: "No. Freelancers, consultants, creators, professionals, and home businesses can also use shipping services." },
      { q: "Can I compare courier rates before booking?", a: "Yes. ViaSetu helps users evaluate courier options before selecting a shipping service." },
    ],
    closingHeading: "Why Small Businesses Need Better Logistics",
    closingParagraphs: [
      "The rise of digital commerce has created opportunities for thousands of entrepreneurs across India.",
      "Today, anyone can start a business through social media, marketplaces, personal websites, or direct customer relationships. However, success often depends on delivering products efficiently and consistently.",
      "Reliable shipping helps small businesses appear more professional, improve customer satisfaction, and compete effectively in increasingly competitive markets.",
      "ViaSetu helps bridge the gap between small businesses and professional shipping services, giving entrepreneurs the tools they need to serve customers with confidence.",
    ],
    internalLinks: [
      { label: "Parcel Tracking", to: "/services/parcel-tracking" },
      { label: "Domestic Courier Service", to: "/services/domestic-courier-service" },
      { label: "Express Delivery", to: "/services/express-delivery" },
      { label: "Bulk Shipment Services", to: "/services/bulk-shipment" },
      { label: "Homepage", to: "/" },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // PERSONAL BUSINESS
  // ─────────────────────────────────────────────────────────────
  {
    slug: "personal-business",
    title: "Personal Business Shipping",
    tagline: "Reliable Shipping for Home-Based Sellers and Growing Side Businesses",
    description:
      "Whether you're selling handmade products, custom gifts, fashion items, beauty products, artwork, baked goods, or products through Instagram and WhatsApp, ViaSetu helps simplify shipping from day one. Book shipments online, compare courier options, schedule doorstep pickups, and track deliveries without dealing with complicated logistics processes.",
    features: [
      "Doorstep pickup — ship directly from home",
      "Courier rate comparison before booking",
      "Nationwide delivery network",
      "Centralised shipment tracking",
      "Saved customer information for repeat orders",
      "Order management and delivery history",
    ],
    metaTitle: "Personal Business Shipping Solutions | Courier Services for Home Sellers | ViaSetu",
    metaDescription:
      "Ship products from home with ease. ViaSetu helps Instagram sellers, WhatsApp businesses, resellers, and home-based entrepreneurs manage deliveries, pickups, tracking, and shipping across India.",
    h1: "Personal Business Shipping",
    heroParagraphs: [
      "Turning a passion into a business is exciting, but managing deliveries can quickly become overwhelming.",
      "Whether you're selling handmade products, custom gifts, fashion items, beauty products, artwork, baked goods, or products through Instagram and WhatsApp, ViaSetu helps simplify shipping from day one.",
      "Book shipments online, compare courier options, schedule doorstep pickups, and track deliveries without dealing with complicated logistics processes.",
      "Focus on growing your business while ViaSetu helps you manage shipping more efficiently.",
    ],
    ctas: [
      { label: "Start Shipping Today", to: "/login" },
      { label: "Compare Courier Rates", to: "/booking" },
    ],
    sections: [
      {
        heading: "What Is Personal Business Shipping?",
        paragraphs: [
          "Personal business shipping is designed for individuals who sell products independently without operating a large ecommerce company.",
          "Many entrepreneurs start their journey from home, selling through social media platforms, personal networks, marketplaces, or small online stores. These businesses often need affordable and flexible shipping solutions that are easy to manage.",
          "Personal business shipping provides access to courier services, shipment tracking, pickup scheduling, and delivery management without requiring large shipping volumes or enterprise logistics systems.",
        ],
      },
      {
        heading: "Who Is This Service Designed For?",
        subsections: [
          { heading: "Instagram Sellers", body: "Ship customer orders directly from home without managing multiple courier accounts." },
          { heading: "WhatsApp Business Owners", body: "Deliver products efficiently while keeping customers updated on shipment status." },
          { heading: "Handmade Product Creators", body: "Send personalised products, crafts, artwork, and handmade goods across India." },
          { heading: "Resellers", body: "Manage customer deliveries while focusing on sales and customer relationships." },
          { heading: "Home Bakers", body: "Deliver packaged baked products and specialty items to customers." },
          { heading: "Hobby Entrepreneurs", body: "Turn side projects into businesses with reliable shipping support." },
        ],
      },
      {
        heading: "Common Challenges Home Sellers Face",
        subsections: [
          { heading: "Unsure Which Courier To Choose", body: "Different courier providers offer different prices, delivery speeds, and coverage areas." },
          { heading: "High Shipping Costs", body: "Small sellers often struggle to find affordable delivery solutions." },
          { heading: "Managing Customer Deliveries", body: "Keeping customers informed about order status can become difficult." },
          { heading: "Tracking Multiple Orders", body: "Using separate courier websites for each shipment wastes valuable time." },
          { heading: "Business Growth", body: "As order volumes increase, shipping processes need to become more organised." },
        ],
      },
      {
        heading: "How Personal Business Shipping Works",
        subsections: [
          { heading: "Step 1: Create Your Shipment", body: "Enter sender, recipient, and parcel details." },
          { heading: "Step 2: Compare Delivery Options", body: "Review available courier partners and shipping rates." },
          { heading: "Step 3: Select Your Preferred Service", body: "Choose the courier option that matches your budget and delivery requirements." },
          { heading: "Step 4: Schedule Pickup", body: "Arrange parcel collection directly from your home or workspace." },
          { heading: "Step 5: Track Delivery", body: "Monitor shipment progress until successful delivery." },
        ],
      },
      {
        heading: "Why Shipping Matters for Home Businesses",
        bullets: [
          "Build customer confidence with reliable shipping",
          "Improve customer experience with timely deliveries and visibility",
          "Reduce order-related questions through tracking updates",
          "Support business growth as order volumes increase",
          "Strengthen brand reputation with consistent delivery",
        ],
      },
      {
        heading: "What You Get With ViaSetu",
        bullets: [
          "Doorstep pickup — ship directly from home",
          "Courier rate comparison before booking",
          "Nationwide delivery network through multiple partners",
          "Shipment tracking from a centralised dashboard",
          "Saved customer information for repeat shipping",
          "Order management with delivery history",
          "Business-friendly shipping designed for small sellers",
        ],
      },
      {
        heading: "Best Products To Ship Using Personal Business Services",
        subsections: [
          { heading: "Handmade Products", body: "Crafts, art, custom gifts, and personalised products." },
          { heading: "Fashion & Accessories", body: "Clothing, jewellery, handbags, and lifestyle products." },
          { heading: "Beauty Products", body: "Cosmetics, skincare items, and wellness products." },
          { heading: "Home Decor", body: "Decorative products, handmade items, and customised goods." },
          { heading: "Small Electronics", body: "Accessories, gadgets, and technology products." },
          { heading: "Specialty Food Products", body: "Packaged food items that meet shipping guidelines." },
        ],
      },
      {
        heading: "Personal Business Shipping vs Traditional Courier Booking",
        paragraphs: [
          "Many home sellers initially visit courier offices for every shipment. While this works for occasional deliveries, it becomes difficult as order volumes increase.",
        ],
        bullets: [
          "Compare courier rates quickly",
          "Schedule pickups easily",
          "Manage deliveries efficiently",
          "Track orders from one dashboard",
          "Improve customer communication",
        ],
      },
    ],
    faqs: [
      { q: "Can I use this service if I sell products from home?", a: "Yes. This service is specifically designed for home-based businesses and independent sellers." },
      { q: "Do I need a large number of orders?", a: "No. You can ship products whether you handle occasional orders or regular daily sales." },
      { q: "Can Instagram sellers use ViaSetu?", a: "Yes. Many social commerce businesses use courier services to fulfil customer orders." },
      { q: "Is doorstep pickup available?", a: "Pickup availability depends on courier coverage in your area." },
      { q: "Can I track customer shipments?", a: "Yes. Shipment tracking helps you monitor deliveries and keep customers informed." },
      { q: "What products can I ship?", a: "Most standard business products can be shipped, subject to courier policies and restrictions." },
      { q: "Can I compare courier rates before booking?", a: "Yes. ViaSetu helps users evaluate shipping options before selecting a courier partner." },
    ],
    closingHeading: "Why Home Businesses Are Growing Across India",
    closingParagraphs: [
      "The rise of social commerce, digital payments, and online marketplaces has made it easier than ever to start a business from home.",
      "Today, entrepreneurs can build successful brands through Instagram, WhatsApp, marketplaces, and personal websites without investing in physical stores or large infrastructure.",
      "As these businesses grow, reliable logistics becomes one of the most important factors influencing customer satisfaction and repeat purchases.",
      "A dependable shipping solution allows home-based entrepreneurs to focus on sales, product quality, and customer relationships while ensuring deliveries reach customers smoothly. ViaSetu helps make that process easier by providing shipping tools designed for modern home businesses.",
    ],
    internalLinks: [
      { label: "Domestic Courier Service", to: "/services/domestic-courier-service" },
      { label: "Parcel Tracking", to: "/services/parcel-tracking" },
      { label: "Express Delivery", to: "/services/express-delivery" },
      { label: "Bulk Shipment Services", to: "/services/bulk-shipment" },
      { label: "Individual Business Shipping", to: "/services/individual-business" },
      { label: "Homepage", to: "/" },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // SME COURIER SERVICE
  // ─────────────────────────────────────────────────────────────
  {
    slug: "sme-courier-service",
    title: "SME Courier Service",
    tagline: "Smart Shipping Solutions for Growing Small and Medium Businesses",
    description:
      "ViaSetu helps small and medium enterprises manage business deliveries through a single platform. Compare courier partners, schedule pickups, track shipments, and simplify logistics while keeping shipping costs under control.",
    features: [
      "Multi-courier rate comparison in one dashboard",
      "Doorstep pickup from office or warehouse",
      "Centralised shipment management",
      "Real-time shipment tracking across partners",
      "Nationwide delivery coverage",
      "Flexible shipping options for speed, cost and coverage",
    ],
    metaTitle: "SME Courier Service in India | Business Shipping Solutions | ViaSetu",
    metaDescription:
      "Simplify business shipping with ViaSetu's SME courier services. Compare courier rates, schedule pickups, manage bulk orders, track shipments, and streamline logistics for small and medium businesses across India.",
    h1: "SME Courier Service",
    heroParagraphs: [
      "As your business grows, shipping becomes more than just moving parcels — it becomes a critical part of customer satisfaction and operational efficiency.",
      "ViaSetu helps small and medium enterprises manage business deliveries through a single platform. Compare courier partners, schedule pickups, track shipments, and simplify logistics while keeping shipping costs under control.",
      "Whether you ship a few orders a day or hundreds every week, ViaSetu provides flexible logistics solutions designed to grow with your business.",
    ],
    ctas: [
      { label: "Start Shipping Today", to: "/login" },
    ],
    sections: [
      {
        heading: "What Is an SME Courier Service?",
        paragraphs: [
          "An SME courier service is a logistics solution built for businesses that regularly ship products, documents, or commercial parcels across India.",
          "Unlike traditional courier booking, modern shipping platforms allow businesses to compare multiple courier partners, manage shipments from one dashboard, schedule pickups, and monitor deliveries in real time.",
          "For growing businesses, efficient logistics improves customer experience, supports expansion, and reduces the complexity of managing multiple courier providers.",
        ],
      },
      {
        heading: "Who Is This Service Designed For?",
        paragraphs: ["ViaSetu supports businesses across a wide range of industries."],
        subsections: [
          { heading: "Small and Medium Enterprises", body: "Manage daily shipping operations with greater efficiency." },
          { heading: "D2C Brands", body: "Deliver customer orders quickly while comparing courier options for better value." },
          { heading: "Manufacturers", body: "Ship finished goods, spare parts, samples, and commercial consignments across India." },
          { heading: "Wholesalers & Distributors", body: "Coordinate deliveries to retailers, dealers, and business partners." },
          { heading: "Ecommerce Businesses", body: "Handle increasing order volumes with streamlined shipping workflows." },
          { heading: "B2B Suppliers", body: "Ensure reliable parcel movement between warehouses, offices, and customers." },
        ],
      },
      {
        heading: "Common Logistics Challenges for SMEs",
        paragraphs: ["Growing businesses often encounter shipping challenges that affect productivity and customer satisfaction."],
        subsections: [
          { heading: "Rising Shipping Costs", body: "Managing courier expenses becomes difficult as shipment volumes increase." },
          { heading: "Multiple Courier Partners", body: "Working with different courier companies often creates fragmented processes." },
          { heading: "Limited Shipment Visibility", body: "Tracking parcels across multiple systems can consume valuable time." },
          { heading: "Manual Operations", body: "Handling bookings, labels, and tracking manually slows business operations." },
          { heading: "Scaling Logistics", body: "As order volumes grow, businesses require structured shipping processes that can keep pace." },
        ],
      },
      {
        heading: "How SME Shipping Works",
        subsections: [
          { heading: "Step 1: Create Your Shipment", body: "Enter shipment details, pickup location, destination, and parcel information." },
          { heading: "Step 2: Compare Courier Options", body: "Review shipping rates, delivery timelines, and available courier partners." },
          { heading: "Step 3: Choose the Best Service", body: "Select the courier that matches your business priorities for speed, cost, or coverage." },
          { heading: "Step 4: Schedule Pickup", body: "Arrange doorstep pickup from your office, warehouse, or business location." },
          { heading: "Step 5: Track Every Shipment", body: "Monitor deliveries through one dashboard until successful completion." },
        ],
      },
      {
        heading: "Why SMEs Need Modern Logistics Solutions",
        bullets: [
          "Improve operational efficiency — reduce time spent managing multiple couriers",
          "Lower shipping costs by comparing options before booking",
          "Deliver better customer experiences with reliable delivery",
          "Increase visibility with dispatch-to-delivery tracking",
          "Support business growth with a scalable logistics system",
        ],
      },
      {
        heading: "What You Get with ViaSetu",
        bullets: [
          "Multi-courier rate comparison in one place",
          "Doorstep pickup from your office or warehouse",
          "Centralised shipment management dashboard",
          "Real-time shipment tracking with live updates",
          "Nationwide delivery coverage across India",
          "Flexible shipping options by speed, budget, and shipment type",
          "Business-friendly logistics designed to support growing businesses",
        ],
      },
      {
        heading: "Industries We Support",
        bullets: [
          "Ecommerce & D2C Brands",
          "Manufacturing",
          "Wholesale Distribution",
          "Retail Businesses",
          "Industrial Suppliers",
          "Healthcare & Medical Supplies",
          "Fashion & Apparel",
          "Consumer Electronics",
          "FMCG Businesses",
          "Automotive Components",
        ],
      },
      {
        heading: "Why Choose ViaSetu for SME Shipping?",
        subsections: [
          { heading: "Built for Growing Businesses", body: "Designed to simplify shipping for companies expanding their operations." },
          { heading: "One Platform, Multiple Couriers", body: "Manage bookings and deliveries without switching between courier portals." },
          { heading: "Transparent Shipping Options", body: "Compare rates and choose services that fit your business needs." },
          { heading: "Easy to Scale", body: "Handle higher shipment volumes without increasing operational complexity." },
          { heading: "Reliable Delivery Experience", body: "Improve shipping efficiency while maintaining customer satisfaction." },
        ],
      },
      {
        heading: "SME Courier Service vs Traditional Courier Booking",
        paragraphs: [
          "Many businesses continue to manage shipping by contacting courier companies individually. While this may work for occasional shipments, growing businesses benefit from centralised logistics management.",
        ],
        bullets: [
          "Compare courier rates instantly",
          "Reduce manual processes",
          "Manage multiple shipments efficiently",
          "Improve delivery visibility",
          "Save operational time",
        ],
      },
    ],
    faqs: [
      { q: "What is an SME courier service?", a: "An SME courier service is designed to help small and medium businesses manage commercial shipments efficiently through modern logistics tools and courier networks." },
      { q: "Is this service suitable for growing businesses?", a: "Yes. It supports businesses handling regular shipments and looking for scalable logistics solutions." },
      { q: "Can I compare courier prices before booking?", a: "Yes. ViaSetu allows businesses to evaluate available courier options before selecting a shipping service." },
      { q: "Can businesses schedule doorstep pickups?", a: "Yes. Pickup availability depends on service coverage in your location." },
      { q: "Can I track business shipments?", a: "Yes. Shipment tracking provides visibility from dispatch to final delivery." },
      { q: "Does ViaSetu support businesses shipping across India?", a: "Yes. Businesses can ship to serviceable destinations across India using supported courier partners." },
      { q: "Can SMEs manage multiple shipments through one platform?", a: "Yes. ViaSetu helps businesses organise and manage shipments through a centralised dashboard." },
    ],
    closingHeading: "Helping SMEs Build Smarter Logistics",
    closingParagraphs: [
      "Small and medium enterprises are among the fastest-growing contributors to India's economy. As customer expectations continue to rise, businesses need logistics solutions that are reliable, scalable, and easy to manage.",
      "Efficient shipping is no longer just an operational task; it is an important part of delivering a positive customer experience, maintaining business relationships, and supporting long-term growth.",
      "ViaSetu helps SMEs simplify shipping by bringing courier comparison, booking, tracking, and shipment management together in one platform. Whether you're shipping locally or serving customers nationwide, our goal is to make logistics simpler, more transparent, and ready to scale with your business.",
    ],
    internalLinks: [
      { label: "Bulk Shipment", to: "/services/bulk-shipment" },
      { label: "Domestic Courier Service", to: "/services/domestic-courier-service" },
      { label: "Express Delivery", to: "/services/express-delivery" },
      { label: "Parcel Tracking", to: "/services/parcel-tracking" },
      { label: "Individual Business Shipping", to: "/services/individual-business" },
      { label: "Personal Business Shipping", to: "/services/personal-business" },
      { label: "Homepage", to: "/" },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // DOORSTEP PICKUP
  // ─────────────────────────────────────────────────────────────
  {
    slug: "doorstep-pickup",
    title: "Doorstep Pickup Service",
    tagline: "We Come to Your Door. You Stay Focused on Your Day.",
    description:
      "With ViaSetu, you can schedule a courier pickup directly from your home, office, warehouse, or shop. Choose a convenient pickup time, prepare your parcel, and our courier partner will collect it from your location.",
    features: [
      "Doorstep pickup from home, office, warehouse or shop",
      "Flexible pickup time slots",
      "Real-time tracking from collection to delivery",
      "Access to multiple trusted courier partners",
      "Nationwide serviceability across pincodes",
      "No courier office visits or queues",
    ],
    metaTitle: "Doorstep Pickup Service in India | Schedule Courier Pickup Online | ViaSetu",
    metaDescription:
      "Book a doorstep pickup for your parcel anywhere in India. Schedule courier pickup from your home or office, compare courier partners, and track your shipment with ViaSetu.",
    h1: "Doorstep Pickup Service",
    heroParagraphs: [
      "Need to send a parcel but don't have time to visit a courier office?",
      "With ViaSetu, you can schedule a courier pickup directly from your home, office, warehouse, or shop. Choose a convenient pickup time, prepare your parcel, and our courier partner will collect it from your location.",
      "No waiting in queues. No travelling across the city. Just a faster and easier way to ship.",
    ],
    ctas: [
      { label: "Book Pickup", to: "/login" },
      { label: "Check Pickup Availability", to: "/booking" },
    ],
    sections: [
      {
        heading: "Why People Prefer Doorstep Pickup",
        paragraphs: [
          "Modern shipping shouldn't require taking time off work or travelling to a courier centre.",
          "Whether you're sending a single parcel to a family member, dispatching daily customer orders, or shipping important business documents, doorstep pickup saves valuable time.",
          "Instead of adjusting your schedule around courier office timings, the pickup is scheduled around yours.",
        ],
      },
      {
        heading: "Pickup From Home or Office — The Choice Is Yours",
        paragraphs: [
          "Your parcel can be collected from almost anywhere. Whether you're working from home, running a business, managing a warehouse, or shipping from an office, you can schedule a pickup that fits your routine.",
        ],
        bullets: [
          "Online sellers",
          "Working professionals",
          "Small businesses",
          "Students",
          "Freelancers",
          "Manufacturers",
          "Families sending personal parcels",
        ],
      },
      {
        heading: "Here's How It Works",
        subsections: [
          { heading: "Book Your Shipment", body: "Enter your pickup and delivery details online." },
          { heading: "Choose a Pickup Time", body: "Select an available slot that suits your schedule." },
          { heading: "Pack Your Parcel", body: "Secure your shipment before the courier partner arrives." },
          { heading: "Courier Collection", body: "The pickup executive collects the parcel from your address." },
          { heading: "Track Every Movement", body: "Receive shipment tracking updates until delivery." },
        ],
      },
      {
        heading: "Why Doorstep Pickup Makes Shipping Easier",
        subsections: [
          { heading: "Save Valuable Time", body: "Avoid travelling to courier offices or waiting in long queues." },
          { heading: "Ship From Anywhere", body: "Book pickups from homes, offices, shops, or warehouses." },
          { heading: "Better Convenience", body: "Arrange shipping without interrupting your daily work." },
          { heading: "Real-Time Tracking", body: "Track your parcel from pickup until successful delivery." },
          { heading: "Reliable Courier Partners", body: "Access multiple trusted courier networks through one platform." },
          { heading: "Flexible Scheduling", body: "Book pickups according to your preferred time whenever available." },
        ],
      },
      {
        heading: "Perfect For Every Type of Shipment",
        paragraphs: ["Doorstep pickup isn't only for businesses. People use it every day for different reasons."],
        subsections: [
          { heading: "Personal Parcels", body: "Send gifts, clothes, books, documents, and household items." },
          { heading: "Business Orders", body: "Dispatch customer orders without leaving your workplace." },
          { heading: "Office Documents", body: "Send contracts, agreements, and important paperwork securely." },
          { heading: "Ecommerce Deliveries", body: "Schedule regular pickups for online store orders." },
          { heading: "Return Shipments", body: "Arrange hassle-free pickups for product returns and exchanges." },
        ],
      },
      {
        heading: "When Should You Use Doorstep Pickup?",
        bullets: [
          "You're shipping multiple parcels",
          "The parcel is heavy or bulky",
          "You don't have a nearby courier office",
          "You're managing customer orders daily",
          "You have a busy work schedule",
          "You want a faster shipping experience",
        ],
      },
      {
        heading: "What Makes ViaSetu Different?",
        paragraphs: [
          "Shipping should be simple — not confusing. Instead of contacting different courier companies separately, ViaSetu brings shipping services together on one platform.",
          "You can compare courier options, schedule pickups, book shipments, and track deliveries without switching between multiple websites.",
          "Whether you're sending one parcel or managing regular shipments, everything stays organised in one place.",
        ],
      },
    ],
    faqs: [
      { q: "Can I schedule a pickup from my home?", a: "Yes. If pickup service is available in your area, you can schedule parcel collection directly from your address." },
      { q: "Can I request pickup from my office?", a: "Yes. Courier pickups can usually be arranged from homes, offices, warehouses, or commercial locations." },
      { q: "Is doorstep pickup available across India?", a: "Pickup availability depends on the serviceability of your location and the courier partner selected." },
      { q: "Do I need to visit a courier office?", a: "No. Once your pickup is confirmed, the courier partner collects the parcel from your location." },
      { q: "Can I track my parcel after pickup?", a: "Yes. Tracking begins after the shipment is processed, allowing you to monitor its journey until delivery." },
      { q: "Can businesses schedule regular pickups?", a: "Yes. Businesses shipping frequently can use doorstep pickup to streamline daily dispatch operations." },
    ],
    closingHeading: "Shipping Should Start at Your Door",
    closingParagraphs: [
      "Sending a parcel shouldn't mean planning an extra trip across town.",
      "Doorstep pickup removes one of the biggest hassles in the shipping process by bringing the courier service to you. Whether you're sending a single package or dispatching orders every day, scheduling a pickup saves time and helps you focus on what matters most.",
      "ViaSetu connects you with trusted courier partners, making it easy to arrange pickups, compare shipping options, and keep track of every shipment from collection to delivery — all from one place.",
    ],
    internalLinks: [
      { label: "Parcel Tracking", to: "/services/parcel-tracking" },
      { label: "Domestic Courier Service", to: "/services/domestic-courier-service" },
      { label: "Express Delivery", to: "/services/express-delivery" },
      { label: "Bulk Shipment", to: "/services/bulk-shipment" },
      { label: "SME Courier Service", to: "/services/sme-courier-service" },
      { label: "Personal Business Shipping", to: "/services/personal-business" },
      { label: "Individual Business Shipping", to: "/services/individual-business" },
      { label: "Homepage", to: "/" },
    ],
  },
];

export default function ServicePage({ service }: { service: ServiceContent }) {
  const navigate = useNavigate();
  const related = SERVICES.filter((s) => s.slug !== service.slug).slice(0, 4);
  const isRich = !!(service.sections && service.sections.length > 0);
  const metaTitle = service.metaTitle || `${service.title} | ViaSetu`;

  const faqSchema = service.faqs && service.faqs.length > 0
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: service.faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      }
    : null;

  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.title,
    description: service.metaDescription,
    provider: { "@type": "Organization", name: "ViaSetu", url: "https://www.viasetu.com" },
    areaServed: { "@type": "Country", name: "India" },
    url: `https://www.viasetu.com/services/${service.slug}`,
  };

  return (
    <PublicSiteLayout>
      <Helmet>
        <title>{metaTitle}</title>
        <meta name="description" content={service.metaDescription} />
        <link rel="canonical" href={`https://www.viasetu.com/services/${service.slug}`} />
        <script type="application/ld+json">{JSON.stringify(serviceSchema)}</script>
        {faqSchema && <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>}
      </Helmet>

      <section className="px-6 py-16" style={{ background: C.bg2 }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-[12px] font-bold uppercase tracking-wider mb-3" style={{ color: C.teal }}>
            Our Services
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4" style={{ color: C.text }}>
            {service.h1 || service.title}
          </h1>
          <p className="text-lg md:text-xl font-semibold mb-4" style={{ color: C.teal }}>
            {service.tagline}
          </p>
          {service.heroParagraphs?.map((p, i) => (
            <p key={i} className="text-[15px] md:text-[16px] mb-3" style={{ color: C.gray }}>
              {p}
            </p>
          )) || <p className="text-[15px]" style={{ color: C.gray }}>{service.description}</p>}

          {service.ctas && service.ctas.length > 0 && (
            <div className="mt-6 flex gap-3 flex-wrap">
              {service.ctas.map((cta, i) => (
                <button
                  key={cta.label}
                  onClick={() => navigate(cta.to)}
                  className={`px-5 h-11 rounded-lg font-bold text-[14px] inline-flex items-center gap-2 ${i > 0 ? "border-2 bg-white" : ""}`}
                  style={i === 0 ? { background: C.teal, color: "#fff" } : { borderColor: C.teal, color: C.teal }}
                >
                  {cta.label} {i === 0 && <ArrowRight className="h-4 w-4" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {!isRich && (
        <section className="px-6 py-14">
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-10">
            <div>
              <h2 className="text-2xl font-bold mb-4" style={{ color: C.text }}>About this service</h2>
              <p className="text-[15px] leading-relaxed" style={{ color: C.gray }}>{service.description}</p>
              {!service.ctas && (
                <div className="mt-6 flex gap-3 flex-wrap">
                  <button onClick={() => navigate("/login")} className="px-5 h-11 rounded-lg font-bold text-[14px] inline-flex items-center gap-2" style={{ background: C.teal, color: "#fff" }}>
                    Book Now <ArrowRight className="h-4 w-4" />
                  </button>
                  <button onClick={() => navigate("/tracking")} className="px-5 h-11 rounded-lg font-semibold text-[14px] border-2" style={{ borderColor: C.teal, color: C.teal }}>
                    Track a Parcel
                  </button>
                </div>
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-4" style={{ color: C.text }}>What you get</h2>
              <ul className="space-y-3">
                {service.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-[14px]" style={{ color: C.text }}>
                    <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" style={{ color: C.teal }} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {isRich && service.features.length > 0 && (
        <section className="px-6 py-12">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold mb-6" style={{ color: C.text }}>What you get</h2>
            <ul className="grid sm:grid-cols-2 gap-3">
              {service.features.map((f) => (
                <li key={f} className="flex items-start gap-3 text-[14px] p-3 rounded-lg border bg-white" style={{ color: C.text, borderColor: C.border }}>
                  <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" style={{ color: C.teal }} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {service.sections && service.sections.length > 0 && (
        <section className="px-6 py-14" style={{ background: C.bg2, borderTop: `1px solid ${C.border}` }}>
          <div className="max-w-5xl mx-auto space-y-12">
            {service.sections.map((s) => (
              <div key={s.heading}>
                <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: C.text }}>{s.heading}</h2>
                {s.paragraphs?.map((p, i) => (
                  <p key={i} className="text-[15px] mb-3" style={{ color: C.gray }}>{p}</p>
                ))}
                {s.bullets && (
                  <ul className="mt-3 grid sm:grid-cols-2 gap-2">
                    {s.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-[14px]" style={{ color: C.text }}>
                        <CheckCircle2 className="h-4 w-4 shrink-0 mt-1" style={{ color: C.teal }} />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {s.subsections && (
                  <div className="grid md:grid-cols-2 gap-4 mt-4">
                    {s.subsections.map((sub) => (
                      <div key={sub.heading} className="p-4 rounded-xl border bg-white" style={{ borderColor: C.border }}>
                        <div className="font-bold text-[15px] mb-1" style={{ color: C.text }}>{sub.heading}</div>
                        <div className="text-[14px]" style={{ color: C.gray }}>{sub.body}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {service.faqs && service.faqs.length > 0 && (
        <section className="px-6 py-14">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold mb-6" style={{ color: C.text }}>Frequently Asked Questions</h2>
            <div className="space-y-4">
              {service.faqs.map((f) => (
                <div key={f.q} className="p-5 rounded-xl border bg-white" style={{ borderColor: C.border }}>
                  <div className="font-bold text-[15px] mb-2" style={{ color: C.text }}>{f.q}</div>
                  <div className="text-[14px]" style={{ color: C.gray }}>{f.a}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {service.closingHeading && (
        <section className="px-6 py-14" style={{ background: C.bg2, borderTop: `1px solid ${C.border}` }}>
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: C.text }}>{service.closingHeading}</h2>
            {service.closingParagraphs?.map((p, i) => (
              <p key={i} className="text-[15px] mb-3" style={{ color: C.gray }}>{p}</p>
            ))}
            <div className="mt-6">
              <button onClick={() => navigate("/login")} className="px-6 h-12 rounded-lg font-bold text-[14px] inline-flex items-center gap-2" style={{ background: C.teal, color: "#fff" }}>
                Get Started <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      )}

      {service.internalLinks && service.internalLinks.length > 0 && (
        <section className="px-6 py-12" style={{ borderTop: `1px solid ${C.border}` }}>
          <div className="max-w-5xl mx-auto">
            <h2 className="text-xl md:text-2xl font-bold mb-4" style={{ color: C.text }}>Related resources</h2>
            <div className="flex flex-wrap gap-3">
              {service.internalLinks.map((l) => (
                <Link key={l.to} to={l.to} className="px-4 py-2 rounded-full border bg-white text-[13px] hover:border-[#00A8A8] transition-colors" style={{ borderColor: C.border, color: C.text }}>
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="px-6 py-14" style={{ background: C.bg2, borderTop: `1px solid ${C.border}` }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold mb-6" style={{ color: C.text }}>Explore other services</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            {related.map((r) => (
              <Link key={r.slug} to={`/services/${r.slug}`} className="block p-4 rounded-xl border bg-white hover:border-[#00A8A8] transition-colors" style={{ borderColor: C.border }}>
                <div className="font-bold text-[14px] mb-1" style={{ color: C.text }}>{r.title}</div>
                <div className="text-[12px]" style={{ color: C.gray }}>{r.tagline}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </PublicSiteLayout>
  );
}
