import { NavLink, useLocation, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Gauge,
  LayoutGrid,
  Palette,
  BarChart3,
  MoreHorizontal,
  Sparkles,
  CalendarDays,
  Settings as SettingsIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useBrand } from "@/hooks/useBrand";
import { brandHref } from "@/hooks/useBrandParamSync";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }> };

const primary: NavItem[] = [
  { to: "/cockpit", label: "Cockpit", icon: Gauge },
  { to: "/hub", label: "Content", icon: LayoutGrid },
  { to: "/engine", label: "Engine", icon: Sparkles },
];

const moreItems: Array<NavItem & { description: string }> = [
  {
    to: "/blueprint",
    label: "Blueprint",
    icon: CalendarDays,
    description: "The week's strategic arc",
  },
  {
    to: "/brand",
    label: "Brand",
    icon: Palette,
    description: "Your brand centre & style genome",
  },
  {
    to: "/report",
    label: "Report",
    icon: BarChart3,
    description: "How last week performed",
  },
  {
    to: "/settings",
    label: "Settings",
    icon: SettingsIcon,
    description: "Delivery, brand & billing",
  },
];

// Primary v2 surfaces where this nav should render
const primaryPrefixes = [
  "/cockpit",
  "/blueprint",
  "/brand",
  "/report",
  "/post/",
  "/settings",
  "/engine",
  "/hub",
  "/content-hub",
  "/history",
  "/plans",
  "/support",
  "/brands",
];

const moreActivePrefixes = moreItems.map((i) => i.to);

const NewFloatingNav = () => {
  const { user } = useAuth();
  const { activeBrandId } = useBrand();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(false);

  const onPrimary = primaryPrefixes.some((p) =>
    p.endsWith("/") ? pathname.startsWith(p) : pathname === p || pathname.startsWith(p + "/")
  );
  const visible = !!user && onPrimary;

  useEffect(() => {
    if (visible) document.body.classList.add("has-floating-nav");
    else document.body.classList.remove("has-floating-nav");
    return () => document.body.classList.remove("has-floating-nav");
  }, [visible, pathname]);

  // Close menus on route change
  useEffect(() => {
    setMobileOpen(false);
    setDesktopOpen(false);
  }, [pathname]);

  if (!visible) return null;

  const moreActive = moreActivePrefixes.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  const MoreMenu = (
    <div className="space-y-1">
      <p className="text-[11px] tracking-[0.22em] uppercase text-muted-foreground px-2 pt-1 pb-2">
        More
      </p>
      <ul className="space-y-0.5">
        {moreItems.map(({ to, label, icon: Icon, description }) => {
          const active = pathname === to || pathname.startsWith(to + "/");
          return (
            <li key={to}>
              <Link
                to={to === "/brand" ? brandHref(to, activeBrandId) : to}
                onClick={() => {
                  setMobileOpen(false);
                  setDesktopOpen(false);
                }}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                  active
                    ? "bg-foreground text-background"
                    : "hover:bg-muted text-foreground"
                )}
              >
                <span
                  className={cn(
                    "h-9 w-9 rounded-lg grid place-items-center shrink-0 transition-colors",
                    active
                      ? "bg-background/15 text-background"
                      : "bg-muted text-foreground group-hover:bg-background group-hover:shadow-sm"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium leading-tight">{label}</span>
                  <span
                    className={cn(
                      "block text-[11px] leading-tight mt-0.5 truncate",
                      active ? "text-background/70" : "text-muted-foreground"
                    )}
                  >
                    {description}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <>
      {/* Mobile / tablet, bottom bar */}
      <nav
        aria-label="Primary"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="grid grid-cols-4">
          {primary.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center gap-1 py-2.5 text-[11px] tracking-wide",
                    isActive ? "text-foreground" : "text-muted-foreground"
                  )
                }
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </NavLink>
            </li>
          ))}
          <li>
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label="More"
                  className={cn(
                    "w-full flex flex-col items-center gap-1 py-2.5 text-[11px] tracking-wide transition-colors",
                    moreActive || mobileOpen ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "h-5 w-5 grid place-items-center rounded-full transition-all",
                      mobileOpen && "bg-foreground text-background"
                    )}
                  >
                    <MoreHorizontal className="h-5 w-5" />
                  </span>
                  <span>More</span>
                </button>
              </SheetTrigger>
              <SheetContent
                side="bottom"
                className="rounded-t-3xl border-t border-border/70 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
              >
                <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/30" />
                {MoreMenu}
              </SheetContent>
            </Sheet>
          </li>
        </ul>
      </nav>

      {/* Desktop, left rail */}
      <nav
        aria-label="Primary"
        className="hidden lg:flex fixed left-0 top-0 bottom-0 z-40 w-20 flex-col items-center gap-1 border-r border-border/60 bg-background/80 backdrop-blur py-6"
      >
        <div className="mb-4 h-9 w-9 rounded-xl bg-foreground/90 text-background grid place-items-center font-serif text-base">
          B
        </div>
        {primary.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-1 py-3 w-full text-[10px] tracking-wide transition-colors",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )
            }
          >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
          </NavLink>
        ))}

        <Popover open={desktopOpen} onOpenChange={setDesktopOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="More"
              className={cn(
                "flex flex-col items-center gap-1 py-3 w-full text-[10px] tracking-wide transition-colors",
                moreActive || desktopOpen
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span
                className={cn(
                  "h-5 w-5 grid place-items-center rounded-full transition-all",
                  desktopOpen && "bg-foreground text-background"
                )}
              >
                <MoreHorizontal className="h-5 w-5" />
              </span>
              <span>More</span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="right"
            align="end"
            sideOffset={12}
            className="w-72 p-2 rounded-2xl border border-border/70 shadow-xl"
          >
            {MoreMenu}
          </PopoverContent>
        </Popover>
      </nav>
    </>
  );
};

export default NewFloatingNav;
