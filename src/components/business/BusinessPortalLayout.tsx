import { Outlet } from "react-router-dom";
import { BusinessAuthProvider } from "@/contexts/BusinessAuthContext";

const BusinessPortalLayout = () => (
  <BusinessAuthProvider>
    <Outlet />
  </BusinessAuthProvider>
);

export default BusinessPortalLayout;