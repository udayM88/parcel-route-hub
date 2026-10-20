import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Archive,
  BarChart3,
  Calculator,
  CircleDollarSign,
  ClipboardList,
  Code2,
  FileKey2,
  FileText,
  LayoutDashboard,
  KeyRound,
  Landmark,
  Link2,
  LifeBuoy,
  MapPin,
  PackagePlus,
  Plug,
  ReceiptText,
  Scale,
  Settings,
  ShieldCheck,
  Store,
  Truck,
  Upload,
  UserRound,
  Users,
  Wallet,
  Webhook,
} from "lucide-react";

export type MerchantNavItem = {
  label: string;
  to?: string;
  icon?: LucideIcon;
  shortcut?: string;
  children?: MerchantNavItem[];
};

export type MerchantNavSection = {
  label: string;
  items: MerchantNavItem[];
};

const root = "/viasetuforbusinesses";

export const merchantNavigation: MerchantNavSection[] = [
  {
    label: "Operations",
    items: [
      { label: "Dashboard", to: `${root}/dashboard`, icon: LayoutDashboard },
      {
        label: "Orders",
        icon: Archive,
        children: [
          { label: "Create Order", to: `${root}/create-order`, icon: PackagePlus, shortcut: "Ctrl + O" },
          { label: "View Orders", to: `${root}/orders`, icon: Archive, shortcut: "Ctrl + Shift + A" },
          { label: "Bulk Booking", to: `${root}/module/bulk-booking`, icon: Upload, shortcut: "Ctrl + B" },
        ],
      },
      {
        label: "COD Management",
        icon: CircleDollarSign,
        children: [
          { label: "View COD Orders", to: `${root}/module/cod-orders`, icon: CircleDollarSign },
          { label: "COD Dashboard", to: `${root}/module/cod-dashboard`, icon: BarChart3 },
        ],
      },
      { label: "Tracking", to: `${root}/module/tracking`, icon: MapPin, shortcut: "Ctrl + Alt + T" },
      { label: "Weight Reconciliation", to: `${root}/module/weight-reconciliation`, icon: Scale },
    ],
  },
  {
    label: "Network",
    items: [{ label: "Users", to: `${root}/module/users`, icon: Users }],
  },
  {
    label: "Finance",
    items: [
      {
        label: "Rate Cards",
        icon: ReceiptText,
        children: [{ label: "My Rate Card", to: `${root}/module/rate-cards`, icon: ReceiptText }],
      },
      { label: "Rate Calculator", to: `${root}/module/rate-calculator`, icon: Calculator },
      {
        label: "Billings & Payments",
        icon: Landmark,
        children: [
          { label: "Wallet", to: `${root}/wallet`, icon: Wallet },
          { label: "Recharge Management", to: `${root}/module/recharge-management`, icon: Wallet },
          { label: "Invoices", to: `${root}/module/invoices`, icon: FileText },
          { label: "Billing & Statements", to: `${root}/module/billing-statements`, icon: Landmark },
        ],
      },
      {
        label: "Reports & Analytics",
        icon: BarChart3,
        children: [
          { label: "Report & Analytics", to: `${root}/module/analytics`, icon: BarChart3 },
          { label: "Transaction Report", to: `${root}/module/transactions`, icon: Activity },
        ],
      },
    ],
  },
  {
    label: "Integration",
    items: [
      { label: "Ecom Channels", to: `${root}/integrations`, icon: Store },
      { label: "Plugins", to: `${root}/integrations?tab=plugins`, icon: Plug },
      {
        label: "API & Webhooks",
        icon: Code2,
        children: [
          { label: "View API Keys", to: `${root}/developers`, icon: KeyRound },
          { label: "Create API Key", to: `${root}/developers?create=1`, icon: FileKey2 },
          { label: "Webhook Subscriptions", to: `${root}/module/webhooks`, icon: Webhook },
        ],
      },
    ],
  },
  {
    label: "Carrier Management",
    items: [
      { label: "Carrier Selection", to: `${root}/module/carrier-selection`, icon: Truck },
      { label: "Carrier Rules", to: `${root}/module/carrier-rules`, icon: ClipboardList },
    ],
  },
  {
    label: "Location Management",
    items: [
      { label: "Address Management", to: `${root}/module/addresses`, icon: MapPin },
      { label: "Pincode Management", to: `${root}/module/pincodes`, icon: ShieldCheck },
    ],
  },
  {
    label: "Configuration",
    items: [
      {
        label: "Settings",
        icon: Settings,
        children: [
          { label: "Profile", to: `${root}/module/profile`, icon: UserRound },
          { label: "Notifications", to: `${root}/module/notifications`, icon: Activity },
          { label: "Activity Logs", to: `${root}/module/activity-logs`, icon: Activity },
          { label: "Active Sessions", to: `${root}/module/active-sessions`, icon: ShieldCheck },
        ],
      },
      { label: "Label Configuration", to: `${root}/module/label-configuration`, icon: FileText },
      { label: "Invoice Configuration", to: `${root}/module/invoice-configuration`, icon: FileText },
      { label: "Support", to: `${root}/module/support`, icon: LifeBuoy },
    ],
  },
];

export const moduleMeta: Record<string, { title: string; description: string; icon: LucideIcon }> = {
  "bulk-booking": { title: "Bulk Booking", description: "Upload a validated CSV or Excel sheet to prepare multiple shipments.", icon: Upload },
  "cod-orders": { title: "COD Orders", description: "Review cash-on-delivery collections and remittance status.", icon: CircleDollarSign },
  "cod-dashboard": { title: "COD Dashboard", description: "Monitor expected, collected and remitted COD amounts.", icon: BarChart3 },
  tracking: { title: "Tracking", description: "Search shipments using an AWB or tracking ID.", icon: MapPin },
  "weight-reconciliation": { title: "Weight Reconciliation", description: "Review audited weight differences and additional charges.", icon: Scale },
  users: { title: "Users & Access", description: "Manage merchant team members and their access.", icon: Users },
  "rate-cards": { title: "My Rate Card", description: "Review the courier services and commercial rates assigned to your account.", icon: ReceiptText },
  "rate-calculator": { title: "Rate Calculator", description: "Estimate courier pricing before creating a shipment.", icon: Calculator },
  "recharge-management": { title: "Recharge Management", description: "Review wallet top-ups and payment reconciliation.", icon: Wallet },
  invoices: { title: "Invoices", description: "Download shipment and wallet invoices for your account.", icon: FileText },
  "billing-statements": { title: "Billing & Statements", description: "Review account statements and financial activity.", icon: Landmark },
  analytics: { title: "Reports & Analytics", description: "Understand shipment volume, status and delivery performance.", icon: BarChart3 },
  transactions: { title: "Transaction Report", description: "Review a consolidated report of wallet and shipment transactions.", icon: Activity },
  webhooks: { title: "Webhook Subscriptions", description: "Configure server endpoints for shipment status events.", icon: Webhook },
  "carrier-selection": { title: "Carrier Selection", description: "Choose the courier partners available to this merchant account.", icon: Truck },
  "carrier-rules": { title: "Carrier Rules", description: "Define routing preferences without changing historical bookings.", icon: ClipboardList },
  addresses: { title: "Address Management", description: "Manage saved pickup and return addresses.", icon: MapPin },
  pincodes: { title: "Pincode Management", description: "Review serviceability coverage for configured courier partners.", icon: ShieldCheck },
  profile: { title: "Profile", description: "Review merchant account and business contact details.", icon: UserRound },
  notifications: { title: "Notification Settings", description: "Choose shipment events that trigger merchant notifications.", icon: Activity },
  "activity-logs": { title: "User Activity Logs", description: "Review important merchant-console activity.", icon: Activity },
  "active-sessions": { title: "Active Sessions", description: "Review devices currently signed in to the merchant account.", icon: ShieldCheck },
  "label-configuration": { title: "Label Configuration", description: "Configure defaults for shipping labels.", icon: FileText },
  "invoice-configuration": { title: "Invoice Configuration", description: "Configure merchant invoice defaults.", icon: FileText },
  support: { title: "Support", description: "Contact ViaSetu support for account or shipment help.", icon: Link2 },
};

export const getMerchantPageTitle = (pathname: string) => {
  if (pathname.endsWith("/dashboard")) return "Dashboard";
  if (pathname.endsWith("/orders")) return "Orders";
  if (pathname.endsWith("/book") || pathname.endsWith("/create-order")) return "Create Order";
  if (pathname.endsWith("/wallet")) return "Wallet";
  if (pathname.endsWith("/developers")) return "API & Integrations";
  if (pathname.endsWith("/integrations")) return "Integration Hub";
  const moduleKey = pathname.split("/module/")[1];
  return moduleMeta[moduleKey]?.title || "Merchant Console";
};

export const merchantRoot = root;
