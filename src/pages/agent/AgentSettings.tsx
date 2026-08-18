import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getAccessToken } from "@/lib/authStore";
import { useAuth } from "@/hooks/useAuth";
import { useBrand } from "@/hooks/useBrand";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Loader2, Sparkles, KeyRound, Trash2, Copy, Undo2,
} from "lucide-react";
import { toast } from "sonner";

type Mode = "auto" | "confirm" | "off";

const TOOL_GROUPS: { group: string; tools: { name: string; label: string; default: Mode }[] }[] = [
  {
    group: "Research",
    tools: [
      { name: "get_brand_snapshot", label: "Read brand profile", default: "auto" },
      { name: "get_blueprint", label: "Read content blueprint", default: "auto" },
      { name: "get_recent_designs", label: "Read recent designs", default: "auto" },
      { name: "query_holidays", label: "Query upcoming holidays", default: "auto" },
      { name: "query_trends", label: "Query trend intelligence", default: "auto" },
    ],
  },
  {
    group: "Drafting",
    tools: [
      { name: "create_campaign", label: "Create campaigns", default: "confirm" },
      { name: "create_content_pillar", label: "Create content pillars", default: "confirm" },
      { name: "draft_content_idea", label: "Draft content ideas", default: "auto" },
      { name: "update_idea_caption", label: "Edit idea captions", default: "auto" },
    ],
  },
  {
    group: "Scheduling",
    tools: [
      { name: "schedule_idea", label: "Schedule ideas", default: "confirm" },
    ],
  },
  {
    group: "Design generation (costs credits)",
    tools: [
      { name: "enqueue_design_generation", label: "Generate designs", default: "confirm" },
    ],
  },
];

export default function AgentSettings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { brand } = useBrand(user);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [tokens, setTokens] = useState<any[]>([]);
  const [newTokenLabel, setNewTokenLabel] = useState("");
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [actions, setActions] = useState<any[]>([]);
  const [funcBase] = useState(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1`);

  const load = async () => {
    if (!user || !brand?.id) return;
    setLoading(true);
    const [{ data: s }, tokensRes, { data: acts }] = await Promise.all([
      supabase.from("agent_settings").select("*")
        .eq("user_id", user.id).eq("brand_id", brand.id).maybeSingle(),
      authFetch(`${funcBase}/agent-tokens`, { method: "GET" }),
      supabase.from("agent_actions").select("id,tool_name,status,is_reversible,created_at,input")
        .eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
    ]);
    if (!s) {
      const { data: created } = await supabase.from("agent_settings").insert({
        user_id: user.id, brand_id: brand.id,
      }).select("*").single();
      setSettings(created);
    } else {
      setSettings(s);
    }
    const tokensData = await tokensRes.json().catch(() => ({ tokens: [] }));
    setTokens(tokensData.tokens ?? []);
    setActions(acts ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user, brand?.id]);

  const authFetch = async (url: string, init: RequestInit = {}) => {
    const accessToken = await getAccessToken();
    return fetch(url, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        apikey: (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
      },
    });
  };

  const update = (patch: any) => setSettings((s: any) => ({ ...s, ...patch }));

  const save = async () => {
    if (!user || !brand?.id || !settings) return;
    setSaving(true);
    const { error } = await supabase.from("agent_settings").update({
      autonomy_enabled: settings.autonomy_enabled,
      tool_modes: settings.tool_modes ?? {},
      daily_tool_ceiling: settings.daily_tool_ceiling,
      daily_spend_ceiling: settings.daily_spend_ceiling,
      persona_notes: settings.persona_notes,
      forbidden_topics: settings.forbidden_topics ?? [],
    }).eq("user_id", user.id).eq("brand_id", brand.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Settings saved");
  };

  const setMode = (toolName: string, mode: Mode) => {
    update({ tool_modes: { ...(settings.tool_modes ?? {}), [toolName]: mode } });
  };

  const createToken = async () => {
    const res = await authFetch(`${funcBase}/agent-tokens?action=create`, {
      method: "POST",
      body: JSON.stringify({ label: newTokenLabel || "API Token" }),
    });
    const data = await res.json();
    if (res.ok && data.token) {
      setRevealedToken(data.token);
      setNewTokenLabel("");
      load();
    } else toast.error(data.error || "Failed");
  };

  const revokeToken = async (id: string) => {
    if (!confirm("Revoke this token? Apps using it will stop working.")) return;
    const res = await authFetch(`${funcBase}/agent-tokens?action=revoke`, {
      method: "POST", body: JSON.stringify({ token_id: id }),
    });
    if (res.ok) { toast.success("Revoked"); load(); }
  };

  const undoAction = async (id: string) => {
    const res = await authFetch(`${funcBase}/agent-undo`, {
      method: "POST", body: JSON.stringify({ action_id: id }),
    });
    const d = await res.json();
    if (res.ok) { toast.success("Undone"); load(); }
    else toast.error(d.error ?? "Undo failed");
  };

  if (loading || !settings) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/agent")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Sparkles className="w-5 h-5" />
          <h1 className="font-semibold text-lg flex-1">Agent Settings</h1>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
          </Button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Master switch */}
        <Card className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold">Autonomous mode</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Let the strategist plan, draft, and act on your brand with the tools you authorise below.
              </p>
            </div>
            <Switch
              checked={!!settings.autonomy_enabled}
              onCheckedChange={(v) => update({ autonomy_enabled: v })}
            />
          </div>
        </Card>

        {/* Capability toggles */}
        <Card className="p-5 space-y-5">
          <div>
            <h2 className="font-semibold">Capabilities</h2>
            <p className="text-xs text-muted-foreground mt-1">
              For each tool: <b>Auto</b> runs immediately, <b>Confirm</b> asks you in chat, <b>Off</b> blocks it.
            </p>
          </div>
          {TOOL_GROUPS.map((g) => (
            <div key={g.group} className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">{g.group}</h3>
              <div className="space-y-2">
                {g.tools.map((t) => {
                  const current: Mode = settings.tool_modes?.[t.name] ?? t.default;
                  return (
                    <div key={t.name} className="flex items-center justify-between gap-3 py-1">
                      <Label className="flex-1 text-sm font-normal">{t.label}</Label>
                      <Select value={current} onValueChange={(v) => setMode(t.name, v as Mode)}>
                        <SelectTrigger className="w-32 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Auto</SelectItem>
                          <SelectItem value="confirm">Confirm</SelectItem>
                          <SelectItem value="off">Off</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </Card>

        {/* Guardrails */}
        <Card className="p-5 space-y-5">
          <h2 className="font-semibold">Guardrails</h2>

          <div className="space-y-2">
            <Label>Persona notes</Label>
            <Textarea
              value={settings.persona_notes ?? ""}
              onChange={(e) => update({ persona_notes: e.target.value })}
              placeholder="e.g. Speak in a punchy, Lagos-streetwise voice. Avoid corporate jargon."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Forbidden topics (comma-separated)</Label>
            <Input
              value={(settings.forbidden_topics ?? []).join(", ")}
              onChange={(e) => update({
                forbidden_topics: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
              })}
              placeholder="politics, competitor names, etc."
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Daily action ceiling</Label>
              <span className="text-sm text-muted-foreground">{settings.daily_tool_ceiling} actions/day</span>
            </div>
            <Slider
              value={[settings.daily_tool_ceiling]}
              min={10} max={200} step={10}
              onValueChange={([v]) => update({ daily_tool_ceiling: v })}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Daily design-generation ceiling</Label>
              <span className="text-sm text-muted-foreground">{settings.daily_spend_ceiling} designs/day</span>
            </div>
            <Slider
              value={[settings.daily_spend_ceiling]}
              min={0} max={50} step={1}
              onValueChange={([v]) => update({ daily_spend_ceiling: v })}
            />
          </div>
        </Card>

        {/* External tokens */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold flex items-center gap-2"><KeyRound className="w-4 h-4" /> External access tokens</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Use a token to chat with the strategist from WhatsApp, Telegram, email automation, or any other tool.
              </p>
            </div>
          </div>

          <div className="bg-muted rounded-lg p-3 text-xs space-y-1 font-mono">
            <div>POST {funcBase}/strategist-agent-webhook</div>
            <div>Authorization: Bearer YOUR_TOKEN</div>
            <div>Body: {`{ "message": "Plan next week" }`}</div>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Token label (e.g. WhatsApp)"
              value={newTokenLabel}
              onChange={(e) => setNewTokenLabel(e.target.value)}
            />
            <Button onClick={createToken}>Create token</Button>
          </div>

          {revealedToken && (
            <div className="border border-amber-300 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 space-y-2">
              <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
                Copy this token now — it won't be shown again.
              </p>
              <div className="flex items-center gap-2">
                <code className="text-xs flex-1 break-all">{revealedToken}</code>
                <Button size="sm" variant="ghost" onClick={() => {
                  navigator.clipboard.writeText(revealedToken);
                  toast.success("Copied");
                }}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <Button size="sm" variant="outline" onClick={() => setRevealedToken(null)}>I saved it</Button>
            </div>
          )}

          <div className="space-y-2">
            {tokens.map((t) => (
              <div key={t.id} className="flex items-center justify-between border border-border rounded-lg p-3 text-sm">
                <div className="flex-1">
                  <div className="font-medium">{t.label}</div>
                  <div className="text-xs text-muted-foreground font-mono">{t.token_prefix}…</div>
                  <div className="text-xs text-muted-foreground">
                    {t.revoked_at ? <Badge variant="destructive" className="text-[10px]">revoked</Badge> :
                     t.last_used_at ? `Last used ${new Date(t.last_used_at).toLocaleString()}` : "Never used"}
                  </div>
                </div>
                {!t.revoked_at && (
                  <Button size="icon" variant="ghost" onClick={() => revokeToken(t.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
            {tokens.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No tokens yet.</p>}
          </div>
        </Card>

        {/* Activity log */}
        <Card className="p-5 space-y-3">
          <h2 className="font-semibold">Recent agent actions</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {actions.map((a) => (
              <div key={a.id} className="flex items-center gap-3 text-sm border-b border-border pb-2">
                <div className="flex-1">
                  <span className="font-mono text-xs">{a.tool_name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                </div>
                <Badge variant={a.status === "completed" ? "secondary" : a.status === "reversed" ? "outline" : "destructive"} className="text-[10px]">
                  {a.status}
                </Badge>
                {a.is_reversible && a.status === "completed" && (
                  <Button size="sm" variant="ghost" onClick={() => undoAction(a.id)} className="h-7 px-2 text-xs">
                    <Undo2 className="w-3 h-3 mr-1" /> Undo
                  </Button>
                )}
              </div>
            ))}
            {actions.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No actions yet.</p>}
          </div>
        </Card>

        <p className="text-xs text-muted-foreground text-center">
          The agent can never access billing, payouts, deletions, or other users' data.{" "}
          <Link to="/hub" className="underline">Back to Hub</Link>
        </p>
      </div>
    </div>
  );
}
