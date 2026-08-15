import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Plus, Trash2, Workflow } from "lucide-react";
import { AUTOMATION_TRIGGERS } from "@/lib/partnerLeadStatus";

interface Automation {
  id: string;
  name: string;
  trigger: string;
  delay_hours: number;
  subject: string;
  body: string;
  active: boolean;
  sent_count: number;
  last_run_at: string | null;
}

const blank = {
  name: "",
  trigger: "new_lead",
  delay_hours: 0,
  subject: "",
  body: "Hi {{first_name}},\n\n",
  active: true,
};

const triggerLabel = (t: string) => AUTOMATION_TRIGGERS.find((x) => x.value === t)?.label || t;

export default function PartnerAutomationsPanel({ partnerId }: { partnerId: string }) {
  const { toast } = useToast();
  const [rules, setRules] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...blank });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("partner_automations")
      .select("*")
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false });
    setRules((data as Automation[]) || []);
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

  const startEdit = (a: Automation) => {
    setEditingId(a.id);
    setForm({
      name: a.name,
      trigger: a.trigger,
      delay_hours: a.delay_hours,
      subject: a.subject,
      body: a.body,
      active: a.active,
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
      trigger: form.trigger,
      delay_hours: Math.max(0, Math.min(720, Number(form.delay_hours) || 0)),
      subject: form.subject.trim(),
      body: form.body,
      active: form.active,
    };
    const { error } = editingId
      ? await supabase.from("partner_automations").update(payload).eq("id", editingId)
      : await supabase.from("partner_automations").insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return;
    }
    setOpen(false);
    toast({ title: editingId ? "Automation updated" : "Automation created" });
    load();
  };

  const toggle = async (a: Automation) => {
    setRules((r) => r.map((x) => (x.id === a.id ? { ...x, active: !a.active } : x)));
    await supabase.from("partner_automations").update({ active: !a.active }).eq("id", a.id);
  };

  const remove = async (id: string) => {
    await supabase.from("partner_automations").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Automations run hourly and each lead only ever receives a given automation once.
        </p>
        <Button className="rounded-xl gap-2" onClick={startNew}>
          <Plus className="h-4 w-4" /> New automation
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading automations
        </div>
      ) : rules.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center space-y-2">
          <Workflow className="h-5 w-5 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No automations yet. Try a welcome email on new leads, or a nudge when credits run low.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((a) => (
            <div key={a.id} className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{a.name}</p>
                  <p className="text-sm text-muted-foreground truncate">{a.subject}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="rounded-full border-0">
                    {a.sent_count} sent
                  </Badge>
                  <Switch checked={a.active} onCheckedChange={() => toggle(a)} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {triggerLabel(a.trigger)}
                {a.delay_hours > 0 ? ` · after ${a.delay_hours}h` : " · immediately"}
                {a.last_run_at ? ` · last checked ${new Date(a.last_run_at).toLocaleString()}` : ""}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => startEdit(a)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-xl text-muted-foreground"
                  onClick={() => remove(a.id)}
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
            <DialogTitle>{editingId ? "Edit automation" : "New automation"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Trigger</Label>
              <select
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                value={form.trigger}
                onChange={(e) => setForm({ ...form, trigger: e.target.value })}
              >
                {AUTOMATION_TRIGGERS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                {AUTOMATION_TRIGGERS.find((t) => t.value === form.trigger)?.hint}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Wait before sending (hours)</Label>
              <Input
                type="number"
                min={0}
                max={720}
                value={form.delay_hours}
                onChange={(e) => setForm({ ...form, delay_hours: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Message</Label>
              <Textarea
                rows={8}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Tokens: {"{{first_name}}"}, {"{{credits}}"}, {"{{designs}}"}, {"{{referral_link}}"}
              </p>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">Turn off to pause without deleting.</p>
              </div>
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
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
    </div>
  );
}
