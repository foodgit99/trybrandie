import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Copy, CheckCircle2, ImageIcon, FileText, Download } from "lucide-react";
import {
  SWIPE_POSTS,
  BANNER_ASSETS,
  BANNER_STYLES,
  FTC_DISCLOSURE,
  type BannerStyle,
} from "@/lib/affiliateAssets";

interface Props {
  referralLink: string;
}

async function downloadAsset(url: string, fileName: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

const MarketingKitTab = ({ referralLink }: Props) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);
  const [activeStyle, setActiveStyle] = useState<BannerStyle>("founder");
  const [downloading, setDownloading] = useState<string | null>(null);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
    toast({ title: "Copied" });
  };

  const handleDownload = async (id: string, url: string, fileName: string) => {
    try {
      setDownloading(id);
      await downloadAsset(url, fileName);
      toast({ title: "Banner saved", description: fileName });
    } catch {
      toast({
        title: "Download failed",
        description: "Right-click the image and choose Save instead.",
      });
    } finally {
      setDownloading(null);
    }
  };

  const visibleBanners = BANNER_ASSETS.filter((b) => b.style === activeStyle);
  const activeStyleMeta = BANNER_STYLES.find((s) => s.id === activeStyle);

  return (
    <div className="space-y-5">
      {/* Banner kit */}
      <div className="rounded-2xl border border-border p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-primary" />
          <h3 className="font-medium">Banner kit</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Download a banner, post it with your referral link in the bio or caption. New styles drop monthly.
        </p>

        {/* Style switcher */}
        <div className="flex flex-wrap gap-2">
          {BANNER_STYLES.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveStyle(s.id)}
              className={`px-3 py-1.5 rounded-full text-xs border transition ${
                activeStyle === s.id
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background border-border hover:bg-muted"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        {activeStyleMeta && (
          <p className="text-[11px] text-muted-foreground -mt-1">
            {activeStyleMeta.description}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {visibleBanners.map((b) => (
            <div
              key={b.id}
              className="rounded-xl border border-border overflow-hidden flex flex-col"
            >
              <div
                className="bg-muted/30 flex items-center justify-center overflow-hidden"
                style={{ aspectRatio: b.ratio.replace(":", " / ") }}
              >
                <img
                  src={b.imageUrl}
                  alt={`Brandie ${activeStyleMeta?.label} banner – ${b.label}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="p-3 space-y-2">
                <div>
                  <p className="text-xs font-medium">{b.label}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {b.dimensions} · {b.description}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full rounded-lg gap-2 h-8 text-xs"
                  disabled={downloading === b.id}
                  onClick={() => handleDownload(b.id, b.imageUrl, b.fileName)}
                >
                  <Download className="h-3.5 w-3.5" />
                  {downloading === b.id ? "Saving…" : "Download"}
                </Button>
              </div>
            </div>
          ))}
        </div>
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
