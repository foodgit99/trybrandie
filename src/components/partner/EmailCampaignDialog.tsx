import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import { LEAD_STATUS_OPTIONS } from "@/lib/partnerLeadStatus";
import { checkInboxPlacement } from "@/lib/inboxPlacement";

export interface EmailCampaign {
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

/** Advisory panel: flags copy that mailbox providers classify as promotional. */
export function InboxPlacementHints({ subject, body }: { subject: string; body: string }) {
  const issues = checkInboxPlacement(subject, body);

  if (!subject.trim() && !body.trim()) return null;

  if (issues.length === 0) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-3">
        <Inbox className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <p className="text-xs text-muted-foreground">
          This reads like a personal message — the best chance at the primary inbox. Placement is
          still decided by each recipient's mail provider.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" />
        <p className="text-xs font-medium">
          {issues.length} {issues.length === 1 ? "signal" : "signals"} that route mail to the
          Promotions tab
        </p>
      </div>
      <ul className="space-y-1 pl-6">
        {issues.map((i, idx) => (
          <li key={idx} className="list-disc text-xs text-muted-foreground">
            <span className="capitalize">{i.field}</span>: {i.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Sends (or test-sends) a partner email campaign. Returns true when it went out. */
export async function sendEmailCampaign(id: string, test: boolean) {
  const { data: sessionData } = await supabase.auth.getSession();
  const email = sessionData?.session?.user?.email;
  const { data, error } = await supabase.functions.invoke("partner-campaign-send", {
    body: { campaign_id: id, ...(test ? { test_recipient: email } : {}) },
    headers: { Authorization: `Bearer ${sessionData?.session?.access_token}` },
  });

  const err = error || (data as any)?.error;
  if (err) {
    const message =
      (data as any)?.error === "no_recipients"
        ? "No leads match this audience yet."
        : String((data as any)?.error || error?.message);
    return { ok: false as const, message };
  }
  return {
    ok: true as const,
    delivered: (data as any)?.delivered ?? 0,
    recipients: (data as any)?.recipients ?? 0,
  };
}

/**
 * Composer for a partner email campaign. Creates or edits a row in
 * `partner_campaigns`; used from the unified Campaigns tab.
 */
export default function EmailCampaignDialog({
  open,
  partnerId,
  campaign,
  prefill,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  partnerId: string;
  /** Existing campaign to edit; omit to create a new one. */
  campaign?: EmailCampaign | null;
  /** Seed values when the email is added to an existing landing page. */
  prefill?: { name?: string; subject?: string; body?: string };
  onOpenChange: (v: boolean) => void;
  onSaved: (campaign: EmailCampaign) => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({ ...blank });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (campaign) {
      setForm({
        name: campaign.name,
        subject: campaign.subject,
        preheader: campaign.preheader || "",
        body: campaign.body,
        statuses: Array.isArray(campaign.audience?.statuses) ? campaign.audience.statuses : [],
        scheduled_for: campaign.scheduled_for ? campaign.scheduled_for.slice(0, 16) : "",
      });
    } else {
      setForm({
        ...blank,
        name: prefill?.name || "",
        subject: prefill?.subject || "",
        body: prefill?.body || blank.body,
      });
    }
  }, [open, campaign?.id, prefill?.name, prefill?.subject]);

  const toggleStatus = (value: string) =>
    setForm((f) => ({
      ...f,
      statuses: f.statuses.includes(value)
        ? f.statuses.filter((s) => s !== value)
        : [...f.statuses, value],
    }));

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

    const { data, error } = campaign
      ? await supabase.from("partner_campaigns").update(payload).eq("id", campaign.id).select().single()
      : await supabase.from("partner_campaigns").insert(payload).select().single();

    setSaving(false);
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: campaign ? "Campaign updated" : "Campaign created" });
    onSaved(data as EmailCampaign);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{campaign ? "Edit email" : "New email"}</DialogTitle>
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
            <Input value={form.preheader} onChange={(e) => setForm({ ...form, preheader: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Message</Label>
            <Textarea rows={8} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            <p className="text-xs text-muted-foreground">
              Tokens: <code>{"{{first_name}}"}</code>, <code>{"{{credits}}"}</code>,{" "}
              <code>{"{{referral_link}}"}</code>.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Audience</Label>
            <p className="text-xs text-muted-foreground">Leave everything unchecked to email every lead.</p>
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
          <Button variant="ghost" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="rounded-xl" onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
