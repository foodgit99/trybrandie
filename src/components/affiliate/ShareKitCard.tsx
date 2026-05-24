import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Copy, CheckCircle2, Link2, Users2, QrCode } from "lucide-react";

interface Props {
  referralLink: string;
  recruitLink: string;
  recruitedCount: number;
}

function buildLink(base: string, withUtms: boolean, source: string) {
  if (!withUtms) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}utm_source=${source}&utm_medium=affiliate&utm_campaign=brandie_referral`;
}

function qrUrl(text: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(text)}`;
}

const ShareKitCard = ({ referralLink, recruitLink, recruitedCount }: Props) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);
  const [showQr, setShowQr] = useState<"ref" | "recruit" | null>(null);
  const [withUtms, setWithUtms] = useState(false);

  const finalRef = useMemo(() => buildLink(referralLink, withUtms, "share"), [referralLink, withUtms]);
  const finalRecruit = useMemo(() => buildLink(recruitLink, withUtms, "recruit"), [recruitLink, withUtms]);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
    toast({ title: "Copied to clipboard" });
  };

  const shareText = `Join Brandie and grow your brand!`;

  const renderShare = (link: string, key: string, activeQr: "ref" | "recruit") => (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input readOnly value={link} className="font-mono text-xs" />
        <Button
          variant="outline"
          className="rounded-xl shrink-0 gap-2"
          onClick={() => copy(link, key)}
        >
          {copied === key ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">{copied === key ? "Copied" : "Copy"}</span>
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl text-xs"
          onClick={() => {
            const text = encodeURIComponent(`${shareText} ${link}`);
            window.open(`https://wa.me/?text=${text}`, "_blank");
          }}
        >
          WhatsApp
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl text-xs"
          onClick={() => {
            const text = encodeURIComponent(`${shareText} ${link}`);
            window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank");
          }}
        >
          X / Twitter
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl text-xs"
          onClick={() => {
            const subject = encodeURIComponent("Thought you'd like this");
            const body = encodeURIComponent(`${shareText}\n\n${link}`);
            window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
          }}
        >
          Email
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl text-xs gap-1.5"
          onClick={() => setShowQr(showQr === activeQr ? null : activeQr)}
        >
          <QrCode className="h-3.5 w-3.5" />
          {showQr === activeQr ? "Hide QR" : "QR code"}
        </Button>
      </div>
      {showQr === activeQr && (
        <div className="pt-2 flex flex-col items-center gap-2">
          <img
            src={qrUrl(link)}
            alt="QR code for your link"
            className="rounded-xl border border-border bg-white p-2"
            width={200}
            height={200}
          />
          <p className="text-[11px] text-muted-foreground">Right-click → Save image to download</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="rounded-2xl border border-border p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h3 className="font-medium">Share & Recruit</h3>
        <div className="flex items-center gap-2">
          <Label htmlFor="utm-toggle" className="text-xs text-muted-foreground cursor-pointer">
            Add tracking (UTMs)
          </Label>
          <Switch id="utm-toggle" checked={withUtms} onCheckedChange={setWithUtms} />
        </div>
      </div>

      <Tabs defaultValue="referral" className="space-y-4">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="referral" className="gap-1.5">
            <Link2 className="h-3.5 w-3.5" /> Referral link
          </TabsTrigger>
          <TabsTrigger value="recruit" className="gap-1.5">
            <Users2 className="h-3.5 w-3.5" /> Recruitment link
          </TabsTrigger>
        </TabsList>

        <TabsContent value="referral" className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Earn 20% on every new user's first payment, then 5% lifetime.
          </p>
          {renderShare(finalRef, "ref", "ref")}
        </TabsContent>

        <TabsContent value="recruit" className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Recruited affiliates: <span className="font-medium text-foreground">{recruitedCount}</span> · Earn
            5% first + 3% lifetime from each recruit's referrals.
          </p>
          {renderShare(finalRecruit, "recruit", "recruit")}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ShareKitCard;
