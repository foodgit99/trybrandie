import type { ReactNode } from "react";
import { Navigate, NavLink } from "react-router-dom";
import { Home, Bookmark, Images, Wallet, User, Briefcase } from "lucide-react";
import { LoadingState } from "@/components/ui/spinner";
import NewAppHeader from "@/components/v2/NewAppHeader";
import { cn } from "@/lib/utils";
import { usePrivateNetwork } from "../hooks/usePrivateNetwork";

export function PNGate({ children }: { children: ReactNode }) {
  const pn = usePrivateNetwork();
  if (pn.loading) return <div className="flex min-h-screen items-center justify-center"><LoadingState label="Loading" /></div>;
  if (!pn.user) return <Navigate to="/auth" replace />;
  if (!pn.enabled) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const TABS = [
  { to: "/private-network", label: "Feed", icon: Home, end: true },
  { to: "/private-network/saved", label: "Saved", icon: Bookmark },
  { to: "/private-network/published", label: "Published", icon: Images },
  { to: "/private-network/earnings", label: "Earnings", icon: Wallet },
  { to: "/private-network/profile", label: "Profile", icon: User },
];

export function PNLayout({ title, actions, children, wide }: { title: string; actions?: ReactNode; children: ReactNode; wide?: boolean }) {
  const pn = usePrivateNetwork();
  const canManage = pn.isOperator || pn.brands.length > 0;
  return (
    <div className="min-h-screen bg-background pb-24 lg:pl-20">
      <NewAppHeader />
      <main className={cn("mx-auto px-4 py-5 space-y-4", wide ? "max-w-6xl" : "max-w-xl")}>
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <div className="flex items-center gap-2">
            {actions}
            {canManage && (
              <NavLink to="/private-network/manage" className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-muted">
                <Briefcase className="h-3.5 w-3.5" aria-hidden /> Manage
              </NavLink>
            )}
          </div>
        </div>
        {children}
      </main>
      <nav aria-label="Private Network" className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <ul className="mx-auto flex max-w-xl justify-around">
          {TABS.map((t) => (
            <li key={t.to}>
              <NavLink
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  cn("flex min-w-[64px] flex-col items-center gap-0.5 px-2 py-2 text-[11px]", isActive ? "text-foreground font-semibold" : "text-muted-foreground")
                }
              >
                <t.icon className="h-5 w-5" aria-hidden />
                {t.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

export function StatusPill({ tone = "muted", children }: { tone?: "muted" | "good" | "warn" | "bad" | "info"; children: ReactNode }) {
  const map = {
    muted: "bg-muted text-muted-foreground",
    good: "bg-primary/15 text-primary",
    warn: "bg-accent text-accent-foreground",
    bad: "bg-destructive/15 text-destructive",
    info: "bg-secondary text-secondary-foreground",
  } as const;
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", map[tone])}>{children}</span>;
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
      <p>{message}</p>
      {onRetry && <button onClick={onRetry} className="mt-2 font-medium underline">Try again</button>}
    </div>
  );
}
