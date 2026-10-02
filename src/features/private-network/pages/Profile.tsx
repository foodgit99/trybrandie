import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PNLayout, StatusPill } from "../components/PNShell";
import { rpc, usePnAction } from "../api";
import { usePrivateNetwork } from "../hooks/usePrivateNetwork";
import { AGE_BRACKETS, AUDIENCE_AGE_BRACKETS, PLATFORMS, type Publisher } from "../types";
import { parseList, profileCompleteness } from "../services/profile";

type Form = Record<string, string> & { platforms: string; audience_age_brackets: string };
const LISTS = ["languages", "interests", "communities", "industries", "affiliations", "audience_geographies"] as const;
const TEXTS = ["display_name", "occupation", "location_country", "location_state", "location_city", "school", "workplace"] as const;

const toForm = (p: Publisher | null): Form => {
  const f: any = {};
  for (const k of TEXTS) f[k] = (p as any)?.[k] ?? "";
  for (const k of LISTS) f[k] = ((p as any)?.[k] ?? []).join(", ");
  f.age_bracket = p?.age_bracket ?? "";
  f.platforms = (p?.platforms ?? []).join(",");
  f.audience_age_brackets = (p?.audience_age_brackets ?? []).join(",");
  f.audience_size_estimate = p?.audience_size_estimate?.toString() ?? "";
  f.audience_views_estimate = p?.audience_views_estimate?.toString() ?? "";
  f.bank_name = p?.payout_details?.bank_name ?? "";
  f.account_number = p?.payout_details?.account_number ?? "";
  f.account_name = p?.payout_details?.account_name ?? "";
  return f;
};

export default function Profile() {
  const pn = usePrivateNetwork();
  const [f, setF] = useState<Form>(() => toForm(pn.publisher));
  const [code, setCode] = useState("");
  useEffect(() => { setF(toForm(pn.publisher)); }, [pn.publisher?.id, pn.publisher?.status]);
  const set = (k: string, v: string) => setF((o) => ({ ...o, [k]: v }));
  const toggleIn = (k: "platforms" | "audience_age_brackets", v: string) => {
    const cur = f[k] ? f[k].split(",") : [];
    set(k, (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]).join(","));
  };

  const payload = () => {
    const p: any = {};
    for (const k of TEXTS) p[k] = f[k].trim();
    for (const k of LISTS) p[k] = parseList(f[k]);
    p.age_bracket = f.age_bracket;
    p.platforms = f.platforms ? f.platforms.split(",") : [];
    p.audience_age_brackets = f.audience_age_brackets ? f.audience_age_brackets.split(",") : [];
    p.audience_size_estimate = f.audience_size_estimate.replace(/\D/g, "");
    p.audience_views_estimate = f.audience_views_estimate.replace(/\D/g, "");
    p.payout_details = { bank_name: f.bank_name.trim(), account_number: f.account_number.replace(/\D/g, "").slice(0, 10), account_name: f.account_name.trim() };
    return p;
  };
  const preview = profileCompleteness({ ...payload(), audience_size_estimate: f.audience_size_estimate ? Number(f.audience_size_estimate) : null } as any);

  const save = usePnAction(() => rpc("save_profile", { _p: payload() }).then(() => pn.refetch()), "Profile saved");
  const link = usePnAction(() => rpc("submit_creator_link", { _code: code.trim() }).then(() => pn.refetch()), "Sent for review");
  const del = usePnAction(() => rpc("delete_profile").then(() => pn.refetch()), "Your publisher details were deleted");

  const p = pn.publisher;
  const field = (k: string, label: string, hint?: string, props: any = {}) => (
    <div className="space-y-1">
      <Label htmlFor={`pn-${k}`}>{label}</Label>
      <Input id={`pn-${k}`} value={f[k] ?? ""} onChange={(e) => set(k, e.target.value)} {...props} />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );

  return (
    <PNLayout title="Profile">
      <div className="rounded-2xl border bg-card p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Profile {preview.percent}% complete</p>
          {p && <StatusPill tone={p.status === "approved" ? "good" : p.status === "pending" ? "info" : "bad"}>{p.status}</StatusPill>}
        </div>
        <Progress value={preview.percent} aria-label="Profile completeness" />
        <p className="text-[11px] text-muted-foreground">Private. Used only to match you with campaigns; never shown to brands or other people. Everything here is self-reported — estimates are fine.</p>
        {p?.status_reason && p.status !== "approved" && <p className="text-xs">Reviewer note: {p.status_reason}</p>}
      </div>

      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined as any); }}>
        <fieldset className="space-y-3 rounded-2xl border p-3">
          <legend className="px-1 text-sm font-semibold">About you</legend>
          {field("display_name", "Display name")}
          {field("occupation", "Occupation")}
          <div className="grid grid-cols-3 gap-2">{field("location_country", "Country")}{field("location_state", "State")}{field("location_city", "City")}</div>
          <div className="space-y-1">
            <Label htmlFor="pn-age">Age bracket</Label>
            <select id="pn-age" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={f.age_bracket} onChange={(e) => set("age_bracket", e.target.value)}>
              <option value="">Prefer not to say</option>
              {AGE_BRACKETS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <p className="text-[11px] text-muted-foreground">Publishers must be 18 or older.</p>
          </div>
          {field("languages", "Languages", "Separate with commas, e.g. English, Yoruba, Pidgin")}
          {field("interests", "Interests and content categories", "e.g. fashion, food, tech")}
          {field("communities", "Communities / social circles", "Groups you belong to — e.g. church choir, alumni, market traders. Never upload contacts.")}
          {field("industries", "Industries you know")}
          <div className="grid grid-cols-2 gap-2">{field("school", "School (optional)")}{field("workplace", "Workplace (optional)")}</div>
          {field("affiliations", "Other affiliations (optional)")}
        </fieldset>

        <fieldset className="space-y-3 rounded-2xl border p-3">
          <legend className="px-1 text-sm font-semibold">Where you post and who sees it</legend>
          <div className="grid grid-cols-2 gap-2">
            {PLATFORMS.map((pl) => (
              <label key={pl.value} className="flex items-center gap-2 text-sm">
                <Checkbox checked={f.platforms.split(",").includes(pl.value)} onCheckedChange={() => toggleIn("platforms", pl.value)} />{pl.label}
              </label>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {field("audience_size_estimate", "Approx. contacts/followers", "Estimate", { inputMode: "numeric" })}
            {field("audience_views_estimate", "Approx. views per post", "Estimate", { inputMode: "numeric" })}
          </div>
          {field("audience_geographies", "Where your audience lives", "Cities, states or countries — estimate")}
          <div>
            <p className="mb-1 text-sm font-medium">Audience ages (estimate)</p>
            <div className="flex flex-wrap gap-3">
              {AUDIENCE_AGE_BRACKETS.map((a) => (
                <label key={a} className="flex items-center gap-1 text-sm"><Checkbox checked={f.audience_age_brackets.split(",").includes(a)} onCheckedChange={() => toggleIn("audience_age_brackets", a)} />{a}</label>
              ))}
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-3 rounded-2xl border p-3">
          <legend className="px-1 text-sm font-semibold">Payout account</legend>
          {field("bank_name", "Bank")}
          <div className="grid grid-cols-2 gap-2">{field("account_number", "Account number", undefined, { inputMode: "numeric", maxLength: 10 })}{field("account_name", "Account name")}</div>
        </fieldset>

        <Button type="submit" className="w-full" disabled={save.isPending}>{save.isPending ? "Saving…" : p ? "Save changes" : "Create profile"}</Button>
      </form>

      {p && p.status !== "deleted" && (
        <section className="rounded-2xl border p-3 space-y-2" aria-labelledby="cl-h">
          <h2 id="cl-h" className="text-sm font-semibold">Are you also a Brandie creator?</h2>
          <p className="text-xs text-muted-foreground">Optional. Enter the creator code Brandie gave you. A reviewer confirms it; this doesn't give access to creator tools. Status: {p.creator_link_status}</p>
          <div className="flex gap-2">
            <Label htmlFor="pn-code" className="sr-only">Creator code</Label>
            <Input id="pn-code" placeholder="CRT-0001" value={code} onChange={(e) => setCode(e.target.value)} />
            <Button variant="outline" disabled={!code.trim() || link.isPending} onClick={() => link.mutate(undefined as any)}>Submit</Button>
          </div>
        </section>
      )}

      {p && p.status !== "deleted" && (
        <AlertDialog>
          <AlertDialogTrigger asChild><Button variant="ghost" className="w-full text-destructive">Delete my publisher details</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your publisher details?</AlertDialogTitle>
              <AlertDialogDescription>Your profile answers, likes, saves and unshared links are removed. Earnings records stay for accounting.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep</AlertDialogCancel>
              <AlertDialogAction onClick={() => del.mutate(undefined as any)}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </PNLayout>
  );
}
