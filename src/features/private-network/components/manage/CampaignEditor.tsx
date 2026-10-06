import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { pnFrom, pnError, rpc, usePnAction, usePnQuery, signedMedia } from "../../api";
import { AUDIENCE_AGE_BRACKETS, PLATFORMS } from "../../types";
import { formatNgn, parseList } from "../../services/profile";
import { StatusPill } from "../PNShell";
import { usePrivateNetwork } from "../../hooks/usePrivateNetwork";

const empty = {
  name: "", description: "", landing_url: "https://", starts_at: "", ends_at: "", target_platforms: [] as string[], target_languages: "",
  target_geographies: "", target_interests: "", content_category: "", target_age_brackets: [] as string[], min_audience: "", base_fee_ngn: "", action_bonus_ngn: "0",
  conversion_commission_pct: "0", max_placements: "", per_publisher_cap: "1", budget_ngn: "",
};
const toLocal = (s?: string | null) => (s ? new Date(s).toISOString().slice(0, 16) : "");

export function CampaignForm({ brandId, campaign, isTest, onSaved }: { brandId: string; campaign?: any; isTest?: boolean; onSaved: (id: string) => void }) {
  const [f, setF] = useState<any>(empty);
  useEffect(() => {
    if (!campaign) { setF(empty); return; }
    setF({ ...campaign, description: campaign.description ?? "", starts_at: toLocal(campaign.starts_at), ends_at: toLocal(campaign.ends_at),
      target_languages: campaign.target_languages.join(", "), target_geographies: campaign.target_geographies.join(", "),
      target_interests: campaign.target_interests.join(", "), content_category: campaign.content_category ?? "", min_audience: campaign.min_audience?.toString() ?? "",
      max_placements: campaign.max_placements?.toString() ?? "", base_fee_ngn: String(campaign.base_fee_ngn), action_bonus_ngn: String(campaign.action_bonus_ngn),
      conversion_commission_pct: String(campaign.conversion_commission_pct), per_publisher_cap: String(campaign.per_publisher_cap), budget_ngn: String(campaign.budget_ngn) });
  }, [campaign?.id]);
  const editable = !campaign || ["draft", "rejected"].includes(campaign.status);
  const set = (k: string, v: any) => setF((o: any) => ({ ...o, [k]: v }));
  const toggle = (k: string, v: string) => set(k, f[k].includes(v) ? f[k].filter((x: string) => x !== v) : [...f[k], v]);

  const save = usePnAction(async () => {
    const num = (s: string) => (s === "" || s == null ? null : Number(s));
    const row: any = {
      brand_id: brandId, name: f.name.trim(), description: f.description.trim() || null, landing_url: f.landing_url.trim(),
      starts_at: f.starts_at ? new Date(f.starts_at).toISOString() : new Date().toISOString(), ends_at: f.ends_at ? new Date(f.ends_at).toISOString() : null,
      target_platforms: f.target_platforms, target_languages: parseList(f.target_languages), target_geographies: parseList(f.target_geographies),
      target_interests: parseList(f.target_interests), content_category: f.content_category.trim() || null, target_age_brackets: f.target_age_brackets, min_audience: num(f.min_audience),
      base_fee_ngn: num(f.base_fee_ngn) ?? 0, action_bonus_ngn: num(f.action_bonus_ngn) ?? 0, conversion_commission_pct: num(f.conversion_commission_pct) ?? 0,
      max_placements: num(f.max_placements), per_publisher_cap: num(f.per_publisher_cap) ?? 1, budget_ngn: num(f.budget_ngn) ?? 0,
    };
    if (!row.name) throw new Error("Name is required.");
    const { data: u } = await supabase.auth.getUser();
    const q = campaign
      ? pnFrom("campaigns").update(row).eq("id", campaign.id).select("id").single()
      : pnFrom("campaigns").insert({ ...row, owner_user_id: u.user!.id, is_test: !!isTest, record_source: isTest ? "test" : "app" }).select("id").single();
    const { data, error } = await q;
    if (error) throw error;
    onSaved(data.id);
  }, "Campaign saved");

  const field = (k: string, label: string, props: any = {}, hint?: string) => (
    <div className="space-y-1">
      <Label htmlFor={`c-${k}`}>{label}</Label>
      <Input id={`c-${k}`} value={f[k] ?? ""} disabled={!editable} onChange={(e) => set(k, e.target.value)} {...props} />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );

  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined as any); }}>
      {!editable && <p className="rounded-lg bg-muted p-2 text-xs">Only draft or rejected campaigns can be edited. Pause or end it from the actions below.</p>}
      {field("name", "Campaign name")}
      <div className="space-y-1">
        <Label htmlFor="c-desc">Description for publishers</Label>
        <Textarea id="c-desc" rows={2} value={f.description} disabled={!editable} onChange={(e) => set("description", e.target.value)} />
      </div>
      {field("landing_url", "Landing page (https)", { type: "url" }, "Must be on a domain Brandie has approved for this brand.")}
      <div className="grid grid-cols-2 gap-2">{field("starts_at", "Starts", { type: "datetime-local" })}{field("ends_at", "Ends", { type: "datetime-local" })}</div>
      <div>
        <p className="mb-1 text-sm font-medium">Platforms</p>
        <div className="grid grid-cols-2 gap-2">
          {PLATFORMS.map((p) => (
            <label key={p.value} className="flex items-center gap-2 text-sm"><Checkbox disabled={!editable} checked={f.target_platforms.includes(p.value)} onCheckedChange={() => toggle("target_platforms", p.value)} />{p.label}</label>
          ))}
        </div>
      </div>
      {field("target_languages", "Target languages", {}, "Comma separated. Empty = any.")}
      {field("target_geographies", "Target locations", {}, "Comma separated. Empty = any.")}
      {field("target_interests", "Target interests / communities", {}, "Comma separated. Empty = any.")}
      {field("content_category", "Product category", {}, "e.g. fashion, food, finance. Needed when a creator licence restricts categories.")}
      <div>
        <p className="mb-1 text-sm font-medium">Audience ages</p>
        <div className="flex flex-wrap gap-3">
          {AUDIENCE_AGE_BRACKETS.map((a) => <label key={a} className="flex items-center gap-1 text-sm"><Checkbox disabled={!editable} checked={f.target_age_brackets.includes(a)} onCheckedChange={() => toggle("target_age_brackets", a)} />{a}</label>)}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {field("min_audience", "Min. audience size", { inputMode: "numeric" })}
        {field("per_publisher_cap", "Posts per publisher", { inputMode: "numeric" })}
        {field("base_fee_ngn", "Fee per verified post (₦)", { inputMode: "decimal" })}
        {field("action_bonus_ngn", "Bonus per qualified lead (₦)", { inputMode: "decimal" })}
        {field("conversion_commission_pct", "Sale commission (%)", { inputMode: "decimal" })}
        {field("max_placements", "Max total posts", { inputMode: "numeric" })}
        {field("budget_ngn", "Budget (₦)", { inputMode: "decimal" }, "Typing a budget doesn't fund it. Brandie records funding before launch.")}
      </div>
      {editable && <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : campaign ? "Save draft" : "Create draft"}</Button>}
    </form>
  );
}

export function CreativeManager({ campaign }: { campaign: any }) {
  const pn = usePrivateNetwork();
  const editable = ["draft", "rejected", "pending_review", "paused", "active"].includes(campaign.status);
  const creatives = usePnQuery<any[]>(["creatives", campaign.id], async () => {
    const { data, error } = await pnFrom("creatives").select("*").eq("campaign_id", campaign.id).order("created_at");
    if (error) throw error;
    const media = await signedMedia((data ?? []).map((c: any) => c.id)).catch(() => ({}));
    return (data ?? []).map((c: any) => ({ ...c, url: (media as any)[c.id]?.url ?? c.public_media_url }));
  });
  const designs = usePnQuery<any[]>(["designs", campaign.brand_id], async () => {
    const { data } = await (supabase as any).from("designs").select("id,image_url,title,created_at").eq("brand_id", campaign.brand_id).order("created_at", { ascending: false }).limit(24);
    return data ?? [];
  });
  const [caption, setCaption] = useState("");
  const [attest, setAttest] = useState(false);
  const [attestText, setAttestText] = useState("");
  const [busy, setBusy] = useState(false);

  const base = () => ({ campaign_id: campaign.id, caption: caption.trim() || null, rights_attested: attest, rights_attestation: attestText.trim() || null });
  const addDesign = async (d: any) => {
    setBusy(true);
    const { error } = await pnFrom("creatives").insert({ ...base(), media_type: "image", media_source: "brand_design", design_id: d.id });
    setBusy(false);
    if (error) toast.error(pnError(error)); else { toast.success("Creative added for review"); creatives.refetch(); }
  };
  const upload = async (file: File) => {
    const type = file.type.startsWith("video/") ? "video" : file.type.startsWith("image/") ? "image" : null;
    if (!type) return toast.error("Upload an image or a video.");
    setBusy(true);
    try {
      const ext = (file.name.split(".").pop() || (type === "video" ? "mp4" : "jpg")).toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${campaign.brand_id}/${campaign.id}/${crypto.randomUUID()}.${ext}`;
      const { error: up } = await supabase.storage.from("private-network-media").upload(path, file, { contentType: file.type });
      if (up) throw up;
      const { error } = await pnFrom("creatives").insert({ ...base(), media_type: type, media_source: "upload", storage_path: path });
      if (error) throw error;
      toast.success("Creative added for review");
      creatives.refetch();
    } catch (e) { toast.error(pnError(e)); } finally { setBusy(false); }
  };
  const remove = usePnAction(async (id: string) => { const { error } = await pnFrom("creatives").delete().eq("id", id); if (error) throw error; }, "Removed");

  return (
    <div className="space-y-3">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {(creatives.data ?? []).map((c) => (
          <li key={c.id} className="rounded-xl border p-2 space-y-1">
            <div className="aspect-square overflow-hidden rounded-lg bg-muted">
              {c.url ? (c.media_type === "video" ? <video src={c.url} controls className="h-full w-full object-contain" /> : <img src={c.url} alt="" className="h-full w-full object-cover" />) : <p className="p-2 text-xs">No preview</p>}
            </div>
            <div className="flex items-center justify-between gap-1">
              <StatusPill tone={c.status === "approved" ? "good" : c.status === "pending" ? "info" : "bad"}>{c.status}</StatusPill>
              <span className="text-[10px] text-muted-foreground">{c.media_source === "creator_network" ? "Licensed creator" : c.media_source}</span>
            </div>
            {c.review_reason && <p className="text-[11px]">{c.review_reason}</p>}
            {c.status === "pending" && c.media_source !== "creator_network" && <Button size="sm" variant="ghost" onClick={() => remove.mutate(c.id)}>Remove</Button>}
          </li>
        ))}
      </ul>
      {editable && (
        <div className="space-y-2 rounded-xl border p-3">
          <p className="text-sm font-semibold">Add creative</p>
          <Label htmlFor="cr-cap">Caption publishers will post</Label>
          <Textarea id="cr-cap" rows={2} value={caption} onChange={(e) => setCaption(e.target.value)} />
          <label className="flex items-start gap-2 text-xs">
            <Checkbox checked={attest} onCheckedChange={(v) => setAttest(!!v)} />
            <span>I confirm this brand owns or has licensed this content, including any people shown, for redistribution by third-party publishers on the selected platforms.</span>
          </label>
          <Input placeholder="Rights note (optional, e.g. model release ref)" value={attestText} onChange={(e) => setAttestText(e.target.value)} />
          <div className="space-y-1">
            <Label htmlFor="cr-up">Upload image or existing video</Label>
            <Input id="cr-up" type="file" accept="image/*,video/*" disabled={busy || !attest} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </div>
          {(designs.data ?? []).length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium">Or pick a Brandie design</p>
              <div className="grid grid-cols-4 gap-1 sm:grid-cols-6">
                {(designs.data ?? []).map((d) => (
                  <button key={d.id} disabled={busy || !attest} onClick={() => addDesign(d)} className="aspect-square overflow-hidden rounded-md border disabled:opacity-50" aria-label={`Use design ${d.title ?? ""}`}>
                    <img src={d.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            </div>
          )}
          {!attest && <p className="text-[11px] text-muted-foreground">Confirm rights to add creatives.</p>}
          {pn.isOperator && <CnMasterPicker campaign={campaign} onAdded={() => creatives.refetch()} />}
        </div>
      )}
    </div>
  );
}

function CnMasterPicker({ campaign, onAdded }: { campaign: any; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const masters = usePnQuery<any[]>(["cn-masters"], () => rpc("list_cn_masters"), open);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [expires, setExpires] = useState("");
  const [cap, setCap] = useState("");
  const [creatorOk, setCreatorOk] = useState(false);
  const add = usePnAction((m: any) => rpc("add_cn_creative", { _campaign: campaign.id, _job: m.production_job_id, _licence: m.licence_id, _caption: cap || null,
    _rights_platforms: platforms, _rights_expires: expires ? new Date(expires).toISOString() : null, _creator_approval: creatorOk }).then(onAdded), "Licensed master added for review");
  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Add licensed Creator Network master</Button>;
  return (
    <div className="space-y-2 rounded-lg border p-2">
      <p className="text-xs font-semibold">Licensed masters (read-only from Creator Network)</p>
      {masters.isError && <p className="text-xs text-destructive">{pnError(masters.error)}</p>}
      <Input placeholder="Caption" value={cap} onChange={(e) => setCap(e.target.value)} />
      <div className="flex flex-wrap gap-2">{PLATFORMS.map((p) => <label key={p.value} className="flex items-center gap-1 text-xs"><Checkbox checked={platforms.includes(p.value)} onCheckedChange={() => setPlatforms((x) => x.includes(p.value) ? x.filter((y) => y !== p.value) : [...x, p.value])} />{p.label}</label>)}</div>
      <Label htmlFor="cn-exp" className="text-xs">Private-redistribution rights expire</Label>
      <Input id="cn-exp" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
      <label className="flex items-center gap-2 text-xs"><Checkbox checked={creatorOk} onCheckedChange={(v) => setCreatorOk(!!v)} />Creator approval recorded (if the licence requires it)</label>
      <ul className="space-y-1">
        {(masters.data ?? []).map((m) => {
          const ok = m.has_clean_master && m.qa_approved && m.licence_scope === "Commercial" && ["Signed", "Active"].includes(m.licence_status) && m.organic && !m.revoked;
          return (
            <li key={`${m.production_job_id}-${m.licence_id}`} className="flex items-center justify-between gap-2 rounded border p-1 text-xs">
              <span>{m.job_code} · {m.creator_name} · {m.licence_scope}/{m.licence_status}{m.is_test && " · TEST"}{!ok && " · not eligible"}</span>
              <Button size="sm" variant="outline" disabled={!ok || platforms.length === 0} onClick={() => add.mutate(m)}>Add</Button>
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] text-muted-foreground">Watermarked previews and preview-only licences are never eligible. An operator must still confirm explicit private-redistribution rights during review.</p>
    </div>
  );
}

export function CampaignStats({ campaign }: { campaign: any }) {
  const pl = usePnQuery<any[]>(["camp-pl", campaign.id], async () => {
    const { data, error } = await pnFrom("placements").select("status,platform,clicks,leads,conversions").eq("campaign_id", campaign.id);
    if (error) throw error; return data ?? [];
  });
  const rows = pl.data ?? [];
  const sum = (k: string) => rows.reduce((a, r) => a + (r[k] ?? 0), 0);
  const remaining = Number(campaign.budget_ngn) - Number(campaign.budget_reserved_ngn) - Number(campaign.budget_spent_ngn);
  return (
    <dl className="grid grid-cols-3 gap-2 text-center text-xs sm:grid-cols-6">
      {[["Posts", rows.filter((r) => r.status !== "cancelled").length], ["Verified", rows.filter((r) => r.status === "verified").length], ["Clicks", sum("clicks")],
        ["Leads", sum("leads")], ["Sales", sum("conversions")], ["Budget left", formatNgn(remaining)]].map(([l, v]) => (
        <div key={l as string} className="rounded-lg bg-muted p-2"><dt className="text-muted-foreground">{l}</dt><dd className="font-semibold">{v as any}</dd></div>
      ))}
      <div className="col-span-3 text-left text-[11px] text-muted-foreground sm:col-span-6">
        Reserved {formatNgn(campaign.budget_reserved_ngn)} · spent {formatNgn(campaign.budget_spent_ngn)} of {formatNgn(campaign.budget_ngn)} · funding: {campaign.funding_status}{campaign.funding_reference && ` (${campaign.funding_reference})`}
      </div>
    </dl>
  );
}
