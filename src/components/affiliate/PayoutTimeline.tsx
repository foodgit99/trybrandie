import { CheckCircle2, Circle, Loader2 } from "lucide-react";

interface Props {
  status: string; // requested | approved | processing | paid | rejected
}

const STEPS = [
  { key: "requested", label: "Requested" },
  { key: "approved", label: "Approved" },
  { key: "processing", label: "Processing" },
  { key: "paid", label: "Paid" },
];

const PayoutTimeline = ({ status }: Props) => {
  if (status === "rejected") {
    return (
      <div className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 inline-block">
        Rejected
      </div>
    );
  }

  const currentIdx = STEPS.findIndex((s) => s.key === status);
  const activeIdx = currentIdx === -1 ? 0 : currentIdx;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {STEPS.map((s, i) => {
        const done = i < activeIdx;
        const current = i === activeIdx;
        return (
          <div key={s.key} className="flex items-center gap-1">
            <div
              className={`flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                done
                  ? "text-emerald-700 dark:text-emerald-300"
                  : current
                  ? "text-primary font-semibold"
                  : "text-muted-foreground"
              }`}
            >
              {done ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : current ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Circle className="h-3 w-3" />
              )}
              {s.label}
            </div>
            {i < STEPS.length, 1 && (
              <div className={`h-px w-3 ${i < activeIdx ? "bg-emerald-400" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default PayoutTimeline;
