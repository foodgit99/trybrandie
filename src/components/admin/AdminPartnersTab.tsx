import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAccessToken } from "@/lib/authStore";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Handshake, Copy, Loader2 } from "lucide-react";
import PartnerDetailDialog from "./PartnerDetailDialog";


export async function adminActionCall(payload: Record<string, unknown>) {
  const accessToken = await getAccessToken();
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-action`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || json?.error) throw new Error(json?.error || "Request failed");
  return json;
}

interface Partner {
  id: string;
  name: string;
  slug: string;
  partner_type: string;
  status: string;
  commission_first_pct: number;
  commission_recurring_pct: number;
  email: string | null;
  leads: number;
  paid: number;
  revenue: number;
  link_code: string;
  link_active: boolean;
  clicks: number;
}

const NGN = (n: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(
    Number(n || 0),
  );

export default function AdminPartnersTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [openPartner, setOpenPartner] = useState<string | null>(null);


  const { data, isLoading } = useQuery({
    queryKey: ["admin-partners"],
    queryFn: async () => (await adminActionCall({ operation: "partner_list" })).partners as Partner[],
  });

  const slugMutation = useMutation({
    mutationFn: (vars: { partner_id: string; slug?: string; active?: boolean }) =>
      adminActionCall({ operation: "partner_set_slug", data: vars }),
    onSuccess: () => {
      toast.success("Partner link updated");
      qc.invalidateQueries({ queryKey: ["admin-partners"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const statusMutation = useMutation({
    mutationFn: (vars: { id: string; status: string }) =>
      adminActionCall({ operation: "update", table: "partner_profiles", id: vars.id, data: { status: vars.status } }),
    onSuccess: () => {
      toast.success("Partner status updated");
      qc.invalidateQueries({ queryKey: ["admin-partners"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const copyLink = async (code: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}/?ref=${code}`);
    toast.success("Referral link copied");
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Handshake className="h-5 w-5" />
          Marketing Partners
        </CardTitle>
        <CardDescription>
          Promote a user to partner from the Users tab. Partners get their own CRM at /partner.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading partners
          </div>
        ) : !data?.length ? (
          <p className="text-sm text-muted-foreground py-6">
            No partners yet. Open a user in the Users tab and use "Promote to Partner".
          </p>
        ) : (
          <div className="space-y-4">
            {data.map((p) => (
              <div key={p.id} className="rounded-2xl border p-4 space-y-3">
                <button
                  type="button"
                  onClick={() => setOpenPartner(p.id)}
                  className="w-full text-left space-y-3 rounded-xl transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring p-1 -m-1"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{p.name}</p>
                    <Badge variant="secondary" className="rounded-full border-0 capitalize">
                      {p.partner_type.replace(/_/g, " ")}
                    </Badge>
                    <Badge
                      variant={p.status === "active" ? "default" : "outline"}
                      className="rounded-full capitalize"
                    >
                      {p.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground break-all">{p.email}</span>
                    <span className="ml-auto text-xs text-muted-foreground">View details</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
                    {[
                      ["Clicks", p.clicks],
                      ["Leads", p.leads],
                      ["Paid", p.paid],
                      ["Revenue", NGN(p.revenue)],
                      ["Commission", `${p.commission_first_pct}% / ${p.commission_recurring_pct}%`],
                    ].map(([k, v]) => (
                      <div key={k as string}>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{k}</p>
                        <p className="mt-0.5 tabular-nums">{v}</p>
                      </div>
                    ))}
                  </div>
                </button>


                <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                  <div className="flex-1">
                    <Label className="text-xs">Referral slug</Label>
                    <Input
                      className="rounded-lg mt-1"
                      value={editing[p.id] ?? p.link_code}
                      onChange={(e) => setEditing((s) => ({ ...s, [p.id]: e.target.value }))}
                    />
                  </div>
                  <Button
                    size="sm"
                    className="rounded-lg"
                    disabled={slugMutation.isPending || (editing[p.id] ?? p.link_code) === p.link_code}
                    onClick={() => slugMutation.mutate({ partner_id: p.id, slug: editing[p.id] })}
                  >
                    Save slug
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-lg gap-2" onClick={() => copyLink(p.link_code)}>
                    <Copy className="h-4 w-4" /> Copy link
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-lg"
                    disabled={slugMutation.isPending}
                    onClick={() => slugMutation.mutate({ partner_id: p.id, active: !p.link_active })}
                  >
                    {p.link_active ? "Revoke link" : "Reactivate link"}
                  </Button>
                  <Button
                    size="sm"
                    variant={p.status === "active" ? "destructive" : "default"}
                    className="rounded-lg"
                    disabled={statusMutation.isPending}
                    onClick={() =>
                      statusMutation.mutate({ id: p.id, status: p.status === "active" ? "suspended" : "active" })
                    }
                  >
                    {p.status === "active" ? "Suspend" : "Reactivate"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <PartnerDetailDialog partnerId={openPartner} onClose={() => setOpenPartner(null)} />
      </CardContent>

    </Card>
  );
}
