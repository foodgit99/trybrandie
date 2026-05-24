import { Users2, User } from "lucide-react";
import { formatNgn } from "@/lib/affiliateConfig";

export interface NetworkNode {
  id: string;
  affiliate_code: string;
  status: string;
  created_at: string;
}

interface Props {
  recruits: NetworkNode[];
  networkEarnings: number;
}

const NetworkTree = ({ recruits, networkEarnings }: Props) => {
  if (recruits.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border p-5 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-medium flex items-center gap-2">
          <Users2 className="h-4 w-4 text-primary" /> Your network
        </h3>
        <span className="text-xs text-muted-foreground">
          Network earnings to date: <span className="font-medium text-foreground">{formatNgn(networkEarnings)}</span>
        </span>
      </div>

      {/* You node */}
      <div className="relative space-y-4">
        <div className="flex items-center gap-3 rounded-xl bg-primary/10 border border-primary/30 p-3 max-w-xs">
          <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
            <User className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium">You</p>
            <p className="text-[11px] text-muted-foreground">{recruits.length} direct recruit{recruits.length === 1 ? "" : "s"}</p>
          </div>
        </div>

        {/* Connector */}
        <div className="ml-6 border-l-2 border-dashed border-border pl-6 space-y-3">
          {recruits.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 rounded-xl border border-border p-3"
            >
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono">{r.affiliate_code.slice(0, 4)}••••</p>
                <p className="text-[11px] text-muted-foreground">
                  Joined {new Date(r.created_at).toLocaleDateString()}
                </p>
              </div>
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  r.status === "approved"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                    : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                }`}
              >
                {r.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        You earn 5% on the first payment and 3% lifetime on every referral your recruits bring in.
      </p>
    </div>
  );
};

export default NetworkTree;
