import { Navigate } from "react-router-dom";
import { Loader2, ShieldX } from "lucide-react";
import { useBusinessAuth } from "@/contexts/useBusinessAuth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { MerchantPermission } from "@/lib/merchant-permissions";

const ProtectedBusinessRoute = ({ children, permission }: { children: React.ReactNode; permission?: MerchantPermission }) => {
  const { loading, business, can } = useBusinessAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!business) return <Navigate to="/viasetuforbusinesses" replace />;

  if (permission && !can(permission)) return <div className="p-5 md:p-8"><Alert className="border-amber-200 bg-amber-50/80"><ShieldX /><AlertTitle>Permission required</AlertTitle><AlertDescription>Your merchant role does not include <strong>{permission.replace(":", " ")}</strong> access. Ask the merchant owner or an administrator to update your role.</AlertDescription></Alert></div>;

  return <>{children}</>;
};

export default ProtectedBusinessRoute;
