import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import {
  Mail, Users, Send, FileText, Workflow, BarChart3, Plus, Upload, Sparkles,
  Trash2, ExternalLink, Lock,
} from "lucide-react";

const ALLOWED_TIERS = new Set(["starter", "creator", "agency", "pro", "growth", "scale"]);

export default function OutboxTab({ brand, userId }: { brand: { id: string; name: string }; userId: string }) {
  const qc = useQueryClient();

  // Subscription gate
  const { data: profile } = useQuery({
    queryKey: ["profile-tier", userId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("subscription_tier").eq("user_id", userId).single();
      return data;
    },
  });
  const tier = (profile?.subscription_tier || "free").toLowerCase();
  const hasAccess = ALLOWED_TIERS.has(tier);

  if (!hasAccess) {
    return (
      <Card className="rounded-2xl border-2 border-dashed">
        <CardContent className="p-8 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <Lock className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Outbox is a subscription feature</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              The autonomous email marketing engine is available on Starter, Creator, and Agency plans. Upgrade to plan, generate, and send branded email campaigns on autopilot.
            </p>
          </div>
          <Button onClick={() => (window.location.href = "/pricing")}>View plans</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-foreground text-background flex items-center justify-center">
          <Mail className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Outbox</h2>
          <p className="text-sm text-muted-foreground">Plan, generate, and send branded email campaigns autonomously.</p>
        </div>
      </div>

      <Tabs defaultValue="broadcasts" className="w-full">
        <TabsList className="w-full grid grid-cols-5 max-w-2xl">
          <TabsTrigger value="broadcasts" className="gap-1.5"><Send className="h-3.5 w-3.5" />Broadcasts</TabsTrigger>
          <TabsTrigger value="contacts" className="gap-1.5"><Users className="h-3.5 w-3.5" />Contacts</TabsTrigger>
          <TabsTrigger value="forms" className="gap-1.5"><FileText className="h-3.5 w-3.5" />Forms</TabsTrigger>
          <TabsTrigger value="journeys" className="gap-1.5"><Workflow className="h-3.5 w-3.5" />Journeys</TabsTrigger>
          <TabsTrigger value="performance" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" />Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="broadcasts" className="mt-4">
          <BroadcastsPanel brandId={brand.id} userId={userId} qc={qc} />
        </TabsContent>
        <TabsContent value="contacts" className="mt-4">
          <ContactsPanel brandId={brand.id} qc={qc} />
        </TabsContent>
        <TabsContent value="forms" className="mt-4">
          <FormsPanel brandId={brand.id} qc={qc} />
        </TabsContent>
        <TabsContent value="journeys" className="mt-4">
          <JourneysPanel brandId={brand.id} qc={qc} />
        </TabsContent>
        <TabsContent value="performance" className="mt-4">
          <PerformancePanel brandId={brand.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------------------- Broadcasts ---------------------------- */
function BroadcastsPanel({ brandId, userId, qc }: any) {
  const [creating, setCreating] = useState(false);
  const [briefOpen, setBriefOpen] = useState<string | null>(null);
  const [testOpen, setTestOpen] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [prompt, setPrompt] = useState("");

  const { data: broadcasts = [], refetch } = useQuery({
    queryKey: ["outbox-broadcasts", brandId],
    queryFn: async () => {
      const { data } = await supabase.from("email_broadcasts")
        .select("*").eq("brand_id", brandId).order("created_at", { ascending: false }).limit(50);
      return data || [];
    },
  });

  const createDraft = async () => {
    setCreating(true);
    try {
      const { data, error } = await supabase.from("email_broadcasts").insert({
        brand_id: brandId, user_id: userId, status: "draft", subject: "Untitled draft",
      }).select("id").single();
      if (error) throw error;
      setBriefOpen(data.id);
      setPrompt("");
      refetch();
    } catch (e: any) {
      toast({ title: "Couldn't create draft", description: e.message, variant: "destructive" });
    } finally { setCreating(false); }
  };

  const generate = async (id: string) => {
    toast({ title: "Generating…", description: "AI is writing your email." });
    const { data, error } = await supabase.functions.invoke("email-marketing-generate", {
      body: { broadcast_id: id, prompt },
    });
    if (error || (data as any)?.error) {
      toast({ title: "Generation failed", description: error?.message || (data as any).error, variant: "destructive" });
      return;
    }
    setBriefOpen(null);
    refetch();
    toast({ title: "Draft ready", description: `Deliverability score: ${(data as any).deliverability_score}` });
  };

  const sendTest = async (id: string) => {
    if (!testEmail) return;
    const { data, error } = await supabase.functions.invoke("email-marketing-send", {
      body: { broadcast_id: id, test_recipient: testEmail },
    });
    if (error || (data as any)?.error) {
      toast({ title: "Test failed", description: error?.message || (data as any).error, variant: "destructive" });
      return;
    }
    toast({ title: "Test sent", description: `Sent to ${testEmail}` });
    setTestOpen(null); setTestEmail("");
  };

  const sendNow = async (id: string) => {
    if (!confirm("Send this broadcast to all subscribed contacts?")) return;
    const { data, error } = await supabase.functions.invoke("email-marketing-send", {
      body: { broadcast_id: id },
    });
    if (error || (data as any)?.error) {
      toast({ title: "Send failed", description: error?.message || (data as any).error, variant: "destructive" });
      return;
    }
    toast({ title: "Broadcast sent", description: `Sent: ${(data as any).sent} / Failed: ${(data as any).failed}` });
    refetch();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this broadcast?")) return;
    await supabase.from("email_broadcasts").delete().eq("id", id);
    refetch();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{broadcasts.length} broadcast{broadcasts.length === 1 ? "" : "s"}</p>
        <Button size="sm" onClick={createDraft} disabled={creating}>
          <Plus className="h-4 w-4 mr-1.5" /> New broadcast
        </Button>
      </div>

      {broadcasts.length === 0 && (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          No broadcasts yet. Click <strong>New broadcast</strong> to draft your first one — Brandie will generate the subject, preheader, and body for you.
        </CardContent></Card>
      )}

      <div className="grid gap-2">
        {broadcasts.map((b: any) => (
          <Card key={b.id} className="rounded-xl">
            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">{b.subject || "Untitled"}</span>
                  <Badge variant="outline" className="text-[10px]">{b.status}</Badge>
                  {b.deliverability_score != null && (
                    <Badge variant="secondary" className="text-[10px]">Score {b.deliverability_score}</Badge>
                  )}
                </div>
                {b.preheader && <p className="text-xs text-muted-foreground mt-0.5 truncate">{b.preheader}</p>}
                <p className="text-[11px] text-muted-foreground mt-1">
                  {b.recipients_count} recipients · {b.opens_count} opens · {b.clicks_count} clicks
                </p>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => setBriefOpen(b.id)}><Sparkles className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="outline" onClick={() => setTestOpen(b.id)}>Test</Button>
                {b.status !== "sent" && b.body_md && (
                  <Button size="sm" onClick={() => sendNow(b.id)}><Send className="h-3.5 w-3.5 mr-1" />Send</Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => remove(b.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!briefOpen} onOpenChange={(o) => !o && setBriefOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Generate email</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Optional brief (what should this email accomplish?)</Label>
            <Textarea rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Announce our new tomato curry sauce and invite subscribers to pre-order before Friday." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBriefOpen(null)}>Cancel</Button>
            <Button onClick={() => briefOpen && generate(briefOpen)}><Sparkles className="h-4 w-4 mr-1.5" />Generate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!testOpen} onOpenChange={(o) => !o && setTestOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send test email</DialogTitle></DialogHeader>
          <Input type="email" placeholder="you@example.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestOpen(null)}>Cancel</Button>
            <Button onClick={() => testOpen && sendTest(testOpen)}>Send test</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------------------- Contacts ---------------------------- */
function ContactsPanel({ brandId, qc }: any) {
  const [importOpen, setImportOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");

  const { data: contacts = [], refetch } = useQuery({
    queryKey: ["outbox-contacts", brandId],
    queryFn: async () => {
      const { data } = await supabase.from("marketing_contacts")
        .select("*").eq("brand_id", brandId).order("created_at", { ascending: false }).limit(500);
      return data || [];
    },
  });

  const stats = useMemo(() => {
    const total = contacts.length;
    const subscribed = contacts.filter((c: any) => c.status === "subscribed").length;
    const unsub = contacts.filter((c: any) => c.status === "unsubscribed").length;
    return { total, subscribed, unsub };
  }, [contacts]);

  const importCsv = async () => {
    const lines = csv.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const rows: any[] = [];
    for (const line of lines) {
      const [emailRaw, nameRaw] = line.split(",").map(s => s?.trim());
      if (!emailRaw || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailRaw)) continue;
      rows.push({ brand_id: brandId, email: emailRaw.toLowerCase(), full_name: nameRaw || null, status: "subscribed", source: "csv_import", consent_at: new Date().toISOString() });
    }
    if (!rows.length) { toast({ title: "No valid emails found", variant: "destructive" }); return; }
    const { error } = await supabase.from("marketing_contacts").upsert(rows, { onConflict: "brand_id,email" });
    if (error) { toast({ title: "Import failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: `Imported ${rows.length} contacts` });
    setCsv(""); setImportOpen(false); refetch();
  };

  const addOne = async () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail)) { toast({ title: "Invalid email", variant: "destructive" }); return; }
    const { error } = await supabase.from("marketing_contacts").upsert({
      brand_id: brandId, email: newEmail.toLowerCase(), full_name: newName || null,
      status: "subscribed", source: "manual", consent_at: new Date().toISOString(),
    }, { onConflict: "brand_id,email" });
    if (error) { toast({ title: "Add failed", description: error.message, variant: "destructive" }); return; }
    setNewEmail(""); setNewName(""); setAddOpen(false); refetch();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this contact?")) return;
    await supabase.from("marketing_contacts").delete().eq("id", id);
    refetch();
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Card><CardContent className="p-3 text-center"><div className="text-2xl font-semibold">{stats.total}</div><div className="text-xs text-muted-foreground">Total</div></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><div className="text-2xl font-semibold text-emerald-600">{stats.subscribed}</div><div className="text-xs text-muted-foreground">Subscribed</div></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><div className="text-2xl font-semibold text-muted-foreground">{stats.unsub}</div><div className="text-xs text-muted-foreground">Unsubscribed</div></CardContent></Card>
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1" />Add</Button>
        <Button size="sm" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4 mr-1" />Import CSV</Button>
      </div>

      <div className="border rounded-xl divide-y max-h-[480px] overflow-y-auto">
        {contacts.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No contacts yet. Import a CSV or share a signup form.</div>}
        {contacts.map((c: any) => (
          <div key={c.id} className="flex items-center justify-between p-3 text-sm">
            <div className="min-w-0">
              <div className="font-medium truncate">{c.email}</div>
              {c.full_name && <div className="text-xs text-muted-foreground truncate">{c.full_name}</div>}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={c.status === "subscribed" ? "default" : "outline"} className="text-[10px]">{c.status}</Badge>
              <Button size="sm" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Import contacts (CSV)</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Paste one contact per line, format: <code>email,name</code>. Only valid emails are imported. By importing, you confirm these contacts have consented to receive email from you.</p>
          <Textarea rows={10} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={"jane@example.com,Jane Doe\njohn@example.com,John"} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
            <Button onClick={importCsv}>Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add contact</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Input type="email" placeholder="email@example.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            <Input placeholder="Full name (optional)" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={addOne}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------------------- Forms ---------------------------- */
function FormsPanel({ brandId, qc }: any) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [headline, setHeadline] = useState("Join our list");
  const [doubleOptIn, setDoubleOptIn] = useState(true);

  const { data: forms = [], refetch } = useQuery({
    queryKey: ["outbox-forms", brandId],
    queryFn: async () => {
      const { data } = await supabase.from("email_signup_forms").select("*").eq("brand_id", brandId).order("created_at", { ascending: false });
      return data || [];
    },
  });

  const create = async () => {
    const slug = `${brandId.slice(0, 6)}-${Math.random().toString(36).slice(2, 8)}`;
    const { error } = await supabase.from("email_signup_forms").insert({
      brand_id: brandId, slug, headline, double_opt_in: doubleOptIn,
    });
    if (error) { toast({ title: "Create failed", description: error.message, variant: "destructive" }); return; }
    setOpen(false); setHeadline("Join our list"); refetch();
  };

  const projectRef = (import.meta.env.VITE_SUPABASE_URL || "").match(/https:\/\/([^.]+)/)?.[1];
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />New form</Button>
      </div>
      {forms.length === 0 && <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No signup forms yet. Create one to start collecting subscribers.</CardContent></Card>}
      <div className="grid gap-2">
        {forms.map((f: any) => {
          const endpoint = `https://${projectRef}.functions.supabase.co/email-marketing-signup`;
          return (
            <Card key={f.id} className="rounded-xl">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="font-medium">{f.headline}</div>
                    <div className="text-xs text-muted-foreground">/{f.slug} · double opt-in: {f.double_opt_in ? "on" : "off"}</div>
                  </div>
                  <Badge variant={f.is_active ? "default" : "outline"}>{f.is_active ? "active" : "paused"}</Badge>
                </div>
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">Embed snippet</summary>
                  <pre className="mt-2 p-2 bg-muted rounded overflow-x-auto text-[10px]">{`<form onsubmit="fetch('${endpoint}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({form_slug:'${f.slug}',email:this.email.value})}).then(()=>alert('Thanks!'));return false;">
  <input name="email" type="email" required placeholder="Your email" />
  <button>Subscribe</button>
</form>`}</pre>
                </details>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New signup form</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Headline</Label><Input value={headline} onChange={(e) => setHeadline(e.target.value)} /></div>
            <label className="flex items-center justify-between"><span className="text-sm">Require double opt-in (recommended)</span><Switch checked={doubleOptIn} onCheckedChange={setDoubleOptIn} /></label>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={create}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------------------- Journeys ---------------------------- */
function JourneysPanel({ brandId, qc }: any) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Welcome series");
  const [trigger, setTrigger] = useState<"signup" | "tag_added" | "inactivity">("signup");

  const { data: journeys = [], refetch } = useQuery({
    queryKey: ["outbox-journeys", brandId],
    queryFn: async () => {
      const { data } = await supabase.from("marketing_journeys").select("*,marketing_journey_steps(id)").eq("brand_id", brandId).order("created_at", { ascending: false });
      return data || [];
    },
  });

  const create = async () => {
    const { error } = await supabase.from("marketing_journeys").insert({
      brand_id: brandId, name, trigger_type: trigger,
    });
    if (error) { toast({ title: "Create failed", description: error.message, variant: "destructive" }); return; }
    setOpen(false); refetch();
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("marketing_journeys").update({ is_active: active }).eq("id", id);
    refetch();
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />New journey</Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Journeys auto-send a sequence of emails based on a trigger (e.g. new signup). Add steps after creating — each step waits N minutes, then sends.
      </p>
      {journeys.length === 0 && <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No journeys yet.</CardContent></Card>}
      <div className="grid gap-2">
        {journeys.map((j: any) => (
          <Card key={j.id} className="rounded-xl">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div>
                <div className="font-medium">{j.name}</div>
                <div className="text-xs text-muted-foreground">Trigger: {j.trigger_type} · {j.marketing_journey_steps?.length || 0} steps</div>
              </div>
              <Switch checked={j.is_active} onCheckedChange={(v) => toggleActive(j.id, v)} />
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New journey</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div>
              <Label>Trigger</Label>
              <select className="w-full mt-1 border rounded-md p-2 bg-background" value={trigger} onChange={(e) => setTrigger(e.target.value as any)}>
                <option value="signup">When a contact subscribes</option>
                <option value="tag_added">When a tag is added</option>
                <option value="inactivity">After period of inactivity</option>
              </select>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={create}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------------------- Performance ---------------------------- */
function PerformancePanel({ brandId }: { brandId: string }) {
  const { data: stats } = useQuery({
    queryKey: ["outbox-perf", brandId],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();
      const { data: broadcasts } = await supabase.from("email_broadcasts")
        .select("recipients_count,opens_count,clicks_count,unsubs_count,subject,sent_at")
        .eq("brand_id", brandId).eq("status", "sent").gte("sent_at", since)
        .order("sent_at", { ascending: false });
      const sum = (broadcasts || []).reduce((a, b: any) => ({
        recipients: a.recipients + (b.recipients_count || 0),
        opens: a.opens + (b.opens_count || 0),
        clicks: a.clicks + (b.clicks_count || 0),
        unsubs: a.unsubs + (b.unsubs_count || 0),
      }), { recipients: 0, opens: 0, clicks: 0, unsubs: 0 });
      return { broadcasts: broadcasts || [], sum };
    },
  });

  const openRate = stats && stats.sum.recipients ? Math.round((stats.sum.opens / stats.sum.recipients) * 100) : 0;
  const clickRate = stats && stats.sum.recipients ? Math.round((stats.sum.clicks / stats.sum.recipients) * 100) : 0;
  const unsubRate = stats && stats.sum.recipients ? Math.round((stats.sum.unsubs / stats.sum.recipients) * 1000) / 10 : 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Card><CardContent className="p-3 text-center"><div className="text-2xl font-semibold">{stats?.sum.recipients ?? 0}</div><div className="text-xs text-muted-foreground">Recipients (30d)</div></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><div className="text-2xl font-semibold">{openRate}%</div><div className="text-xs text-muted-foreground">Open rate</div></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><div className="text-2xl font-semibold">{clickRate}%</div><div className="text-xs text-muted-foreground">Click rate</div></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><div className="text-2xl font-semibold">{unsubRate}%</div><div className="text-xs text-muted-foreground">Unsub rate</div></CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Recent broadcasts</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(stats?.broadcasts || []).length === 0 && <p className="text-sm text-muted-foreground">No sent broadcasts in the last 30 days.</p>}
          {(stats?.broadcasts || []).map((b: any, i: number) => (
            <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
              <div className="truncate flex-1">{b.subject}</div>
              <div className="text-xs text-muted-foreground tabular-nums">{b.opens_count}/{b.recipients_count} opens</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
