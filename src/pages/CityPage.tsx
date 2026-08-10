import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import PublicSiteLayout from "@/components/site/PublicSiteLayout";
import { ArrowRight, MapPin, CheckCircle2 } from "lucide-react";

const C = {
  bg: "#FFFFFF",
  bg2: "#F4F7FB",
  teal: "#00A8A8",
  text: "#0B1220",
  gray: "#5A6B80",
  border: "#E2E8F0",
};

export type CitySection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type CityFaq = { q: string; a: string };

export type CityContent = {
  slug: string;
  city: string;
  intro: string;
  hubs: string[];
  highlights: string[];
  metaTitle?: string;
  metaDescription: string;
  h1?: string;
  tagline?: string;
  sections?: CitySection[];
  faqs?: CityFaq[];
  closingHeading?: string;
  closingParagraphs?: string[];
};

export const CITIES: CityContent[] = [
  {
    slug: "mumbai",
    city: "Mumbai",
    intro:
      "Mumbai moves fast, and your deliveries should too. Whether you're sending important documents from Nariman Point, dispatching online orders from Andheri, or shipping business parcels from Navi Mumbai, ViaSetu helps you compare courier services, schedule doorstep pickups, and track shipments through one simple platform. From individual parcels to regular business deliveries, shipping across Mumbai becomes faster, easier, and more organised.",
    hubs: [
      "Andheri",
      "Bandra",
      "Powai",
      "Borivali",
      "Dadar",
      "Goregaon",
      "Malad",
      "Kandivali",
      "Navi Mumbai",
      "Thane",
      "Lower Parel",
      "Kurla",
    ],
    highlights: [
      "Compare courier rates from multiple partners before booking",
      "Doorstep pickup from home, office or warehouse",
      "Track every shipment until successful delivery",
      "Ship from Mumbai to destinations across India",
    ],
    metaTitle: "Courier Service in Mumbai | Doorstep Pickup & Parcel Delivery | ViaSetu",
    metaDescription:
      "Book reliable courier services in Mumbai with ViaSetu. Compare courier partners, schedule doorstep pickups, track shipments, and send parcels across Mumbai and throughout India.",
    h1: "Courier Service in Mumbai",
    tagline: "Fast, Reliable Courier Services Across Mumbai",
    sections: [
      {
        heading: "Shipping in Mumbai Doesn't Have to Be Complicated",
        paragraphs: [
          "Anyone who has shipped a parcel in Mumbai knows the challenges.",
        ],
        bullets: [
          "Traffic can delay pickups.",
          "Courier offices may be far away.",
          "Comparing different courier companies takes time.",
          "Tracking multiple shipments often means visiting several websites.",
        ],
      },
      {
        heading: "One Platform for Booking, Pickup, Rates & Tracking",
        paragraphs: [
          "ViaSetu simplifies the entire process by bringing courier booking, pickup scheduling, rate comparison, and shipment tracking together in one place. Whether you're shipping across the city or anywhere in India, you can manage everything from a single dashboard.",
        ],
      },
      {
        heading: "Built for the Way Mumbai Ships",
        paragraphs: [
          "Every city has different shipping requirements. Mumbai businesses often dispatch hundreds of customer orders daily, while professionals send important documents and families regularly ship parcels to relatives across the country.",
          "ViaSetu supports all kinds of shipping needs, including:",
        ],
        bullets: [
          "Personal parcels",
          "Business deliveries",
          "Ecommerce shipments",
          "Office documents",
          "Bulk dispatches",
          "Time-sensitive deliveries",
        ],
      },
      {
        heading: "Why Businesses in Mumbai Choose ViaSetu",
        paragraphs: [
          "Mumbai businesses operate in one of India's busiest commercial environments. Reliable logistics can directly influence customer satisfaction and repeat business. ViaSetu helps businesses compare courier rates, schedule doorstep pickups, track every shipment, reach customers nationwide, and manage shipping efficiently — all from a single dashboard.",
        ],
      },
      {
        heading: "Frequently Sent Parcels From Mumbai",
        paragraphs: ["Customers regularly use courier services to ship:"],
        bullets: [
          "Business documents",
          "Legal paperwork",
          "Ecommerce orders",
          "Fashion products",
          "Electronics",
          "Healthcare supplies",
          "Gifts",
          "Household items",
          "Books",
          "Industrial samples",
        ],
      },
      {
        heading: "Looking for a Courier Service Near You?",
        paragraphs: [
          "Whether you're working from an office in BKC, managing a warehouse in Navi Mumbai, or running an online business from Andheri, finding a reliable courier service shouldn't be difficult.",
          "ViaSetu allows you to compare courier partners, schedule parcel pickups, and manage deliveries without visiting multiple courier offices. Everything starts with a few simple steps online.",
        ],
      },
    ],
    faqs: [
      {
        q: "Can I book a courier pickup from my home in Mumbai?",
        a: "Yes. Pickup availability depends on your location and the courier partner selected.",
      },
      {
        q: "Which areas of Mumbai are covered?",
        a: "Many major residential, commercial, and industrial areas are serviceable, subject to courier coverage.",
      },
      {
        q: "Can I send parcels outside Mumbai?",
        a: "Yes. Shipments can be booked from Mumbai to destinations across India.",
      },
      {
        q: "How do I track my courier?",
        a: "After booking, you'll receive tracking details to monitor shipment progress.",
      },
      {
        q: "Is this service suitable for businesses?",
        a: "Yes. ViaSetu supports individuals, online sellers, startups, SMEs, and larger businesses.",
      },
    ],
    closingHeading: "Why Mumbai Businesses Need Smarter Shipping",
    closingParagraphs: [
      "Mumbai is one of India's busiest commercial centres, where speed and reliability are essential. Whether you're delivering customer orders, sending business documents, or managing daily dispatches, every shipment reflects your commitment to your customers.",
      "ViaSetu simplifies shipping by connecting multiple courier partners through a single platform, helping individuals and businesses save time while keeping deliveries organised from pickup to final destination.",
    ],
  },
  {
    slug: "pune",
    city: "Pune",
    intro:
      "Whether you're shipping from Hinjawadi, Hadapsar, Kharadi, Baner, or anywhere across Pune, ViaSetu helps you book trusted courier services through one convenient platform. Compare shipping options, arrange doorstep pickup, and track your parcel from dispatch to delivery all without visiting multiple courier offices. Whether it's a single document or daily business shipments, sending parcels from Pune becomes quicker, easier, and more reliable.",
    hubs: [
      "Hinjawadi",
      "Baner",
      "Wakad",
      "Kharadi",
      "Hadapsar",
      "Kothrud",
      "Viman Nagar",
      "Pimpri",
      "Chinchwad",
      "Aundh",
      "Magarpatta",
      "Bavdhan",
    ],
    highlights: [
      "Compare multiple courier options before confirming your shipment",
      "Convenient doorstep pickup from home, office, warehouse or store",
      "Live shipment tracking with real-time updates after booking",
      "Nationwide delivery network from Pune to across India",
    ],
    metaTitle: "Courier Service in Pune | Fast Parcel Delivery & Doorstep Pickup | ViaSetu",
    metaDescription:
      "Looking for a reliable courier service in Pune? Compare courier partners, schedule doorstep parcel pickup, track shipments, and send packages anywhere in India with ViaSetu.",
    h1: "Courier Service in Pune",
    tagline: "Send Parcels Across Pune and India Without the Usual Hassle",
    sections: [
      {
        heading: "Smart Shipping for a City That Never Stops Building",
        paragraphs: [
          "Pune has become one of India's fastest-growing business and technology hubs. Thousands of startups, manufacturers, online sellers, students, and professionals send parcels every day.",
          "Instead of spending time comparing different courier companies, ViaSetu lets you manage your shipment from one place. Choose the courier that fits your delivery timeline and budget while staying updated with real-time tracking throughout the journey.",
        ],
      },
      {
        heading: "Designed for Individuals, Businesses and Growing Brands",
        paragraphs: ["Shipping needs vary across Pune."],
        bullets: [
          "A student may need to send important documents home.",
          "An online seller may dispatch dozens of customer orders each week.",
          "A manufacturer may require dependable logistics for regular deliveries.",
        ],
      },
      {
        heading: "Areas in Pune Where Doorstep Pickup Is Commonly Available",
        paragraphs: [
          "Courier pickup is available across many residential, commercial and industrial neighbourhoods, depending on courier partner coverage.",
          "Coverage may vary by PIN code and courier partner availability.",
        ],
      },
      {
        heading: "Why Customers Prefer ViaSetu for Courier Services in Pune",
        bullets: [
          "Compare multiple courier options before confirming your shipment",
          "Convenient doorstep pickup from home, office, warehouse or store",
          "Live shipment tracking with real-time updates",
          "Nationwide delivery network across India",
          "One platform for every shipment — bookings, tracking and history",
        ],
      },
      {
        heading: "Frequently Shipped Items from Pune",
        paragraphs: ["Customers regularly send:"],
        bullets: [
          "Business documents",
          "Ecommerce orders",
          "Electronic accessories",
          "Automotive spare parts",
          "Fashion products",
          "Educational certificates",
          "Books and study material",
          "Gifts and personal parcels",
          "Product samples",
          "Office supplies",
        ],
      },
      {
        heading: "Looking for a Reliable Courier Partner in Pune?",
        paragraphs: [
          "Whether you're running a startup in Hinjawadi, managing an online store from Kharadi, operating a manufacturing unit in Pimpri-Chinchwad, or simply sending a parcel to family, ViaSetu makes shipping straightforward.",
          "Book your courier online, compare trusted delivery partners, schedule pickup at your convenience, and track every shipment from one dashboard.",
        ],
      },
    ],
    faqs: [
      {
        q: "Can I schedule a doorstep courier pickup in Pune?",
        a: "Yes. Doorstep pickup is available across many serviceable locations depending on the courier partner and PIN code.",
      },
      {
        q: "Does ViaSetu support business shipping in Pune?",
        a: "Yes. The platform is suitable for startups, SMEs, manufacturers, ecommerce sellers and individual customers.",
      },
      {
        q: "Can I send parcels from Pune to other states?",
        a: "Absolutely. Shipments can be booked from Pune to destinations throughout India.",
      },
      {
        q: "How can I track my courier?",
        a: "You'll receive shipment tracking details after booking, allowing you to follow your parcel until delivery.",
      },
      {
        q: "Which areas in Pune are commonly covered?",
        a: "Many residential, commercial and industrial areas across Pune and PCMC are serviceable, subject to courier partner coverage.",
      },
    ],
    closingHeading: "Why Pune Businesses Trust Efficient Logistics",
    closingParagraphs: [
      "From technology parks and industrial zones to educational campuses and growing ecommerce businesses, Pune depends on reliable logistics every day. Fast pickups, transparent tracking and flexible courier options help businesses maintain customer satisfaction while simplifying daily shipping operations.",
      "ViaSetu connects multiple courier partners on a single platform, making parcel delivery easier for professionals, startups, retailers and individuals across Pune.",
    ],
  },
  {
    slug: "bangalore",
    city: "Bangalore",
    intro:
      "From Whitefield's technology parks to Koramangala's startup community and Electronic City's business hubs, Bangalore depends on fast and dependable logistics every day. ViaSetu helps individuals, online sellers, and businesses compare courier services, arrange doorstep parcel pickup, and track deliveries through one simple platform. Whether you're shipping a single parcel or managing daily customer orders, everything can be booked online in just a few minutes.",
    hubs: [
      "Whitefield",
      "Koramangala",
      "Electronic City",
      "Indiranagar",
      "HSR Layout",
      "Jayanagar",
      "Marathahalli",
      "Bellandur",
      "Yelahanka",
      "Rajajinagar",
      "Hebbal",
      "Banashankari",
    ],
    highlights: [
      "Compare courier rates from multiple partners in one place",
      "Convenient doorstep pickup from home, office, warehouse or store",
      "Real-time shipment visibility from dispatch to delivery",
      "Nationwide shipping coverage from Bangalore to across India",
    ],
    metaTitle: "Courier Service in Bangalore | Fast Parcel Delivery & Doorstep Pickup | ViaSetu",
    metaDescription:
      "Book trusted courier services in Bangalore with ViaSetu. Compare courier partners, schedule doorstep pickup, track parcels, and send shipments across Bangalore and anywhere in India.",
    h1: "Courier Service in Bangalore",
    tagline: "Reliable Courier Solutions for Bangalore's Growing Businesses and Everyday Deliveries",
    sections: [
      {
        heading: "Built for the City's Fast-Moving Economy",
        paragraphs: [
          "Bangalore has become one of India's busiest centres for technology companies, D2C brands, ecommerce businesses and entrepreneurs. Reliable shipping is essential when customers expect quick deliveries and transparent tracking.",
          "ViaSetu removes the complexity of dealing with multiple courier providers by bringing booking, shipment management and tracking together in one place. You choose the delivery option that works for your timeline while we simplify the entire shipping experience.",
        ],
      },
      {
        heading: "Shipping That Works for Every Kind of Customer",
        paragraphs: ["Every shipment has a different purpose."],
        bullets: [
          "A startup may need to dispatch customer orders every day.",
          "An IT professional may need to send confidential documents.",
          "A student may be shipping books and personal belongings.",
          "A home business may require affordable courier options without long-term commitments.",
        ],
      },
      {
        heading: "Major Pickup Locations Across Bangalore",
        paragraphs: [
          "Doorstep parcel pickup is available in many residential, commercial and business districts across Bangalore, depending on courier partner serviceability.",
          "Pickup availability may vary based on PIN code and courier partner coverage.",
        ],
      },
      {
        heading: "Why Bangalore Customers Choose ViaSetu",
        bullets: [
          "Compare courier rates from multiple partners before booking",
          "Convenient doorstep collection from home, office or store",
          "Real-time shipment visibility with regular updates",
          "Nationwide shipping coverage across India",
          "Manage business and personal deliveries from one dashboard",
        ],
      },
      {
        heading: "Common Shipments Sent from Bangalore",
        paragraphs: ["Customers frequently book courier services for:"],
        bullets: [
          "Ecommerce orders",
          "Software and business documents",
          "Electronic gadgets and accessories",
          "Apparel and fashion products",
          "Startup product samples",
          "Books and educational material",
          "Gifts and personal parcels",
          "Office supplies",
          "Healthcare products",
          "Small business inventory",
        ],
      },
      {
        heading: "A Better Way to Send Parcels in Bangalore",
        paragraphs: [
          "Whether you're running a D2C brand from HSR Layout, working from a tech campus in Whitefield, operating an online store in Koramangala, or simply sending a parcel to family, ViaSetu gives you one place to compare courier services, schedule pickups and monitor every shipment with confidence.",
          "No unnecessary paperwork. No visiting multiple courier offices. Just a smoother way to ship.",
        ],
      },
    ],
    faqs: [
      { q: "Can I book a courier pickup from my home or office in Bangalore?", a: "Yes. Doorstep pickup is available across many serviceable locations, depending on courier partner availability." },
      { q: "Is ViaSetu suitable for ecommerce businesses in Bangalore?", a: "Yes. Many online sellers, startups and growing businesses use the platform to simplify parcel bookings and shipment management." },
      { q: "Can I send parcels from Bangalore to other Indian cities?", a: "Absolutely. Shipments can be booked from Bangalore to destinations across India." },
      { q: "How do I track my shipment?", a: "Once your booking is confirmed, you'll receive tracking information that allows you to monitor the parcel until delivery." },
      { q: "Which Bangalore locations are commonly covered?", a: "Many major residential, commercial and technology hubs are serviceable, subject to courier partner coverage and PIN code availability." },
    ],
    closingHeading: "Shipping That Supports Bangalore's Innovation",
    closingParagraphs: [
      "Bangalore is home to thousands of startups, technology companies, online brands and independent entrepreneurs. As businesses grow, dependable logistics become just as important as great products and customer service.",
      "ViaSetu simplifies courier booking by bringing multiple delivery partners onto one platform, helping businesses and individuals move parcels efficiently without the complexity of managing different courier providers.",
    ],
  },
  {
    slug: "hyderabad",
    city: "Hyderabad",
    intro:
      "From Hitech City and Gachibowli to Secunderabad and LB Nagar, thousands of parcels move across Hyderabad every day. ViaSetu helps you send documents, customer orders, business shipments, and personal packages without the hassle of visiting multiple courier offices. Compare courier options, arrange a doorstep pickup, and keep track of your shipment from dispatch to delivery all through one platform.",
    hubs: [
      "Hitech City",
      "Gachibowli",
      "Madhapur",
      "Kondapur",
      "Banjara Hills",
      "Jubilee Hills",
      "Kukatpally",
      "Secunderabad",
      "Uppal",
      "Miyapur",
      "LB Nagar",
      "Begumpet",
    ],
    highlights: [
      "Compare trusted courier partners based on speed and cost",
      "Doorstep parcel collection from home, office or warehouse",
      "Stay updated with real-time shipment tracking",
      "Deliver from Hyderabad to destinations across India",
    ],
    metaTitle: "Courier Service in Hyderabad | Fast Parcel Delivery & Doorstep Pickup | ViaSetu",
    metaDescription:
      "Need a reliable courier service in Hyderabad? Book doorstep parcel pickup, compare courier partners, track shipments, and send parcels anywhere in India with ViaSetu.",
    h1: "Courier Service in Hyderabad",
    tagline: "Reliable Parcel Delivery Across Hyderabad for Homes, Businesses and Online Sellers",
    sections: [
      {
        heading: "Shipping Solutions That Keep Hyderabad Moving",
        paragraphs: [
          "Hyderabad is home to a fast-growing mix of technology companies, pharmaceutical businesses, manufacturers, retailers and entrepreneurs. Whether you're fulfilling online orders or sending an urgent business document, dependable logistics make all the difference.",
          "ViaSetu simplifies the process by bringing trusted courier partners together in one place. Instead of contacting different courier companies, you can compare services, book a shipment, and monitor its progress with ease.",
        ],
      },
      {
        heading: "Flexible Courier Services for Every Shipping Requirement",
        paragraphs: ["Not every parcel is the same, and neither is every customer."],
        bullets: [
          "Some people need to send important paperwork across the city.",
          "Businesses dispatch customer orders every day.",
          "Students ship books and personal belongings.",
          "Retailers move products to customers across India.",
        ],
      },
      {
        heading: "Popular Pickup Locations Across Hyderabad",
        paragraphs: [
          "Doorstep courier pickup is available across many residential, commercial and business areas, subject to courier partner serviceability.",
          "Coverage depends on the selected courier partner and serviceable PIN codes.",
        ],
      },
      {
        heading: "Why Hyderabad Customers Choose ViaSetu",
        bullets: [
          "Compare trusted courier partners by delivery speed and cost",
          "Doorstep parcel collection from home, office or warehouse",
          "Stay updated with shipment tracking at every stage",
          "Deliver from Hyderabad to cities across India",
          "One dashboard for every shipment and booking history",
        ],
      },
      {
        heading: "Common Parcels Sent from Hyderabad",
        paragraphs: ["Customers regularly use courier services to send:"],
        bullets: [
          "Business contracts and legal documents",
          "Pharmaceutical samples and medical supplies",
          "Ecommerce orders",
          "Electronics and accessories",
          "Clothing and lifestyle products",
          "Educational documents",
          "Gifts and personal parcels",
          "Office equipment",
          "Product samples",
          "Books and stationery",
        ],
      },
      {
        heading: "Send Parcels from Hyderabad with Confidence",
        paragraphs: [
          "Whether you're operating a business in Gachibowli, managing an online store in Madhapur, working from Hitech City, or sending a personal package to family, ViaSetu helps simplify every shipment.",
          "Book online, compare courier services, schedule a pickup, and monitor your parcel through one convenient platform.",
        ],
      },
    ],
    faqs: [
      { q: "Can I book a courier pickup from my home in Hyderabad?", a: "Yes. Doorstep pickup is available across many serviceable areas depending on courier partner availability." },
      { q: "Does ViaSetu support business shipping in Hyderabad?", a: "Yes. Individuals, startups, retailers, ecommerce businesses and SMEs can all use the platform to manage parcel deliveries." },
      { q: "Can I ship parcels from Hyderabad to anywhere in India?", a: "Yes. Courier bookings are available for deliveries across India through supported courier partners." },
      { q: "How can I track my shipment?", a: "After your booking is confirmed, you'll receive tracking details to monitor your parcel until delivery." },
      { q: "Which Hyderabad locations are commonly covered?", a: "Many residential, commercial and business districts across Hyderabad and Secunderabad are serviceable, depending on PIN code coverage." },
    ],
    closingHeading: "Built for Hyderabad's Growing Business Community",
    closingParagraphs: [
      "Hyderabad continues to attract technology companies, pharmaceutical manufacturers, exporters and fast-growing online businesses. As shipping volumes increase, businesses need courier services that are dependable, flexible and easy to manage.",
      "ViaSetu helps simplify logistics by connecting multiple courier partners through one platform, allowing businesses and individuals to book shipments, compare delivery options and stay informed throughout the shipping journey.",
    ],
  },
  {
    slug: "delhi",
    city: "Delhi",
    intro:
      "Need a dependable courier service in Delhi? ViaSetu lets you compare courier charges, book doorstep pickup, and send parcels across Delhi-NCR and anywhere in India. Whether you're dispatching business shipments from Nehru Place, delivering ecommerce orders from Rohini, or sending personal packages from Dwarka, you can choose the right courier partner in minutes all from one platform.",
    hubs: ["Connaught Place", "Dwarka", "Saket", "Rohini", "Nehru Place", "Karol Bagh", "Pitampura", "Lajpat Nagar", "Gurugram", "Noida", "Faridabad", "Ghaziabad"],
    highlights: [
      "Compare courier prices from multiple trusted delivery partners",
      "Doorstep parcel pickup across Delhi, Noida, Gurugram, Faridabad and Ghaziabad",
      "Ship documents, personal parcels, ecommerce orders and business consignments",
      "Live tracking with regular shipment updates until delivery",
    ],
    metaTitle: "Courier Service in Delhi | Doorstep Pickup & Parcel Delivery NCR | ViaSetu",
    metaDescription:
      "Book courier services in Delhi with ViaSetu. Compare courier charges, schedule doorstep pickup across Delhi-NCR, track shipments and send parcels anywhere in India.",
    h1: "Courier Service in Delhi",
    tagline: "Fast, Reliable Courier Services Across Delhi-NCR",
    sections: [
      {
        heading: "Couriers Available in Delhi",
        paragraphs: [
          "Delhi is one of India's busiest logistics hubs, where fast and reliable shipping is essential for businesses and individuals alike. ViaSetu brings together trusted courier partners so you can compare shipping costs, estimated delivery times, and pickup availability before booking. Instead of contacting multiple courier companies, you get everything in one place — from booking and pickup to real-time parcel tracking.",
          "Whether you're shipping within Delhi, across the NCR, or to any destination in India, ViaSetu helps you find the most suitable courier service based on your budget and delivery timeline.",
        ],
      },
      {
        heading: "Why Choose ViaSetu for Courier Services in Delhi?",
        bullets: [
          "Compare courier prices from multiple trusted delivery partners",
          "Doorstep parcel pickup across Delhi, Noida, Gurugram, Faridabad and Ghaziabad",
          "Ship documents, personal parcels, ecommerce orders and business consignments",
          "Live tracking with regular shipment updates until delivery",
        ],
      },
      {
        heading: "Popular Pickup Zones Across Delhi-NCR",
        paragraphs: [
          "Doorstep courier pickup is commonly available across Delhi, Gurugram, Noida, Faridabad and Ghaziabad, subject to courier partner serviceability and PIN code coverage.",
        ],
      },
      {
        heading: "Shipping Built for Delhi's Businesses and Homes",
        paragraphs: [
          "From wholesalers in Chandni Chowk to ecommerce sellers in Rohini, corporate offices in Nehru Place, and families in Dwarka — everyone in Delhi ships differently. ViaSetu supports business consignments, ecommerce orders, documents and personal parcels through a single easy-to-use platform.",
        ],
      },
    ],
    faqs: [
      { q: "Can I book a courier pickup from home in Delhi?", a: "Yes. Doorstep pickup is available across Delhi-NCR depending on the courier partner and PIN code." },
      { q: "Do you cover Gurugram, Noida, Faridabad and Ghaziabad?", a: "Yes. Pickup and delivery are commonly available across Delhi-NCR through supported courier partners." },
      { q: "Can I send parcels from Delhi to other cities?", a: "Absolutely. Shipments can be booked from Delhi to destinations across India." },
      { q: "How do I compare courier charges in Delhi?", a: "ViaSetu lets you view multiple courier options side by side with rates and delivery timelines before booking." },
      { q: "Is this suitable for ecommerce sellers in Delhi?", a: "Yes. Online sellers, SMEs and businesses use ViaSetu to manage regular parcel dispatches efficiently." },
    ],
    closingHeading: "Reliable Parcel Delivery Across Delhi-NCR",
    closingParagraphs: [
      "Delhi-NCR is one of India's largest courier corridors, with millions of shipments moving every day between homes, offices, warehouses and customers nationwide. ViaSetu makes it easier for businesses and individuals to ship efficiently by connecting multiple courier partners through one dashboard.",
      "Compare rates, schedule pickups, and track every parcel from a single platform — without visiting multiple courier offices.",
    ],
  },
];

export default function CityPage({ city }: { city: CityContent }) {
  const navigate = useNavigate();
  const others = CITIES.filter((c) => c.slug !== city.slug);
  const metaTitle = city.metaTitle || `Courier Service in ${city.city} | ViaSetu`;

  const faqSchema = city.faqs && city.faqs.length > 0
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: city.faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      }
    : null;

  return (
    <PublicSiteLayout>
      <Helmet>
        <title>{metaTitle}</title>
        <meta name="description" content={city.metaDescription} />
        <link rel="canonical" href={`https://www.viasetu.com/courier-service-in-${city.slug}`} />
        {faqSchema && (
          <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
        )}
      </Helmet>

      <section className="px-6 py-16" style={{ background: C.bg2 }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-[12px] font-bold uppercase tracking-wider mb-3 inline-flex items-center gap-2" style={{ color: C.teal }}>
            <MapPin className="h-4 w-4" /> City Coverage
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-3" style={{ color: C.text }}>
            {city.h1 || `Courier Service in ${city.city}`}
          </h1>
          {city.tagline && (
            <p className="text-xl md:text-2xl font-semibold mb-4" style={{ color: C.teal }}>
              {city.tagline}
            </p>
          )}
          <p className="text-lg" style={{ color: C.gray }}>{city.intro}</p>
        </div>
      </section>

      <section className="px-6 py-14">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-10">
          <div>
            <h2 className="text-2xl font-bold mb-4" style={{ color: C.text }}>
              Couriers available in {city.city}
            </h2>
            <p className="text-[14px] mb-4" style={{ color: C.gray }}>
              ViaSetu compares live rates from Delhivery, Xpressbees, Shadowfax, Shree Maruti and UrbaneBolt for every {city.city} address.
            </p>
            <ul className="space-y-3">
              {city.highlights.map((h) => (
                <li key={h} className="flex items-start gap-3 text-[14px]" style={{ color: C.text }}>
                  <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" style={{ color: C.teal }} />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex gap-3 flex-wrap">
              <button
                onClick={() => navigate("/login")}
                className="px-5 h-11 rounded-lg font-bold text-[14px] inline-flex items-center gap-2"
                style={{ background: C.teal, color: "#fff" }}
              >
                Book from {city.city} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-4" style={{ color: C.text }}>
              Popular pickup zones
            </h2>
            <div className="flex flex-wrap gap-2">
              {city.hubs.map((h) => (
                <span
                  key={h}
                  className="px-3 py-1.5 rounded-full text-[13px] border bg-white"
                  style={{ borderColor: C.border, color: C.text }}
                >
                  {h}
                </span>
              ))}
            </div>
            {city.slug === "mumbai" && (
              <p className="text-[13px] mt-4" style={{ color: C.gray }}>
                Availability depends on the selected courier partner and serviceable PIN codes.
              </p>
            )}
          </div>
        </div>
      </section>

      {city.sections && city.sections.length > 0 && (
        <section className="px-6 py-14" style={{ background: C.bg2, borderTop: `1px solid ${C.border}` }}>
          <div className="max-w-5xl mx-auto space-y-12">
            {city.sections.map((s) => (
              <div key={s.heading}>
                <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: C.text }}>
                  {s.heading}
                </h2>
                {s.paragraphs?.map((p, i) => (
                  <p key={i} className="text-[15px] mb-3" style={{ color: C.gray }}>
                    {p}
                  </p>
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
              </div>
            ))}
          </div>
        </section>
      )}

      {city.faqs && city.faqs.length > 0 && (
        <section className="px-6 py-14">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold mb-6" style={{ color: C.text }}>
              FAQs
            </h2>
            <div className="space-y-5">
              {city.faqs.map((f) => (
                <div key={f.q} className="p-5 rounded-xl border bg-white" style={{ borderColor: C.border }}>
                  <div className="font-bold text-[15px] mb-2" style={{ color: C.text }}>{f.q}</div>
                  <div className="text-[14px]" style={{ color: C.gray }}>{f.a}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {city.closingHeading && (
        <section className="px-6 py-14" style={{ background: C.bg2, borderTop: `1px solid ${C.border}` }}>
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: C.text }}>
              {city.closingHeading}
            </h2>
            {city.closingParagraphs?.map((p, i) => (
              <p key={i} className="text-[15px] mb-3" style={{ color: C.gray }}>
                {p}
              </p>
            ))}
            <div className="mt-6">
              <button
                onClick={() => navigate("/login")}
                className="px-6 h-12 rounded-lg font-bold text-[14px] inline-flex items-center gap-2"
                style={{ background: C.teal, color: "#fff" }}
              >
                Start shipping from {city.city} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="px-6 py-14" style={{ borderTop: `1px solid ${C.border}` }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold mb-6" style={{ color: C.text }}>
            Courier service in other cities
          </h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            {others.map((o) => (
              <Link
                key={o.slug}
                to={`/courier-service-in-${o.slug}`}
                className="block p-4 rounded-xl border bg-white hover:border-[#00A8A8] transition-colors"
                style={{ borderColor: C.border }}
              >
                <div className="font-bold text-[14px]" style={{ color: C.text }}>
                  Courier Service in {o.city}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </PublicSiteLayout>
  );
}
