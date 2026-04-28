import { Home, LayoutGrid, Palette, Megaphone, Plus, type LucideIcon } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/content", label: "Content Hub", icon: LayoutGrid },
  { to: "/studio", label: "New Design", icon: Plus, primary: true },
  { to: "/brand", label: "Brand Centre", icon: Palette },
  { to: "/brand?addUpdate=1#brand-updates", label: "Add Update", icon: Megaphone },
];

const FloatingNavBar = () => {
  const location = useLocation();
  const { user } = useAuth();

  const hiddenRoutes = ["/studio", "/auth", "/onboarding", "/reset-password"];
  const visible = !!user && !hiddenRoutes.some((r) => location.pathname.startsWith(r));

  useEffect(() => {
    if (visible) {
      document.body.classList.add("has-floating-nav");
      return () => document.body.classList.remove("has-floating-nav");
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <>
      {/* Mobile / Tablet — bottom floating bar */}
      <nav
        className="lg:hidden fixed left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
        aria-label="Primary"
      >
        <div
          className="flex items-center justify-between gap-1 rounded-full border border-border/60 bg-background/80 px-2 py-2 backdrop-blur-xl"
          style={{
            boxShadow:
              "0 10px 30px -10px hsl(var(--foreground) / 0.25), 0 4px 12px -4px hsl(var(--foreground) / 0.1)",
          }}
        >
          {navItems.map((item) => (
            <NavItem key={item.to} {...item} variant="mobile" />
          ))}
        </div>
      </nav>

      {/* Desktop — left floating sidebar */}
      <nav
        className="hidden lg:flex fixed left-4 top-1/2 -translate-y-1/2 z-50 flex-col"
        aria-label="Primary"
      >
        <div
          className="flex flex-col items-center gap-2 rounded-full border border-border/60 bg-background/80 px-2 py-3 backdrop-blur-xl"
          style={{
            boxShadow:
              "0 10px 30px -10px hsl(var(--foreground) / 0.25), 0 4px 12px -4px hsl(var(--foreground) / 0.1)",
          }}
        >
          {navItems.map((item) => (
            <NavItem key={item.to} {...item} variant="desktop" />
          ))}
        </div>
      </nav>
    </>
  );
};

interface NavItemProps {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  primary?: boolean;
  variant: "mobile" | "desktop";
}

const NavItem = ({ to, label, icon: Icon, end, primary, variant }: NavItemProps) => {
  if (primary) {
    return (
      <NavLink
        to={to}
        end={end}
        aria-label={label}
        className="group relative flex items-center justify-center"
      >
        <span
          className="flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-background transition-transform duration-200 group-hover:scale-110 group-active:scale-95"
          style={{
            boxShadow:
              "0 0 18px hsl(var(--foreground) / 0.3), 0 0 32px hsl(var(--foreground) / 0.12)",
          }}
        >
          <Icon className="h-5 w-5" strokeWidth={2.5} />
        </span>
        <Tooltip label={label} variant={variant} />
      </NavLink>
    );
  }

  return (
    <NavLink
      to={to}
      end={end}
      aria-label={label}
      className={({ isActive }) =>
        cn(
          "group relative flex h-11 w-11 items-center justify-center rounded-full transition-colors duration-200",
          isActive
            ? "bg-foreground/10 text-foreground"
            : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className="h-5 w-5" strokeWidth={isActive ? 2.25 : 2} />
          <Tooltip label={label} variant={variant} />
        </>
      )}
    </NavLink>
  );
};

const Tooltip = ({ label, variant }: { label: string; variant: "mobile" | "desktop" }) => {
  if (variant === "mobile") return null;
  return (
    <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100">
      {label}
    </span>
  );
};

export default FloatingNavBar;
