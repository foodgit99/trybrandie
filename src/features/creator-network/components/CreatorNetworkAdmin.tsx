import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ConfirmDialog, Section, Stat, StatusPill } from "./ui";
import EntityTable from "./EntityTable";
import { CN_ROLES, humanize, type Row } from "../types";
import { cnTable, friendlyError } from "../api/db";

/**
 * Admin console for Creator Network. Works even while the flag is OFF
 * (Brandie admins only) so the module can be configured before launch.
 */
export default function CreatorNetworkAdmin() {
  const qc = useQueryClient();
  const db = supabase as any;
  const settings = useQuery({ queryKey: ["cn-admin", "settings"], queryFn: async () => (await db.from("creator_network_settings").select("*").maybeSingle()).data });
  const members = useQuery({
    queryKey: ["cn-admin", "members"],
    queryFn: async () => {
      const { data } = await db.from("creator_network_members").select("*").order("created_at", { ascending: false });
      const ids = [...new Set((data ?? []).map((m: any) => m.user_id))];
      const { data: profs } = ids.length ? await db.from("profiles").select("user_id, full_name, contact_email").in("user_id", ids) : { data: [] };
      return (data ?? []).map((m: any) => ({ ...m, profile: (profs ?? []).find((p: any) => p.user_id === m.user_id) }));
    },
  });
  const enabled = !!settings.data?.enabled;
  const stats = useQuery({
    queryKey: ["cn-admin", "stats", enabled],
    enabled,
    queryFn: async () => {
      const count = async (t: string, f?: (q: any) => any) => {
        let q = cnTable(t as any).select("id", { count: "exact", head: true });
        if (f) q = f(q);
        return (await q).count ?? 0;
      };
      return {
        creators: await count("creators"),
        licences: await count("licences"),
        safety: await count("brand_safety_reviews"),
        pendingPayouts: await count("earnings", (q) => q.eq("status", "Pending")),
        failed: await count("ai_runs", (q) => q.eq("status", "Failed")),
        test: (await Promise.all(["creators", "opportunities", "sales", "tasks"].map((t) => count(t, (q) => q.eq("is_test", true))))).reduce((a, b) => a + b, 0),
      };
    },
  });
  const activity = useQuery({ queryKey: ["cn-admin", "activity", enabled], enabled, queryFn: async () => (await cnTable("activity_log").select("*").order("created_at", { ascending: false }).limit(50)).data ?? [] });

  const [confirm, setConfirm] = useState<null | boolean>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("research");
  const [removing, setRemoving] = useState<Row | null>(null);

  const setFlag = async (v: boolean) => {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await db.from("creator_network_settings").update({ enabled: v, updated_at: new Date().toISOString(), updated_by: u.user?.id }).eq("id", true);
    if (error) return toast.error(friendlyError(error));
    toast.success(`Creator Network ${v ? "enabled" : "disabled"}`);
    qc.invalidateQueries();
  };

  const addMember = async () => {
    const { data: prof } = await db.from("profiles").select("user_id").ilike("contact_email", email.trim()).maybeSingle();
    if (!prof) return toast.error("No Brandie user with that email.");
    const { data: u } = await supabase.auth.getUser();
    const { error } = await db.from("creator_network_members").insert({ user_id: prof.user_id, role, created_by: u.user?.id });
    if (error) return toast.error(friendlyError(error));
    setEmail("");
    toast.success("Operator added");
    qc.invalidateQueries({ queryKey: ["cn-admin"] });
  };

  return (
    <div className="space-y-4">
      <Section title="Feature flag — CREATOR_NETWORK_ENABLED" description="Off: routes redirect home, nav entry hidden, all Creator Network data locked by RLS. Rest of Brandie is unaffected.">
        <div className="flex min-h-11 items-center gap-3">
          <Switch id="cn-flag" checked={enabled} onCheckedChange={(v) => setConfirm(v)} disabled={settings.isLoading} />
          <Label htmlFor="cn-flag">{enabled ? "Enabled" : "Disabled"}</Label>
          {enabled && <Button asChild variant="outline" className="min-h-11 ml-auto rounded-xl"><Link to="/creator-network">Open Creator Network</Link></Button>}
        </div>
      </Section>

      <Section title="Operators" description="Brandie admins always have full access. Normal Brandie users never get access automatically.">
        <div className="mb-3 flex flex-wrap gap-2">
          <Input className="min-h-11 max-w-xs" type="email" placeholder="user@email.com" aria-label="Operator email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Select value={role} onValueChange={setRole}><SelectTrigger className="min-h-11 w-44" aria-label="Role"><SelectValue /></SelectTrigger>
            <SelectContent>{CN_ROLES.map((r) => <SelectItem key={r} value={r}>{humanize(r)}</SelectItem>)}</SelectContent></Select>
          <Button className="min-h-11 rounded-xl" disabled={!email} onClick={addMember}>Add operator</Button>
        </div>
        <EntityTable rows={members.data} loading={members.isLoading} empty={{ title: "No operators yet", description: "Only Brandie admins can access Creator Network until you add operators." }}
          columns={[{ key: "who", label: "User", render: (r) => r.profile?.full_name || r.profile?.contact_email || r.user_id },
            { key: "role", label: "Role", render: (r) => humanize(r.role) },
            { key: "x", label: "", render: (r) => <Button size="sm" variant="ghost" className="min-h-11 text-destructive" onClick={() => setRemoving(r)}>Remove</Button> }]} />
      </Section>

      {enabled && (
        <>
          <Section title="Health">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
              <Stat label="Creators" value={stats.data?.creators ?? "…"} /><Stat label="Licences" value={stats.data?.licences ?? "…"} />
              <Stat label="Safety reviews" value={stats.data?.safety ?? "…"} /><Stat label="Earnings pending payout" value={stats.data?.pendingPayouts ?? "…"} />
              <Stat label="Failed AI runs" value={stats.data?.failed ?? "…"} /><Stat label="Test records" value={stats.data?.test ?? "…"} />
            </div>
          </Section>
          <Section title="Audit log (latest 50)">
            <EntityTable rows={activity.data as Row[]} loading={activity.isLoading} empty={{ title: "No activity yet" }}
              columns={[{ key: "created_at", label: "When", render: (r) => new Date(r.created_at).toLocaleString() }, { key: "action", label: "Action", render: (r) => humanize(r.action) },
                { key: "change", label: "Change", render: (r) => `${r.previous_state ?? "—"} → ${r.new_state ?? "—"}` }, { key: "actor_type", label: "Actor" },
                { key: "is_test", label: "", render: (r) => r.is_test ? <StatusPill value="Test" /> : null }]} />
          </Section>
        </>
      )}

      <ConfirmDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm ? "Enable Creator Network?" : "Disable Creator Network?"}
        description={confirm ? "Operators and Brandie admins will see the Creator Network entry and routes." : "All Creator Network routes and data become unavailable immediately. No data is deleted."}
        destructive={confirm === false} confirmLabel={confirm ? "Enable" : "Disable"} onConfirm={() => { setFlag(!!confirm); setConfirm(null); }} />
      <ConfirmDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)} title="Remove operator?" description="They lose this Creator Network role immediately." destructive confirmLabel="Remove"
        onConfirm={async () => { const { error } = await db.from("creator_network_members").delete().eq("id", removing!.id); if (error) toast.error(friendlyError(error)); setRemoving(null); qc.invalidateQueries({ queryKey: ["cn-admin"] }); }} />
    </div>
  );
}
