import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Share2, MessageCircle, Download, Copy } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { rpc, pnError } from "../api";
import { platformLabel } from "../types";
import { formatNgn } from "../services/profile";
import { canShareFiles, fetchAsFile, fileNameFor, nativeShare, redirectUrl, shareText, whatsappUrl } from "../services/share";
import ProofForm from "./ProofForm";

export interface PublishTarget {
  creative_id: string;
  campaign_code: string;
  campaign_name: string;
  brand_name: string;
  caption: string | null;
  media_type: "image" | "video";
  mediaUrl: string | null;
  platforms: string[];
  base_fee_ngn: number;
  action_bonus_ngn: number;
  commission_pct: number;
}

type Step = "choose" | "share" | "proof";

export default function PublishSheet({ target, open, onOpenChange }: { target: PublishTarget | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [platform, setPlatform] = useState<string>("");
  const [placement, setPlacement] = useState<{ placement_id: string; token: string } | null>(null);
  const [step, setStep] = useState<Step>("choose");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // one idempotency key per creative+platform for this sheet session (safe retries)
  const idem = useMemo(() => crypto.randomUUID(), [target?.creative_id, platform]);

  const reset = (o: boolean) => {
    if (!o) { setPlacement(null); setStep("choose"); setPlatform(""); setNotice(null); }
    onOpenChange(o);
  };

  if (!target) return null;
  const link = placement ? redirectUrl(placement.token) : "";
  const text = shareText(target.caption, link);
  const nav = typeof navigator !== "undefined" ? (navigator as any) : undefined;

  const createLink = async () => {
    const chosen = platform || target.platforms[0];
    if (!chosen) return;
    setPlatform(chosen);
    setBusy(true);
    try {
      const r = await rpc<{ placement_id: string; token: string; status: string }>("publish", { _creative: target.creative_id, _platform: chosen, _idempotency_key: idem });
      setPlacement(r);
      setStep("share");
      qc.invalidateQueries({ queryKey: ["pn"] });
    } catch (e) {
      toast.error(pnError(e));
    } finally {
      setBusy(false);
    }
  };

  const mark = async (method: string) => {
    if (!placement) return;
    try { await rpc("mark_share", { _placement: placement.placement_id, _method: method }); qc.invalidateQueries({ queryKey: ["pn"] }); } catch { /* non-blocking */ }
  };

  const loadFile = async () => {
    if (!target.mediaUrl) throw new Error("Media is not available right now.");
    return fetchAsFile(target.mediaUrl, fileNameFor(target.campaign_code, target.media_type));
  };

  const onNative = async () => {
    setBusy(true);
    setNotice(null);
    try {
      let file: File | null = null;
      try { file = await loadFile(); } catch { file = null; }
      if (!canShareFiles(nav, file)) {
        setNotice(`Your device can't attach the ${target.media_type} in the share sheet. Download it, then post it with the copied caption and link.`);
      }
      const outcome = await nativeShare(nav, { file, text });
      if (outcome === "shared") {
        await mark("native_share");
        setNotice("Share sheet completed. We can't see whether it was posted — upload a screenshot of your post to get paid.");
        setStep("proof");
      } else if (outcome === "cancelled") setNotice("Share cancelled. Nothing was posted. You can try again.");
      else if (outcome === "unsupported") setNotice("Sharing isn't supported in this browser. Use Download and Copy below.");
      else setNotice("Sharing failed. Try again, or use Download and Copy.");
    } finally {
      setBusy(false);
    }
  };

  const onWhatsApp = async () => {
    await mark("whatsapp_link");
    window.open(whatsappUrl(text), "_blank", "noopener,noreferrer");
    setNotice(`WhatsApp opens with your caption and link. To post on Status, download the ${target.media_type} first and attach it there. Opening WhatsApp is not proof of posting.`);
  };

  const onDownload = async () => {
    setBusy(true);
    try {
      const f = await loadFile();
      const href = URL.createObjectURL(f);
      const a = document.createElement("a");
      a.href = href; a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 5_000);
      await mark("download");
    } catch (e) {
      toast.error(pnError(e));
    } finally {
      setBusy(false);
    }
  };

  const onCopy = async () => {
    try { await navigator.clipboard.writeText(text); toast.success("Caption and link copied"); await mark("copy"); }
    catch { toast.error("Copy failed — select the text below and copy it manually."); }
  };

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Publish {target.brand_name}</DialogTitle>
          <DialogDescription>
            {formatNgn(target.base_fee_ngn)} per verified post
            {target.action_bonus_ngn > 0 && ` · ${formatNgn(target.action_bonus_ngn)} per qualified lead`}
            {target.commission_pct > 0 && ` · ${target.commission_pct}% of verified sales`}
          </DialogDescription>
        </DialogHeader>

        {step === "choose" && (
          <div className="space-y-3">
            <Label>Where will you post it?</Label>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Platform">
              {target.platforms.map((p) => (
                <button
                  key={p}
                  role="radio"
                  aria-checked={(platform || target.platforms[0]) === p}
                  onClick={() => setPlatform(p)}
                  className={`rounded-xl border px-3 py-2 text-sm ${(platform || target.platforms[0]) === p ? "border-primary bg-primary/10 font-medium" : ""}`}
                >
                  {platformLabel(p)}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">We create a personal tracking link for you and hold your fee from the campaign budget. You earn only after your post is verified.</p>
            <Button className="w-full" disabled={busy} onClick={createLink}>{busy ? "Preparing…" : "Get my link"}</Button>
          </div>
        )}

        {step !== "choose" && placement && (
          <div className="space-y-3">
            <div className="rounded-xl bg-muted p-3 text-xs break-all" aria-label="Caption and link">{text}</div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="default" onClick={onNative} disabled={busy}><Share2 className="mr-1 h-4 w-4" aria-hidden />Share</Button>
              <Button variant="outline" onClick={onWhatsApp}><MessageCircle className="mr-1 h-4 w-4" aria-hidden />WhatsApp</Button>
              <Button variant="outline" onClick={onDownload} disabled={busy}><Download className="mr-1 h-4 w-4" aria-hidden />Download {target.media_type}</Button>
              <Button variant="outline" onClick={onCopy}><Copy className="mr-1 h-4 w-4" aria-hidden />Copy text</Button>
            </div>
            {notice && <p role="status" className="rounded-lg border p-2 text-xs">{notice}</p>}
            <p className="text-xs text-muted-foreground">
              Posting is done by you on {platformLabel(platform)}. Brandie never posts for you. After posting, upload proof so we can verify it.
            </p>
            {step === "share" && <Button variant="secondary" className="w-full" onClick={() => setStep("proof")}>I've posted — add proof</Button>}
            {step === "proof" && <ProofForm placementId={placement.placement_id} onDone={() => reset(false)} />}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
