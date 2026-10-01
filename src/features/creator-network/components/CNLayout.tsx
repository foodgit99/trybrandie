import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import NewAppHeader from "@/components/v2/NewAppHeader";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/creator-network", label: "Overview", end: true },
  { to: "/creator-network/work", label: "My Work" },
  { to: "/creator-network/creators", label: "Creators" },
  { to: "/creator-network/businesses", label: "Businesses" },
  { to: "/creator-network/matches", label: "Matches" },
  { to: "/creator-network/opportunities", label: "Opportunities" },
  { to: "/creator-network/production", label: "Production" },
  { to: "/creator-network/sales", label: "Sales" },
  { to: "/creator-network/evidence", label: "Evidence" },
  { to: "/creator-network/ai-work", label: "AI Work" },
  { to: "/creator-network/learning", label: "Learning" },
];

export default function CNLayout({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background lg:pl-20 pb-28">
      <NewAppHeader />
      <main className="mx-auto max-w-6xl px-4 py-6 space-y-5">
        <nav aria-label="Creator Network" className="-mx-4 overflow-x-auto px-4">
          <ul className="flex w-max gap-1 rounded-2xl bg-muted p-1">
            {NAV.map((n) => (
              <li key={n.to}>
                <NavLink
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) =>
                    cn(
                      "inline-flex min-h-11 items-center rounded-xl px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                      isActive ? "bg-background shadow-sm font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
                    )
                  }
                >
                  {n.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Creator Network · Internal</p>
            <h1 className="font-serif text-3xl sm:text-4xl tracking-tight">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{subtitle}</p>}
          </div>
          {actions}
        </header>
        {children}
      </main>
    </div>
  );
}
