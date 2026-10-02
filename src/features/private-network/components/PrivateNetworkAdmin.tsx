import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { pnFrom, rpc, usePnAction, usePnQuery } from "../api";
import { usePrivateNetwork } from "../hooks/usePrivateNetwork";

/** Admin-tab rollout controls: one switch + operator roles. */
export default function PrivateNetworkAdmin() {
  const pn = usePrivateNetwork();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("moderator");
  const members = usePnQuery<any[]>(["members"], async () => {
    const { data, error } = await pnFrom("members").select("*").order("created_at");
    if (error) throw error; return data ?? [];
  }, pn.isBrandieAdmin);
  const toggle = usePnAction((v: boolean) => rpc("set_enabled", { _enabled: v }).then(() => pn.refetch()), "Private Network switch updated");
  const member = usePnAction(({ add, e, r }: any) => rpc("set_member", { _email: e, _role: r, _add: add }), "Members updated");

  return (
    <Card>
      <CardHeader><CardTitle>Private Network</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-xl border p-3">
          <div>
            <p className="text-sm font-medium">PRIVATE_NETWORK_ENABLED</p>
            <p className="text-xs text-muted-foreground">Off: hidden everywhere and every server action is refused. Data is kept.</p>
          </div>
          <Switch checked={pn.enabled} disabled={!pn.isBrandieAdmin || toggle.isPending} onCheckedChange={(v) => toggle.mutate(v)} aria-label="Private Network enabled" />
        </div>
        {pn.enabled && <Button asChild variant="outline"><Link to="/private-network/manage">Open operations</Link></Button>}
        <div className="space-y-2">
          <p className="text-sm font-medium">Operators</p>
          <div className="flex flex-wrap gap-2">
            <Input className="max-w-xs" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Operator email" />
            <select aria-label="Role" className="h-10 rounded-md border bg-background px-2 text-sm" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="moderator">moderator</option><option value="finance">finance</option><option value="admin">admin</option>
            </select>
            <Button disabled={!email} onClick={() => member.mutate({ add: true, e: email, r: role })}>Add</Button>
            <Button variant="ghost" disabled={!email} onClick={() => member.mutate({ add: false, e: email, r: role })}>Remove</Button>
          </div>
          <ul className="text-xs text-muted-foreground">{(members.data ?? []).map((m) => <li key={m.id}>{m.user_id} · {m.role}</li>)}</ul>
        </div>
      </CardContent>
    </Card>
  );
}
