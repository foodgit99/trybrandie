import { NavLink, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Gauge, Calendar, Palette, BarChart3 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const items = [
  { to: "/cockpit", label: "Cockpit", icon: Gauge },
  { to: "/blueprint", label: "Blueprint", icon: Calendar },
  { to: "/brand", label: "Brand", icon: Palette },
  { to: "/report", label: "Report", icon: BarChart3 },
];

// Primary v2 surfaces where this nav should render
const primaryPrefixes = ["/cockpit", "/blueprint", "/brand", "/report", "/post/", "/settings"];

const NewFloatingNav = () => {
  const { user } = useAuth();
  const { pathname } = useLocation();

  const onPrimary = primaryPrefixes.some((p) =>
    p.endsWith("/") ? pathname.startsWith(p) : pathname === p || pathname.startsWith(p + "/")
  );
  const visible = !!user && onPrimary;

  useEffect(() => {
    if (visible) document.body.classList.add("has-floating-nav");
    else document.body.classList.remove("has-floating-nav");
    return () => document.body.classList.remove("has-floating-nav");
  }, [visible, pathname]);

  if (!visible) return null;

  return (
    <>
      {/* Mobile / tablet — bottom bar */}
      <nav
        aria-label="Primary"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="grid grid-cols-4">
          {items.map(({ to, label, icon: Icon }) => (
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
        </ul>
      </nav>

      {/* Desktop — left rail */}
      <nav
        aria-label="Primary"
        className="hidden lg:flex fixed left-0 top-0 bottom-0 z-40 w-20 flex-col items-center gap-1 border-r border-border/60 bg-background/80 backdrop-blur py-6"
      >
        <div className="mb-4 h-9 w-9 rounded-xl bg-foreground/90 text-background grid place-items-center font-serif text-base">
          B
        </div>
        {items.map(({ to, label, icon: Icon }) => (
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
      </nav>
    </>
  );
};

export default NewFloatingNav;
