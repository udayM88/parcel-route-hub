import { Home, Package, Navigation, Clock, HelpCircle } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: Home, labelKey: "nav.home", path: "/home" },
  { icon: Package, labelKey: "nav.book", path: "/booking" },
  { icon: Navigation, labelKey: "nav.track", path: "/tracking" },
  { icon: Clock, labelKey: "nav.history", path: "/history" },
  { icon: HelpCircle, labelKey: "nav.support", path: "/support" },
];

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 xl:hidden">
      {/* Gradient border top */}
      <div className="h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
      
      {/* Glass background */}
      <div className="bg-background/80 backdrop-blur-xl border-t border-border/50">
        <div className="flex items-center justify-around py-2 px-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200",
                  "active:scale-95",
                  isActive 
                    ? "text-foreground bg-primary/20" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <div className={cn(
                  "relative",
                  isActive && "animate-pulse"
                )}>
                  <Icon className={cn(
                    "h-5 w-5 transition-transform",
                    isActive && "scale-110"
                  )} />
                  {isActive && (
                    <div className="absolute -inset-1 bg-primary/20 rounded-full blur-sm -z-10" />
                  )}
                </div>
                <span className={cn(
                  "text-[10px] font-medium transition-all",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}>
                  {t(item.labelKey)}
                </span>
              </button>
            );
          })}
        </div>
        
        {/* Safe area padding for iOS */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </div>
    </nav>
  );
};

export default BottomNav;
