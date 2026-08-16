import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Mail, Plus, Send, Trash2, Users, Inbox, AlertTriangle } from "lucide-react";
import { LEAD_STATUS_OPTIONS } from "@/lib/partnerLeadStatus";
import PartnerCampaignSendsDialog from "./PartnerCampaignSendsDialog";
import { checkInboxPlacement } from "@/lib/inboxPlacement";

interface Campaign {
  id: string;
  name: string;
  subject: string;
  preheader: string | null;
  body: string;
  audience: any;
  status: string;
  scheduled_for: string | null;
  sent_at: string | null;
  recipients_count: number;
  delivered_count: number;
}

const blank = {
  name: "",
  subject: "",
  preheader: "",
  body: "Hi {{first_name}},\n\n",
  statuses: [] as string[],
  scheduled_for: "",
};

export default function PartnerCampaignsPanel({ partnerId }: { partnerId: string }) {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...blank });
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [recipientsFor, setRecipientsFor] = useState<Campaign | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("partner_campaigns")
      .select("*")
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false });
    setCampaigns((data as Campaign[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [partnerId]);

  const startNew = () => {
    setEditingId(null);
    setForm({ ...blank });
    setOpen(true);
  };

  const startEdit = (c: Campaign) => {
    setEditingId(c.id);
    setForm({
      name: c.name,
      subject: c.subject,
      preheader: c.preheader || "",
      body: c.body,
      statuses: Array.isArray(c.audience?.statuses) ? c.audience.statuses : [],
      scheduled_for: c.scheduled_for ? c.scheduled_for.slice(0, 16) : "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.subject.trim()) {
      toast({ title: "Add a name and subject", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      partner_id: partnerId,
      name: form.name.trim(),
      subject: form.subject.trim(),
      preheader: form.preheader.trim() || null,
      body: form.body,
      audience: { statuses: form.statuses },
      scheduled_for: form.scheduled_for ? new Date(form.scheduled_for).toISOString() : null,
      status: form.scheduled_for ? "scheduled" : "draft",
    };

    const { error } = editingId
      ? await supabase.from("partner_campaigns").update(payload).eq("id", editingId)
      : await supabase.from("partner_campaigns").insert(payload);

    setSaving(false);
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return;
    }
    setOpen(false);
    toast({ title: editingId ? "Campaign updated" : "Campaign created" });
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("partner_campaigns").delete().eq("id", id);
    load();
  };

  const send = async (id: string, test = false) => {
    setSendingId(id);
    const { data: sessionData } = await supabase.auth.getSession();
    const email = sessionData?.session?.user?.email;
    const { data, error } = await supabase.functions.invoke("partner-campaign-send", {
      body: { campaign_id: id, ...(test ? { test_recipient: email } : {}) },
      headers: { Authorization: `Bearer ${sessionData?.session?.access_token}` },
    });
    setSendingId(null);

    const err = error || (data as any)?.error;
    if (err) {
      const msg = (data as any)?.error === "no_recipients" ? "No leads match this audience yet." : String((data as any)?.error || error?.message);
      toast({ title: "Send failed", description: msg, variant: "destructive" });
      return;
    }
    toast({
      title: test ? "Test sent to you" : "Campaign sent",
      description: `${(data as any)?.delivered ?? 0} of ${(data as any)?.recipients ?? 0} delivered`,
    });
    load();
  };

  const toggleStatus = (value: string) => {
    setForm((f) => ({
      ...f,
      statuses: f.statuses.includes(value) ? f.statuses.filter((s) => s !== value) : [...f.statuses, value],
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Email your attributed leads. Use tokens like <code>{"{{first_name}}"}</code>,{" "}
          <code>{"{{credits}}"}</code> and <code>{"{{referral_link}}"}</code>.
        </p>
        <Button className="rounded-xl gap-2" onClick={startNew}>
          <Plus className="h-4 w-4" /> New campaign
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading campaigns
        </div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center space-y-2">
          <Mail className="h-5 w-5 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No campaigns yet. Create your first one.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <div key={c.id} className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{c.name}</p>
                  <p className="text-sm text-muted-foreground truncate">{c.subject}</p>
                </div>
                <Badge variant="secondary" className="rounded-full border-0 capitalize">
                  {c.status}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>
                  Audience:{" "}
                  {Array.isArray(c.audience?.statuses) && c.audience.statuses.length
                    ? c.audience.statuses.join(", ")
                    : "all leads"}
                </span>
                {c.sent_at && <span>· {c.delivered_count} delivered</span>}
                {c.scheduled_for && c.status === "scheduled" && (
                  <span>· sends {new Date(c.scheduled_for).toLocaleString()}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => startEdit(c)}>
                  Edit
                </Button>
                {["sent", "sending", "failed"].includes(c.status) && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl gap-2"
                    onClick={() => setRecipientsFor(c)}
                  >
                    <Users className="h-3.5 w-3.5" /> View recipients
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl"
                  disabled={sendingId === c.id}
                  onClick={() => send(c.id, true)}
                >
                  Send test
                </Button>
                <Button
                  size="sm"
                  className="rounded-xl gap-2"
                  disabled={sendingId === c.id || c.status === "sent"}
                  onClick={() => send(c.id)}
                >
                  {sendingId === c.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  {c.status === "sent" ? "Sent" : "Send now"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-xl text-muted-foreground"
                  onClick={() => remove(c.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit campaign" : "New campaign"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Campaign name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Preview text</Label>
              <Input
                value={form.preheader}
                onChange={(e) => setForm({ ...form, preheader: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Message</Label>
              <Textarea
                rows={8}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Audience</Label>
              <p className="text-xs text-muted-foreground">
                Leave everything unchecked to email every lead.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {LEAD_STATUS_OPTIONS.map((s) => (
                  <label key={s.value} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.statuses.includes(s.value)}
                      onCheckedChange={() => toggleStatus(s.value)}
                    />
                    {s.label}
                  </label>
                ))}
              </div>
            </div>
            <InboxPlacementHints subject={form.subject} body={form.body} />
            <div className="space-y-1.5">
              <Label>Schedule (optional)</Label>
              <Input
                type="datetime-local"
                value={form.scheduled_for}
                onChange={(e) => setForm({ ...form, scheduled_for: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" className="rounded-xl" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button className="rounded-xl" onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PartnerCampaignSendsDialog
        campaignId={recipientsFor?.id ?? null}
        campaignName={recipientsFor?.name}
        onClose={() => setRecipientsFor(null)}
      />
    </div>
  );
}
