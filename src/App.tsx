import { Suspense } from "react";
import { lazyWithRetry as lazy } from "@/lib/lazy-with-retry";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AdminAuthProvider } from "@/contexts/AdminAuthContext";
import ProtectedBusinessRoute from "@/components/business/ProtectedBusinessRoute";
import { CrispChat } from "@/components/CrispChat";

const Index = lazy(() => import("./pages/Index"));
const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/Login"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Booking = lazy(() => import("./pages/Booking"));
const Tracking = lazy(() => import("./pages/Tracking"));
const History = lazy(() => import("./pages/History"));
const OrderDetails = lazy(() => import("./pages/OrderDetails"));
const Support = lazy(() => import("./pages/Support"));
const Settings = lazy(() => import("./pages/Settings"));
const DeleteAccount = lazy(() => import("./pages/DeleteAccount"));
const Blog = lazy(() => import("./pages/cms/Blog"));
const CmsArticle = lazy(() => import("./pages/cms/CmsArticle"));
const FaqPage = lazy(() => import("./pages/cms/FaqPage"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const RefundPolicy = lazy(() => import("./pages/RefundPolicy"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const HowItWorks = lazy(() => import("./pages/HowItWorks"));
const CourierPartners = lazy(() => import("./pages/CourierPartners"));
const Careers = lazy(() => import("./pages/Careers"));
const ForBusiness = lazy(() => import("./pages/ForBusiness"));
const ServicePage = lazy(() => import("./pages/ServicePage"));
const ParcelTrackingPage = lazy(() => import("./pages/ParcelTrackingPage"));
const CityPage = lazy(() => import("./pages/CityPage"));
import { SERVICES } from "./pages/ServicePage";
import { CITIES } from "./pages/CityPage";
const CMSDashboard = lazy(() => import("./pages/admin/cms/CMSDashboard"));
const ContentList = lazy(() => import("./components/admin/cms/ContentList"));
const ContentEditor = lazy(() => import("./components/admin/cms/ContentEditor"));
const CmsEmails = lazy(() => import("./pages/admin/cms/CmsEmails"));
const CmsLogin = lazy(() => import("./pages/cms/CmsLogin"));
const OpsLogin = lazy(() => import("./pages/ops/OpsLogin"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const ResetPassword = lazy(() => import("./pages/admin/ResetPassword"));
const AdminLayout = lazy(() => import("./components/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const RealTimeTracking = lazy(() => import("./pages/admin/RealTimeTracking"));
const UserManagement = lazy(() => import("./pages/admin/UserManagement"));
const AdminUserManagement = lazy(() => import("./pages/admin/AdminUserManagement"));
const BusinessManagement = lazy(() => import("./pages/admin/BusinessManagement"));
const PartnerManagement = lazy(() => import("./pages/admin/PartnerManagement"));
const BusinessInquiries = lazy(() => import("./pages/admin/BusinessInquiries"));
const BusinessLogin = lazy(() => import("./pages/business/BusinessLogin"));
const BusinessResetPassword = lazy(() => import("./pages/business/BusinessResetPassword"));
const BusinessDashboard = lazy(() => import("./pages/business/BusinessDashboard"));
const BusinessBooking = lazy(() => import("./pages/business/BusinessBooking"));
const BusinessPortalLayout = lazy(() => import("./components/business/BusinessPortalLayout"));
const OrderMonitoring = lazy(() => import("./pages/admin/OrderMonitoring"));
const RevenueManagement = lazy(() => import("./pages/admin/RevenueManagement"));
const Reconciliation = lazy(() => import("./pages/admin/Reconciliation"));
const SupportManagement = lazy(() => import("./pages/admin/SupportManagement"));
const Analytics = lazy(() => import("./pages/admin/Analytics"));
const SystemSettings = lazy(() => import("./pages/admin/SystemSettings"));
const SmsLogs = lazy(() => import("./pages/admin/SmsLogs"));

const DisputeResolution = lazy(() => import("./pages/admin/DisputeResolution"));
const AbandonmentFunnel = lazy(() => import("./pages/admin/AbandonmentFunnel"));
const AssistedBooking = lazy(() => import("./pages/admin/AssistedBooking"));
const AssistedPendingBookings = lazy(() => import("./pages/admin/AssistedPendingBookings"));
const ProtectedAdminRoute = lazy(() => import("./components/admin/ProtectedAdminRoute"));

const queryClient = new QueryClient();

const AppLoading = () => (
  <div className="min-h-screen flex items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <CrispChat />
      <BrowserRouter>
        <Suspense fallback={<AppLoading />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/booking" element={<Booking />} />
          <Route path="/tracking" element={<Tracking />} />
          <Route path="/history" element={<History />} />
          <Route path="/order/:orderId" element={<OrderDetails />} />
          <Route path="/support" element={<Support />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/delete-account" element={<DeleteAccount />} />
          <Route path="/account-deletion" element={<Navigate to="/delete-account" replace />} />

          {/* Public CMS Routes */}
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<CmsArticle type="post" />} />
          <Route path="/p/:slug" element={<CmsArticle type="page" />} />
          <Route path="/courier/:slug" element={<CmsArticle type="partner" />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/about" element={<About />} />
          <Route path="/about-us" element={<Navigate to="/about" replace />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/careers" element={<Careers />} />
          <Route path="/for-business" element={<ForBusiness />} />
          <Route path="/business" element={<Navigate to="/for-business" replace />} />
          <Route path="/courier-partners" element={<CourierPartners />} />
          <Route path="/services/parcel-tracking" element={<ParcelTrackingPage />} />
          {SERVICES.filter((s) => s.slug !== "parcel-tracking").map((s) => (
            <Route key={s.slug} path={`/services/${s.slug}`} element={<ServicePage service={s} />} />
          ))}
          {CITIES.map((c) => (
            <Route key={c.slug} path={`/courier-service-in-${c.slug}`} element={<CityPage city={c} />} />
          ))}
          <Route path="/terms-and-conditions" element={<Terms />} />
          <Route path="/Termsandconditions" element={<Navigate to="/terms-and-conditions" replace />} />
          <Route path="/terms" element={<Navigate to="/terms-and-conditions" replace />} />
          <Route path="/privacy-policy" element={<Privacy />} />
          <Route path="/Privacypolicy" element={<Navigate to="/privacy-policy" replace />} />
          <Route path="/privacy" element={<Navigate to="/privacy-policy" replace />} />
          <Route path="/refund-policy" element={<RefundPolicy />} />
          <Route path="/Refundpolicy" element={<Navigate to="/refund-policy" replace />} />
          <Route path="/refund" element={<Navigate to="/refund-policy" replace />} />
          
          {/* Admin Routes */}
          <Route path="/viasetuforbusinesses" element={<BusinessPortalLayout />}>
            <Route index element={<BusinessLogin />} />
            <Route path="reset-password" element={<BusinessResetPassword />} />
            <Route path="dashboard" element={<ProtectedBusinessRoute><BusinessDashboard /></ProtectedBusinessRoute>} />
            <Route path="book" element={<ProtectedBusinessRoute><BusinessBooking /></ProtectedBusinessRoute>} />
          </Route>
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/reset-password" element={<ResetPassword />} />
          <Route path="/cms/login" element={<CmsLogin />} />
          <Route path="/cms/reset-password" element={<ResetPassword />} />
          <Route path="/ops/login" element={<OpsLogin />} />
          <Route path="/ops/reset-password" element={<ResetPassword />} />
          <Route path="/admin-users" element={<Navigate to="/admin/admin-users" replace />} />
          <Route path="/admin-orders" element={<Navigate to="/admin/orders" replace />} />
          <Route path="/admin-dashboard" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin" element={<AdminAuthProvider><ProtectedAdminRoute><AdminLayout /></ProtectedAdminRoute></AdminAuthProvider>}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<ProtectedAdminRoute allowedRoles={["super_admin"]}><AdminDashboard /></ProtectedAdminRoute>} />
            <Route path="tracking" element={<ProtectedAdminRoute allowedRoles={["super_admin", "operations", "support"]}><RealTimeTracking /></ProtectedAdminRoute>} />
            <Route path="orders" element={<ProtectedAdminRoute allowedRoles={["super_admin", "operations", "support"]}><OrderMonitoring /></ProtectedAdminRoute>} />
            <Route path="assisted-booking" element={<ProtectedAdminRoute allowedRoles={["super_admin", "operations", "support"]}><AssistedBooking /></ProtectedAdminRoute>} />
            <Route path="assisted-pending" element={<ProtectedAdminRoute allowedRoles={["super_admin", "operations", "support"]}><AssistedPendingBookings /></ProtectedAdminRoute>} />

            <Route path="users" element={<ProtectedAdminRoute allowedRoles={["super_admin", "operations", "support"]}><UserManagement /></ProtectedAdminRoute>} />
            <Route path="admin-users" element={<ProtectedAdminRoute allowedRoles={["super_admin"]}><AdminUserManagement /></ProtectedAdminRoute>} />
            <Route path="businesses" element={<ProtectedAdminRoute allowedRoles={["super_admin", "operations"]}><BusinessManagement /></ProtectedAdminRoute>} />
            <Route path="courier-partners" element={<ProtectedAdminRoute allowedRoles={["super_admin", "operations"]}><PartnerManagement /></ProtectedAdminRoute>} />
            <Route path="business-inquiries" element={<ProtectedAdminRoute allowedRoles={["super_admin", "operations", "support"]}><BusinessInquiries /></ProtectedAdminRoute>} />
            <Route path="revenue" element={<ProtectedAdminRoute allowedRoles={["super_admin"]}><RevenueManagement /></ProtectedAdminRoute>} />
            <Route path="reconciliation" element={<ProtectedAdminRoute allowedRoles={["super_admin", "operations", "support"]}><Reconciliation /></ProtectedAdminRoute>} />
            <Route path="support" element={<ProtectedAdminRoute allowedRoles={["super_admin", "operations", "support"]}><SupportManagement /></ProtectedAdminRoute>} />
            <Route path="disputes" element={<ProtectedAdminRoute allowedRoles={["super_admin", "operations", "support"]}><DisputeResolution /></ProtectedAdminRoute>} />
            <Route path="analytics" element={<ProtectedAdminRoute allowedRoles={["super_admin"]}><Analytics /></ProtectedAdminRoute>} />
            <Route path="abandonment" element={<ProtectedAdminRoute allowedRoles={["super_admin", "operations", "support"]}><AbandonmentFunnel /></ProtectedAdminRoute>} />
            <Route path="settings" element={<ProtectedAdminRoute allowedRoles={["super_admin"]}><SystemSettings /></ProtectedAdminRoute>} />
            <Route path="sms-logs" element={<ProtectedAdminRoute allowedRoles={["super_admin", "operations", "support"]}><SmsLogs /></ProtectedAdminRoute>} />

            <Route path="cms" element={<ProtectedAdminRoute allowedRoles={["super_admin", "cms_editor"]}><CMSDashboard /></ProtectedAdminRoute>} />
            <Route path="cms/posts" element={<ProtectedAdminRoute allowedRoles={["super_admin", "cms_editor"]}><ContentList type="post" /></ProtectedAdminRoute>} />
            <Route path="cms/posts/:id" element={<ProtectedAdminRoute allowedRoles={["super_admin", "cms_editor"]}><ContentEditor type="post" /></ProtectedAdminRoute>} />
            <Route path="cms/pages" element={<ProtectedAdminRoute allowedRoles={["super_admin", "cms_editor"]}><ContentList type="page" /></ProtectedAdminRoute>} />
            <Route path="cms/pages/:id" element={<ProtectedAdminRoute allowedRoles={["super_admin", "cms_editor"]}><ContentEditor type="page" /></ProtectedAdminRoute>} />
            <Route path="cms/faqs" element={<ProtectedAdminRoute allowedRoles={["super_admin", "cms_editor"]}><ContentList type="faq" /></ProtectedAdminRoute>} />
            <Route path="cms/faqs/:id" element={<ProtectedAdminRoute allowedRoles={["super_admin", "cms_editor"]}><ContentEditor type="faq" /></ProtectedAdminRoute>} />
            <Route path="cms/partners" element={<ProtectedAdminRoute allowedRoles={["super_admin", "cms_editor"]}><ContentList type="partner" /></ProtectedAdminRoute>} />
            <Route path="cms/partners/:id" element={<ProtectedAdminRoute allowedRoles={["super_admin", "cms_editor"]}><ContentEditor type="partner" /></ProtectedAdminRoute>} />
            <Route path="cms/emails" element={<ProtectedAdminRoute allowedRoles={["super_admin", "cms_editor"]}><CmsEmails /></ProtectedAdminRoute>} />

          </Route>
          
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
