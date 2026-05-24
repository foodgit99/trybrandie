import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Copy, CheckCircle2, ImageIcon, FileText } from "lucide-react";
import { SWIPE_POSTS, BANNER_ASSETS, FTC_DISCLOSURE } from "@/lib/affiliateAssets";

interface Props {
  referralLink: string;
}

const MarketingKitTab = ({ referralLink }: Props) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
    toast({ title: "Copied" });
  };

  return (
    <div className="space-y-5">
      {/* Banner kit */}
      <div className="rounded-2xl border border-border p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-primary" />
          <h3 className="font-medium">Banner kit</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Branded graphics you can use on social, in newsletters, or on your website. Right-click any
          preview to save.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {BANNER_ASSETS.map((b) => (
            <div key={b.id} className="rounded-xl border border-border overflow-hidden">
              <div
                className="aspect-square bg-gradient-to-br from-primary/15 via-primary/5 to-background flex items-center justify-center"
                style={{ aspectRatio: b.ratio.replace(":", " / ") }}
              >
                <div className="text-center px-3">
                  <p className="font-serif text-lg tracking-tight">Brandie</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">
                    AI Brand Studio
                  </p>
                </div>
              </div>
              <div className="p-3 space-y-0.5">
                <p className="text-xs font-medium">{b.label}</p>
                <p className="text-[10px] text-muted-foreground">{b.dimensions} · {b.description}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground italic">
          Need custom banners with your face or audience in mind? Generate one in the Brandie studio
          using your affiliate link as the CTA.
        </p>
      </div>

      {/* Swipe copy library */}
      <div className="rounded-2xl border border-border p-5 space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <h3 className="font-medium">Swipe copy library</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Pre-written posts you can copy and paste. <code className="px-1 rounded bg-muted">{"{LINK}"}</code>
          is automatically replaced with your referral link.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SWIPE_POSTS.map((p) => {
            const filled = p.body.split("{LINK}").join(referralLink);
            return (
              <div key={p.id} className="rounded-xl border border-border p-4 space-y-3 bg-muted/20">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium">{p.label}</p>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {p.channel}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-line text-foreground/90">{filled}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl gap-2 w-full"
                  onClick={() => copy(filled, p.id)}
                >
                  {copied === p.id ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copied === p.id ? "Copied" : "Copy"}
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Disclosure */}
      <div className="rounded-2xl border border-border p-5 space-y-3 bg-muted/20">
        <h3 className="font-medium text-sm">Disclosure snippet</h3>
        <p className="text-xs text-muted-foreground">
          For FTC compliance, add this near any affiliate link or post:
        </p>
        <div className="flex items-start gap-2 rounded-xl bg-background border border-border p-3">
          <p className="text-xs italic flex-1">{FTC_DISCLOSURE}</p>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg shrink-0"
            onClick={() => copy(FTC_DISCLOSURE, "disclosure")}
          >
            {copied === "disclosure" ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MarketingKitTab;
