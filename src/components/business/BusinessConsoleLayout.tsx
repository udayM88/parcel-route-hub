import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  LogOut,
  Menu,
  Palette,
  Search,
  FlaskConical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { CURRENT_ENV } from "@/config/environment";
import { useBusinessAuth } from "@/contexts/useBusinessAuth";
import {
  getMerchantPageTitle,
  merchantNavigation,
  merchantRoot,
  type MerchantNavItem,
} from "@/components/business/console/merchant-navigation";
import viasetuConsoleLogo from "@/assets/merchant-console/viasetu.png";
import { endBusinessDemoSession, isBusinessDemoSession } from "@/lib/business-demo";

type ThemeId = "ocean" | "indigo" | "emerald" | "slate" | "sunset";

type ThemePreset = {
  id: ThemeId;
  name: string;
  description: string;
  swatch: string;
  variables: CSSProperties & Record<`--${string}`, string>;
};

const themePresets: ThemePreset[] = [
  {
    id: "ocean",
    name: "ViaSetu Cyan",
    description: "Official ViaSetu palette",
    swatch: "hsl(186 84% 48%)",
    variables: {
      "--background": "192 26% 97%",
      "--foreground": "205 48% 12%",
      "--card": "0 0% 100%",
      "--card-foreground": "205 48% 12%",
      "--popover": "0 0% 100%",
      "--popover-foreground": "205 48% 12%",
      "--primary": "186 84% 42%",
      "--primary-foreground": "0 0% 100%",
      "--secondary": "190 24% 94%",
      "--secondary-foreground": "205 48% 12%",
      "--muted": "190 20% 95%",
      "--muted-foreground": "202 17% 42%",
      "--accent": "185 72% 93%",
      "--accent-foreground": "188 79% 26%",
      "--border": "190 22% 88%",
      "--input": "190 22% 84%",
      "--ring": "186 84% 42%",
      "--merchant-highlight": "183 94% 52%",
      "--merchant-deep": "205 48% 12%",
    },
  },
  {
    id: "indigo",
    name: "Royal Indigo",
    description: "Focused and premium",
    swatch: "hsl(246 76% 60%)",
    variables: {
      "--background": "250 32% 97%",
      "--foreground": "249 36% 17%",
      "--card": "0 0% 100%",
      "--card-foreground": "249 36% 17%",
      "--popover": "0 0% 100%",
      "--popover-foreground": "249 36% 17%",
      "--primary": "246 76% 60%",
      "--primary-foreground": "0 0% 100%",
      "--secondary": "248 32% 94%",
      "--secondary-foreground": "249 36% 17%",
      "--muted": "248 28% 95%",
      "--muted-foreground": "250 14% 44%",
      "--accent": "248 100% 96%",
      "--accent-foreground": "247 57% 46%",
      "--border": "248 28% 90%",
      "--input": "248 28% 87%",
      "--ring": "246 76% 60%",
      "--merchant-highlight": "280 82% 64%",
      "--merchant-deep": "247 62% 43%",
    },
  },
  {
    id: "emerald",
    name: "Emerald",
    description: "Calm and operational",
    swatch: "hsl(161 85% 29%)",
    variables: {
      "--background": "153 24% 97%",
      "--foreground": "163 48% 14%",
      "--card": "0 0% 100%",
      "--card-foreground": "163 48% 14%",
      "--popover": "0 0% 100%",
      "--popover-foreground": "163 48% 14%",
      "--primary": "161 85% 29%",
      "--primary-foreground": "0 0% 100%",
      "--secondary": "156 30% 93%",
      "--secondary-foreground": "163 48% 14%",
      "--muted": "156 24% 94%",
      "--muted-foreground": "164 13% 40%",
      "--accent": "157 48% 93%",
      "--accent-foreground": "161 79% 22%",
      "--border": "157 26% 88%",
      "--input": "157 26% 84%",
      "--ring": "161 85% 29%",
      "--merchant-highlight": "174 72% 40%",
      "--merchant-deep": "162 73% 21%",
    },
  },
  {
    id: "slate",
    name: "Graphite Slate",
    description: "Neutral and executive",
    swatch: "hsl(215 27% 34%)",
    variables: {
      "--background": "210 17% 96%",
      "--foreground": "215 36% 14%",
      "--card": "0 0% 100%",
      "--card-foreground": "215 36% 14%",
      "--popover": "0 0% 100%",
      "--popover-foreground": "215 36% 14%",
      "--primary": "215 27% 34%",
      "--primary-foreground": "0 0% 100%",
      "--secondary": "213 20% 92%",
      "--secondary-foreground": "215 36% 14%",
      "--muted": "213 17% 94%",
      "--muted-foreground": "215 16% 45%",
      "--accent": "213 33% 93%",
      "--accent-foreground": "215 33% 25%",
      "--border": "212 20% 88%",
      "--input": "212 20% 84%",
      "--ring": "215 27% 34%",
      "--merchant-highlight": "207 76% 49%",
      "--merchant-deep": "218 35% 18%",
    },
  },
  {
    id: "sunset",
    name: "Sunset Coral",
    description: "Warm and energetic",
    swatch: "hsl(9 65% 55%)",
    variables: {
      "--background": "24 33% 97%",
      "--foreground": "10 34% 17%",
      "--card": "0 0% 100%",
      "--card-foreground": "10 34% 17%",
      "--popover": "0 0% 100%",
      "--popover-foreground": "10 34% 17%",
      "--primary": "9 65% 55%",
      "--primary-foreground": "0 0% 100%",
      "--secondary": "18 35% 93%",
      "--secondary-foreground": "10 34% 17%",
      "--muted": "18 28% 94%",
      "--muted-foreground": "12 15% 45%",
      "--accent": "12 72% 94%",
      "--accent-foreground": "9 61% 38%",
      "--border": "18 28% 88%",
      "--input": "18 28% 84%",
      "--ring": "9 65% 55%",
      "--merchant-highlight": "35 95% 55%",
      "--merchant-deep": "352 68% 43%",
    },
  },
];

const stripQuery = (path: string) => path.split("?")[0];

const pathIsActive = (pathname: string, item: MerchantNavItem) => {
  const target = item.to ? stripQuery(item.to) : undefined;
  if (target === pathname) return true;
  return item.children?.some((child) => stripQuery(child.to || "") === pathname) ?? false;
};

function SidebarNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const activeGroups = merchantNavigation.flatMap((section) =>
      section.items.filter((item) => item.children?.some((child) => stripQuery(child.to || "") === location.pathname)).map((item) => item.label),
    );
    return new Set(["Orders", ...activeGroups]);
  });

  const toggle = (label: string) => {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  return (
    <div className="merchant-sidebar flex h-full min-h-0 flex-col">
      <div className="merchant-brand flex min-h-[70px] items-center border-b px-5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <img src={viasetuConsoleLogo} alt="ViaSetu" className="h-8 w-[132px] object-contain object-left" />
          <span className="merchant-brand-caption pl-0.5 text-[9px] font-bold uppercase tracking-[0.16em]">Merchant Console</span>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <nav className="flex flex-col gap-1 px-3 py-3" aria-label="Merchant console navigation">
          {merchantNavigation.map((section) => (
            <div key={section.label} className="flex flex-col gap-1">
              <p className="merchant-nav-section px-3 pb-1 pt-4 text-[10px] font-extrabold uppercase tracking-[0.11em]">{section.label}</p>
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = pathIsActive(location.pathname, item);
                const expanded = openGroups.has(item.label);
                if (item.children) {
                  return (
                    <Collapsible key={item.label} open={expanded} onOpenChange={() => toggle(item.label)} className="flex flex-col gap-1">
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            "merchant-nav-item flex min-h-11 w-full items-center gap-3 rounded-xl px-2.5 text-left text-[13px] font-semibold",
                            active ? "font-bold" : "",
                          )}
                          data-active={active}
                        >
                          {Icon ? <span className="merchant-nav-icon"><Icon className="size-[18px] shrink-0" strokeWidth={1.9} /></span> : null}
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                          <ChevronDown className="merchant-nav-chevron size-4 transition-transform duration-200 data-[state=closed]:-rotate-90" />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="merchant-nav-children overflow-hidden">
                        <div className="ml-[21px] flex flex-col gap-1 border-l border-white/10 pb-1 pl-3 pt-1">
                          {item.children.map((child) => {
                            const childActive = stripQuery(child.to || "") === location.pathname;
                            const ChildIcon = child.icon;
                            return (
                              <NavLink
                                key={child.label}
                                to={child.to || merchantRoot}
                                onClick={onNavigate}
                                className={cn(
                                  "merchant-nav-child flex min-h-9 items-center gap-2 rounded-lg px-2.5 text-[12px] font-medium",
                                  childActive ? "font-bold" : "",
                                )}
                                data-active={childActive}
                              >
                                {ChildIcon ? <span className="merchant-nav-child-icon"><ChildIcon className="size-3.5 shrink-0" strokeWidth={1.9} /></span> : null}
                                <span className="min-w-0 flex-1 truncate">{child.label}</span>
                                {child.shortcut ? <span className="merchant-nav-shortcut whitespace-nowrap text-[10px]">{child.shortcut}</span> : null}
                              </NavLink>
                            );
                          })}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                }

                return (
                  <NavLink
                    key={item.label}
                    to={item.to || merchantRoot}
                    onClick={onNavigate}
                    className={cn(
                      "merchant-nav-item flex min-h-11 items-center gap-3 rounded-xl px-2.5 text-[13px] font-semibold",
                      active ? "font-bold" : "",
                    )}
                    data-active={active}
                  >
                    {Icon ? <span className="merchant-nav-icon"><Icon className={cn("size-[18px] shrink-0", item.label === "Dashboard" && active ? "fill-current" : "")} strokeWidth={1.9} /></span> : null}
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.shortcut ? <span className="merchant-nav-shortcut whitespace-nowrap text-[10px]">{item.shortcut}</span> : null}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
      </ScrollArea>

      <div className="merchant-sidebar-footer flex items-center justify-between border-t px-5 py-3 text-[11px]">
        <span>ViaSetu Merchant</span>
        <span className="font-bold text-primary">v0.2</span>
      </div>
    </div>
  );
}

export default function BusinessConsoleLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { business } = useBusinessAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [themeId, setThemeId] = useState<ThemeId>(() => {
    const saved = localStorage.getItem("viasetu_merchant_theme");
    return themePresets.some((theme) => theme.id === saved) ? (saved as ThemeId) : "ocean";
  });

  const theme = themePresets.find((preset) => preset.id === themeId) || themePresets[0];
  const pageTitle = getMerchantPageTitle(location.pathname);
  const isDemo = isBusinessDemoSession();
  const initials = useMemo(
    () => isDemo ? "VS" : (business?.company_name || "ViaSetu Merchant").split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase(),
    [business?.company_name, isDemo],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "o") {
        event.preventDefault();
        navigate(`${merchantRoot}/create-order`);
      }
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "a") {
        event.preventDefault();
        navigate(`${merchantRoot}/orders`);
      }
      if (event.ctrlKey && event.altKey && event.key.toLowerCase() === "t") {
        event.preventDefault();
        navigate(`${merchantRoot}/module/tracking`);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  const selectTheme = (id: ThemeId) => {
    setThemeId(id);
    localStorage.setItem("viasetu_merchant_theme", id);
  };

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigate(`${merchantRoot}/orders${search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ""}`);
  };

  const logout = async () => {
    endBusinessDemoSession();
    await supabase.auth.signOut();
    navigate(merchantRoot);
  };

  return (
    <div className="merchant-console h-screen overflow-hidden bg-background text-foreground" style={theme.variables}>
      <aside className="fixed inset-y-0 left-0 hidden w-[296px] border-r lg:block">
        <SidebarNavigation />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="merchant-console w-[296px] bg-card p-0 sm:max-w-[296px]" style={theme.variables}>
          <SheetTitle className="sr-only">Merchant navigation</SheetTitle>
          <SheetDescription className="sr-only">Navigate between merchant operations, finance, integrations and settings.</SheetDescription>
          <SidebarNavigation onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex h-full min-w-0 flex-col lg:pl-[296px]">
        <header className="merchant-topbar flex min-h-[68px] shrink-0 items-center gap-3 border-b bg-card/95 px-3 backdrop-blur-xl md:px-5">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu />
          </Button>
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-sm font-extrabold">{pageTitle}</p>
          </div>
          <div className="flex-1" />

          <form onSubmit={submitSearch} className="relative hidden w-full max-w-[220px] md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search orders, AWB..." className="h-10 rounded-[9px] pl-10 text-xs" aria-label="Search orders" />
          </form>

          <Badge variant="secondary" className={cn("merchant-environment hidden h-8 gap-1.5 border px-3 sm:inline-flex", isDemo ? "border-[#f3dcc7] bg-[#fff2e4] text-[#9a4f16]" : "bg-accent text-accent-foreground")}>
            <FlaskConical className="size-3.5" />
            {isDemo ? "Sandbox · sample data" : CURRENT_ENV === "sandbox" ? "Sandbox" : "Live"}
          </Badge>

          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="size-10 rounded-lg border border-[#d9e3f2]" aria-label="Choose workspace theme"><Palette /></Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Choose theme</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Workspace theme</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                {themePresets.map((preset) => (
                  <DropdownMenuItem key={preset.id} onSelect={() => selectTheme(preset.id)} className="gap-3 py-2.5">
                    <span className="size-5 shrink-0 rounded-full border-4 border-white shadow-sm" style={{ backgroundColor: preset.swatch }} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold">{preset.name}</span>
                      <span className="block text-[10px] text-muted-foreground">{preset.description}</span>
                    </span>
                    {themeId === preset.id ? <Check className="text-primary" /> : null}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="icon" className="relative hidden size-10 rounded-lg border border-[#d9e3f2] sm:inline-flex" aria-label="Notifications"><Bell /><span className="absolute right-2 top-1.5 size-2 rounded-full bg-[#d35656] ring-2 ring-white" /></Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-11 gap-2 rounded-xl px-1.5 md:px-2">
                <Avatar className="size-[34px] border-0">
                  <AvatarFallback className="bg-[#e7edff] text-xs font-extrabold text-[#173fae]">{initials}</AvatarFallback>
                </Avatar>
                <span className="hidden max-w-[180px] min-w-0 text-left xl:block">
                  <span className="block truncate text-xs font-extrabold">{business?.company_name || "Merchant"}</span>
                  <span className="block truncate text-[10px] font-normal text-muted-foreground">Merchant admin</span>
                </span>
                <ChevronDown className="hidden sm:block" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="truncate">{business?.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onSelect={() => navigate(`${merchantRoot}/module/profile`)}><ChevronLeft />Profile</DropdownMenuItem>
                <DropdownMenuItem onSelect={logout} className="text-destructive focus:text-destructive"><LogOut />Sign out</DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="merchant-console-content min-h-0 flex-1 overflow-y-auto p-4 md:p-[22px]">
          <div key={location.pathname} className="merchant-page-enter mx-auto w-full max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
