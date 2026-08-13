import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBrand } from "@/hooks/useBrand";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Sun, Moon, Monitor } from "lucide-react";
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  CreditCard,
  Loader2,
  LogOut,
  Mail,
  MessageCircle,
  RefreshCw,
  Sparkles,
  User,
  XCircle,
} from "lucide-react";


import SEO from "@/components/SEO";
import NewAppHeader from "@/components/v2/NewAppHeader";

type AutopilotSettings = {
  brand_id: string;
  enabled: boolean;
  delivery_time: string;
  timezone: string;
  default_funnel_stage: string | null;
  default_campaign_id: string | null;
  default_canvas_size: string | null;
  marketing_email_from_name?: string | null;
  marketing_email_reply_to?: string | null;
  marketing_email_physical_address?: string | null;
};

type DomainStatus = {
  ok: boolean;
  domain: string;
  status: string;
  error?: string;
  records?: Array<{ record: string; name: string; type: string; value: string; status?: string }>;
} | null;


type CampaignOption = { id: string; name: string };

const DELIVERY_OPTIONS = [
  { id: "morning", label: "Morning", hint: "~8am" },
  { id: "afternoon", label: "Afternoon", hint: "~1pm" },
  { id: "evening", label: "Evening", hint: "~6pm" },
];

const FUNNEL_STAGE_OPTIONS = [
  { id: "awareness", label: "Awareness", hint: "Top of funnel" },
  { id: "consideration", label: "Consideration", hint: "Build trust" },
  { id: "conversion", label: "Conversion", hint: "Drive sales" },
  { id: "retention", label: "Retention", hint: "Keep them back" },
];

const CANVAS_SIZE_OPTIONS = [
  { id: "1080x1080", label: "Square", hint: "1080 × 1080" },
  { id: "1080x1350", label: "Portrait", hint: "1080 × 1350" },
  { id: "1080x1920", label: "Story / Reel", hint: "1080 × 1920" },
];

const Section: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <section className="space-y-3">
    <h2 className="text-xs tracking-[0.22em] uppercase text-muted-foreground">{label}</h2>
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-5">
      {children}
    </div>
  </section>
);

const Row: React.FC<{
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}> = ({ title, subtitle, children }) => (
  <div className="flex items-center justify-between gap-4">
    <div className="min-w-0">
      <p className="font-medium leading-tight">{title}</p>
      {subtitle && (
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
      )}
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

const SettingsV2 = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const { brand, brands, isLoading: brandLoading, setActiveBrand } = useBrand(user);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { theme, setTheme } = useTheme();
  const [themeMounted, setThemeMounted] = useState(false);
  useEffect(() => setThemeMounted(true), []);

  // Deep-link support: /settings?brand=<id>&resume=1 (used by the
  // "Autopilot paused" email) switches to that brand and jumps straight
  // to the Autopilot controls.
  const deepLinkBrandId = searchParams.get("brand");
  const wantsResume = searchParams.get("resume") === "1";
  const [highlightAutopilot, setHighlightAutopilot] = useState(false);

  useEffect(() => {
    if (!deepLinkBrandId || brandLoading) return;
    if (brand?.id === deepLinkBrandId) return;
    if (!brands.some((b: any) => b.id === deepLinkBrandId)) return;
    setActiveBrand(deepLinkBrandId);
  }, [deepLinkBrandId, brandLoading, brand?.id, brands, setActiveBrand]);

  useEffect(() => {
    if (!wantsResume || brandLoading) return;
    const el = document.getElementById("autopilot-settings");
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightAutopilot(true);
    const t = setTimeout(() => setHighlightAutopilot(false), 2600);
    return () => clearTimeout(t);
  }, [wantsResume, brandLoading, brand?.id]);


  const [whatsapp, setWhatsapp] = useState("");
  const [waDelivery, setWaDelivery] = useState(false);
  const [savingWaDelivery, setSavingWaDelivery] = useState(false);
  const [testingWa, setTestingWa] = useState(false);
  const [waLastDelivery, setWaLastDelivery] = useState<
    { status: string; reason: string | null; created_at: string } | null
  >(null);


  const [autopilot, setAutopilot] = useState<AutopilotSettings | null>(null);
  const [v2Default, setV2Default] = useState<boolean>(true);
  const [briefingHour, setBriefingHour] = useState<number>(7);
  const [pushHour, setPushHour] = useState<number>(8);
  const [pushTz, setPushTz] = useState<string>("Africa/Lagos");
  const [emailReminders, setEmailReminders] = useState<boolean>(true);
  const [savingEmailReminders, setSavingEmailReminders] = useState(false);
  const [savingBriefing, setSavingBriefing] = useState(false);
  const [savingPush, setSavingPush] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("whatsapp_number, whatsapp_delivery_enabled, v2_enabled, monday_briefing_hour, daily_push_hour, posting_timezone, email_reminders_enabled")
        .eq("user_id", user.id)
        .maybeSingle();
      setWhatsapp((data?.whatsapp_number as string) ?? "");
      setWaDelivery(!!(data as any)?.whatsapp_delivery_enabled);
      setV2Default(!!(data as any)?.v2_enabled);
      setBriefingHour(((data as any)?.monday_briefing_hour as number) ?? 7);
      setPushHour(((data as any)?.daily_push_hour as number) ?? 8);
      setPushTz(((data as any)?.posting_timezone as string) ?? "Africa/Lagos");
      setEmailReminders(((data as any)?.email_reminders_enabled as boolean) ?? true);

      const { data: delivery } = await supabase
        .from("whatsapp_deliveries")
        .select("status, reason, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setWaLastDelivery((delivery as any) ?? null);
    })();
  }, [user]);


  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [outboxFromName, setOutboxFromName] = useState("");
  const [outboxReplyTo, setOutboxReplyTo] = useState("");
  const [outboxAddress, setOutboxAddress] = useState("");
  const [savingOutbox, setSavingOutbox] = useState(false);
  const [domain, setDomain] = useState<DomainStatus>(null);
  const [verifyingDomain, setVerifyingDomain] = useState(false);

  useEffect(() => {
    if (!brand?.id) return;
    (async () => {
      const { data } = await supabase
        .from("autopilot_settings")
        .select("brand_id, enabled, delivery_time, timezone, default_funnel_stage, default_campaign_id, default_canvas_size, marketing_email_from_name, marketing_email_reply_to, marketing_email_physical_address")
        .eq("brand_id", brand.id)
        .maybeSingle();
      if (data) {
        setAutopilot(data as AutopilotSettings);
        setOutboxFromName((data as any).marketing_email_from_name ?? "");
        setOutboxReplyTo((data as any).marketing_email_reply_to ?? "");
        setOutboxAddress((data as any).marketing_email_physical_address ?? "");
      } else
        setAutopilot({
          brand_id: brand.id,
          enabled: false,
          delivery_time: "morning",
          timezone:
            Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Lagos",
          default_funnel_stage: null,
          default_campaign_id: null,
          default_canvas_size: null,
        });

      const { data: camps } = await supabase
        .from("campaigns")
        .select("id, name")
        .eq("brand_id", brand.id)
        .order("created_at", { ascending: false });
      setCampaigns((camps as CampaignOption[]) || []);
    })();
  }, [brand?.id]);

  const saveOutbox = async () => {
    if (!autopilot || !user) return;
    setSavingOutbox(true);
    const next = {
      ...autopilot,
      marketing_email_from_name: outboxFromName.trim() || null,
      marketing_email_reply_to: outboxReplyTo.trim() || null,
      marketing_email_physical_address: outboxAddress.trim() || null,
      user_id: user.id,
    };
    const { error } = await supabase
      .from("autopilot_settings")
      .upsert(next as any, { onConflict: "brand_id" });
    setSavingOutbox(false);
    if (error) {
      toast({ title: "Couldn't save Outbox", description: error.message, variant: "destructive" });
    } else {
      setAutopilot(next as AutopilotSettings);
      toast({ title: "Outbox settings saved." });
    }
  };

  const verifyDomain = async () => {
    setVerifyingDomain(true);
    try {
      const { data, error } = await supabase.functions.invoke("email-marketing-verify-domain", { body: {} });
      if (error) throw error;
      setDomain(data as DomainStatus);
      if ((data as any)?.ok) toast({ title: "Domain verified." });
      else toast({
        title: "Domain not verified",
        description: (data as any)?.error || `Status: ${(data as any)?.status}`,
        variant: "destructive",
      });
    } catch (e: any) {
      toast({ title: "Verify failed", description: e.message, variant: "destructive" });
    } finally {
      setVerifyingDomain(false);
    }
  };


  const saveWhatsapp = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ whatsapp_number: whatsapp.trim() || null })
        .eq("user_id", user.id);
      if (error) throw error;
      toast({ title: "WhatsApp number saved." });
    } catch (err: any) {
      toast({ title: "Couldn't save", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleWaDelivery = async (checked: boolean) => {
    if (!user) return;
    if (checked && !whatsapp.trim()) {
      toast({
        title: "Add your WhatsApp number first",
        description: "Save a number above, then turn delivery on.",
        variant: "destructive",
      });
      return;
    }
    setWaDelivery(checked);
    setSavingWaDelivery(true);
    const { error } = await supabase
      .from("profiles")
      .update({ whatsapp_delivery_enabled: checked } as any)
      .eq("user_id", user.id);
    setSavingWaDelivery(false);
    if (error) {
      setWaDelivery(!checked);
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
    }
  };

  const sendWhatsappTest = async () => {
    setTestingWa(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-send", {
        body: {
          test: true,
          title: "Brandie test message",
          body: "If you can read this, WhatsApp delivery is working. Your daily posts will arrive here.",
          url: "/cockpit",
        },
      });
      if (error) {
        // Edge errors carry the real reason in the response body, not the message.
        let detail = error.message;
        try {
          const payload = await (error as any)?.context?.json?.();
          if (payload?.hint || payload?.error) detail = payload.hint || payload.error;
        } catch { /* keep generic message */ }
        throw new Error(detail);
      }
      if ((data as any)?.error) {
        throw new Error((data as any).hint || JSON.stringify((data as any).details ?? (data as any).error));
      }
      toast({ title: "Test message sent to WhatsApp." });
    } catch (err: any) {
      toast({ title: "WhatsApp test failed", description: err.message, variant: "destructive" });
    } finally {
      setTestingWa(false);
    }
  };




  const saveAutopilot = async (next: Partial<AutopilotSettings>) => {
    if (!autopilot || !user) return;
    const merged = { ...autopilot, ...next };
    setAutopilot(merged);
    const { error } = await supabase
      .from("autopilot_settings")
      .upsert({ ...merged, user_id: user.id } as any, { onConflict: "brand_id" });
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Saved." });
  };

  if (authLoading || brandLoading) {
    return (
      <div className="min-h-dvh grid place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth?next=/settings" replace />;
  if (!brand || !brand.onboarding_complete) return <Navigate to="/onboarding" replace />;

  return (
    <div className="min-h-dvh bg-background lg:pl-20 pb-24">
      <SEO title="Settings, Brandie" description="Tune the system." path="/settings" noindex />
      <NewAppHeader />


      <main className="max-w-2xl mx-auto px-5 sm:px-8 pt-10 sm:pt-16 space-y-10">
        <header className="space-y-2">
          <p className="text-xs tracking-[0.22em] uppercase text-muted-foreground">
            Settings
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl tracking-tight leading-[1]">
            Tune the system.
          </h1>
          <p className="text-muted-foreground">
            Signed in as <span className="text-foreground">{user.email}</span>
          </p>
        </header>

        <Section label="Account">
          <button
            onClick={() => navigate("/profile")}
            className="w-full flex items-center justify-between gap-4 rounded-xl border border-border bg-background px-4 py-3 hover:border-foreground/40 transition-colors text-left"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-full bg-muted grid place-items-center">
                <User className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="font-medium leading-tight">Manage profile</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Photo, name, contact, password, locale.
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
        </Section>

        <div
          id="autopilot-settings"
          className={
            highlightAutopilot
              ? "scroll-mt-24 rounded-2xl ring-2 ring-primary/60 transition-shadow"
              : "scroll-mt-24 rounded-2xl transition-shadow"
          }
        >
        <Section label="Autopilot">
          {wantsResume && !autopilot?.enabled && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
              <p className="text-sm font-medium">Autopilot is paused</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                We paused it after a stretch of inactivity. Flip the switch below to resume
                {brand?.name ? ` ${brand.name}` : ""}.
              </p>
            </div>
          )}
          <Row
            title="Run the engine"
            subtitle="Brandie drafts the week and renders each day for you."
          >
            <Switch
              checked={!!autopilot?.enabled}
              onCheckedChange={(v) => saveAutopilot({ enabled: v })}
            />
          </Row>


          <div className="space-y-2">
            <p className="font-medium text-sm">Delivery window</p>
            <div className="grid grid-cols-3 gap-2">
              {DELIVERY_OPTIONS.map((opt) => {
                const active = autopilot?.delivery_time === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => saveAutopilot({ delivery_time: opt.id })}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background hover:border-foreground/40"
                    }`}
                  >
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p
                      className={`text-[10px] tracking-wider uppercase ${
                        active ? "text-background/70" : "text-muted-foreground"
                      }`}
                    >
                      {opt.hint}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <p className="font-medium text-sm">Default funnel stage</p>
            <p className="text-xs text-muted-foreground">
              New autopilot posts get routed into this stage on the Funnels board.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {FUNNEL_STAGE_OPTIONS.map((opt) => {
                const active = autopilot?.default_funnel_stage === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() =>
                      saveAutopilot({
                        default_funnel_stage: active ? null : opt.id,
                      })
                    }
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background hover:border-foreground/40"
                    }`}
                  >
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p
                      className={`text-[10px] tracking-wider uppercase ${
                        active ? "text-background/70" : "text-muted-foreground"
                      }`}
                    >
                      {opt.hint}
                    </p>
                  </button>
                );
              })}
            </div>
            {autopilot?.default_funnel_stage && (
              <button
                onClick={() => saveAutopilot({ default_funnel_stage: null })}
                className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Clear — let category decide
              </button>
            )}
          </div>

          <div className="space-y-2">
            <p className="font-medium text-sm">Default campaign</p>
            <p className="text-xs text-muted-foreground">
              Auto-assign new posts to this campaign bucket.
            </p>
            <select
              value={autopilot?.default_campaign_id ?? ""}
              onChange={(e) =>
                saveAutopilot({ default_campaign_id: e.target.value || null })
              }
              className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm"
            >
              <option value="">None — auto-route by funnel stage</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {autopilot?.default_campaign_id &&
              !campaigns.some((c) => c.id === autopilot.default_campaign_id) && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Previous campaign was deleted. Autonomous Mode will route new posts using your default funnel stage until you pick a new one.
                </p>
              )}
            {campaigns.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No campaigns yet — Autonomous Mode will auto-create one named after your selected funnel stage.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <p className="font-medium text-sm">Default design size</p>
            <p className="text-xs text-muted-foreground">
              Used for Cockpit and Autonomous Mode posts. You can still override per-design in Studio. Carousels are always square.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {CANVAS_SIZE_OPTIONS.map((opt) => {
                const current = autopilot?.default_canvas_size ?? "1080x1080";
                const active = current === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => saveAutopilot({ default_canvas_size: opt.id })}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background hover:border-foreground/40"
                    }`}
                  >
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p
                      className={`text-[10px] tracking-wider uppercase ${
                        active ? "text-background/70" : "text-muted-foreground"
                      }`}
                    >
                      {opt.hint}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </Section>
        </div>


        <Section label="Daily nudge">
          <Row title="WhatsApp number" subtitle="We'll ping you when each post is ready.">
            <div className="flex items-center gap-2">
              <Input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="+234…"
                className="h-9 w-44"
              />
              <Button size="sm" onClick={saveWhatsapp} disabled={saving} className="rounded-full">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
              </Button>
            </div>
          </Row>
          <Row
            title="Send posts to WhatsApp"
            subtitle="Each finished post arrives as an image with its caption and a link."
          >
            <div className="flex items-center gap-2">
              <MessageCircle
                className={`h-3.5 w-3.5 ${waDelivery ? "text-foreground" : "text-muted-foreground"}`}
              />
              <Switch
                checked={waDelivery}
                disabled={savingWaDelivery}
                onCheckedChange={toggleWaDelivery}
              />
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={sendWhatsappTest}
                disabled={testingWa || !whatsapp.trim()}
              >
                {testingWa ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Send test"}
              </Button>
            </div>
          </Row>

          <Row title="Email reminders" subtitle="Sent each morning with your post.">
            <div className="flex items-center gap-2">
              <Bell className={`h-3.5 w-3.5 ${emailReminders ? "text-foreground" : "text-muted-foreground"}`} />
              <Switch
                checked={emailReminders}
                disabled={savingEmailReminders}
                onCheckedChange={async (checked) => {
                  if (!user) return;
                  setEmailReminders(checked);
                  setSavingEmailReminders(true);
                  const { error } = await supabase
                    .from("profiles")
                    .update({ email_reminders_enabled: checked } as any)
                    .eq("user_id", user.id);
                  setSavingEmailReminders(false);
                  if (error) {
                    setEmailReminders(!checked);
                    toast({ title: "Couldn't update reminders", description: error.message, variant: "destructive" });
                  } else {
                    toast({ title: checked ? "Email reminders on" : "Email reminders off" });
                  }
                }}
              />
            </div>
          </Row>
          <Row
            title="Monday briefing"
            subtitle="Your weekly strategy lands in your inbox at this hour, in your timezone."
          >
            <div className="flex items-center gap-2">
              <select
                value={briefingHour}
                onChange={async (e) => {
                  if (!user) return;
                  const hr = parseInt(e.target.value, 10);
                  setBriefingHour(hr);
                  setSavingBriefing(true);
                  const { error } = await supabase
                    .from("profiles")
                    .update({ monday_briefing_hour: hr })
                    .eq("user_id", user.id);
                  setSavingBriefing(false);
                  if (error) {
                    toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
                  } else {
                    toast({ title: "Briefing time saved." });
                  }
                }}
                disabled={savingBriefing}
                className="h-9 rounded-md border border-border bg-background px-2 text-sm"
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {h.toString().padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </div>
          </Row>
          <Row
            title="Daily drop time"
            subtitle="Each day's post lands in your inbox at this hour."
          >
            <div className="flex items-center gap-2">
              <select
                value={pushHour}
                onChange={async (e) => {
                  if (!user) return;
                  const hr = parseInt(e.target.value, 10);
                  setPushHour(hr);
                  setSavingPush(true);
                  const { error } = await supabase
                    .from("profiles")
                    .update({ daily_push_hour: hr } as any)
                    .eq("user_id", user.id);
                  setSavingPush(false);
                  if (error) {
                    toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
                  } else {
                    toast({ title: "Daily drop time saved." });
                  }
                }}
                disabled={savingPush}
                className="h-9 rounded-md border border-border bg-background px-2 text-sm"
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {h.toString().padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </div>
          </Row>
          <Row title="Posting timezone" subtitle="Used for all scheduled notifications.">
            <select
              value={pushTz}
              onChange={async (e) => {
                if (!user) return;
                const tz = e.target.value;
                setPushTz(tz);
                const { error } = await supabase
                  .from("profiles")
                  .update({ posting_timezone: tz } as any)
                  .eq("user_id", user.id);
                if (error) {
                  toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
                } else {
                  toast({ title: "Timezone saved." });
                }
              }}
              className="h-9 rounded-md border border-border bg-background px-2 text-sm max-w-[14rem]"
            >
              {[
                "Africa/Lagos",
                "Africa/Accra",
                "Africa/Nairobi",
                "Africa/Johannesburg",
                "Africa/Cairo",
                "Europe/London",
                "Europe/Berlin",
                "America/New_York",
                "America/Chicago",
                "America/Los_Angeles",
                "Asia/Dubai",
                "Asia/Kolkata",
                "Asia/Singapore",
              ].map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </Row>
          <Row title="Send a test drop" subtitle="Triggers today's drop email if one is ready for you.">
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              disabled={sendingTest}
              onClick={async () => {
                setSendingTest(true);
                try {
                  const { error } = await supabase.functions.invoke("daily-execution-push", {
                    body: { test_user_id: user?.id },
                  });
                  if (error) throw error;
                  toast({ title: "Test triggered.", description: "Check your inbox in a minute." });
                } catch (e: any) {
                  toast({ title: "Couldn't send test", description: e.message, variant: "destructive" });
                } finally {
                  setSendingTest(false);
                }
              }}
            >
              {sendingTest ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Send test"}
            </Button>
          </Row>
        </Section>


        <Section label="Outbox (Email marketing)">
          <Row title="Sender name" subtitle="Shown as the From name in subscribers' inboxes.">
            <Input
              value={outboxFromName}
              onChange={(e) => setOutboxFromName(e.target.value)}
              placeholder={brand?.name || "Your brand"}
              className="h-9 w-56"
            />
          </Row>
          <Row title="Reply-to address" subtitle="Replies from subscribers land here.">
            <Input
              type="email"
              value={outboxReplyTo}
              onChange={(e) => setOutboxReplyTo(e.target.value)}
              placeholder="hello@yourbrand.com"
              className="h-9 w-64"
            />
          </Row>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Physical mailing address</Label>
            <p className="text-xs text-muted-foreground">
              Required by CAN-SPAM and most anti-spam laws. Shown in every broadcast footer.
            </p>
            <Input
              value={outboxAddress}
              onChange={(e) => setOutboxAddress(e.target.value)}
              placeholder="123 Marina Street, Lagos, Nigeria"
              className="h-9"
            />
          </div>
          <div className="flex justify-end">
            <Button size="sm" className="rounded-full" onClick={saveOutbox} disabled={savingOutbox}>
              {savingOutbox ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save sender identity"}
            </Button>
          </div>

          <div className="border-t border-border pt-4 space-y-3">
            <Row
              title="Sender domain"
              subtitle={domain?.domain ? `Configured: ${domain.domain}` : "Verify the domain Resend will send from."}
            >
              <Button
                size="sm"
                variant="outline"
                className="rounded-full gap-1.5"
                onClick={verifyDomain}
                disabled={verifyingDomain}
              >
                {verifyingDomain ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Check status
              </Button>
            </Row>
            {domain && (
              <div
                className={`rounded-xl border p-3 text-sm flex items-start gap-2 ${
                  domain.ok
                    ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
                    : "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400"
                }`}
              >
                {domain.ok ? (
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                )}
                <div className="space-y-1 min-w-0">
                  <p className="font-medium">
                    {domain.ok ? "Verified" : `Status: ${domain.status}`}
                    {domain.domain ? ` — ${domain.domain}` : ""}
                  </p>
                  {domain.error && <p className="text-xs opacity-90">{domain.error}</p>}
                  {!domain.ok && domain.records && domain.records.length > 0 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer underline underline-offset-2">
                        Required DNS records ({domain.records.length})
                      </summary>
                      <div className="mt-2 space-y-1 font-mono text-[11px]">
                        {domain.records.map((r, i) => (
                          <div key={i} className="rounded bg-background/60 border border-border p-2">
                            <div><span className="opacity-60">{r.type}</span> {r.name}</div>
                            <div className="truncate opacity-80">{r.value}</div>
                            {r.status && <div className="opacity-60">status: {r.status}</div>}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                  {!domain.ok && !domain.error && (
                    <p className="text-xs opacity-80 flex items-center gap-1">
                      <Mail className="h-3 w-3" /> Add the records above at your DNS provider, then re-check.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </Section>

        <Section label="Plan">

          <Row title="Current plan" subtitle="Subscription, credits, invoices.">
            <Button asChild size="sm" variant="outline" className="rounded-full gap-1.5">
              <Link to="/plans">
                <CreditCard className="h-3.5 w-3.5" /> Manage
              </Link>
            </Button>
          </Row>
        </Section>

        <Section label="Appearance">
          <Row
            title="Theme"
            subtitle="Dark keeps the same layout and brand accents, just calmer surfaces."
          >
            <div className="flex items-center gap-1 rounded-full border border-border bg-muted/40 p-1">
              {[
                { value: "light", label: "Light", icon: Sun },
                { value: "dark", label: "Dark", icon: Moon },
                { value: "system", label: "Auto", icon: Monitor },
              ].map(({ value, label, icon: Icon }) => {
                const active = themeMounted && theme === value;
                return (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-pressed={active}
                    onClick={() => setTheme(value)}
                    className={`h-8 rounded-full gap-1.5 px-3 text-xs ${
                      active
                        ? "nav-active-pill text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </Button>
                );
              })}
            </div>
          </Row>
        </Section>

        <Section label="Experience">

          <Row
            title="Use new Brandie by default"
            subtitle="When on, signing in lands you on the Cockpit. Off sends you to the legacy chat-canvas."
          >
            <Switch
              checked={v2Default}
              onCheckedChange={async (v) => {
                setV2Default(v);
                if (!user) return;
                const { error } = await supabase
                  .from("profiles")
                  .update({ v2_enabled: v })
                  .eq("user_id", user.id);
                if (error) {
                  toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
                  setV2Default(!v);
                } else {
                  toast({ title: v ? "New Brandie is your default." : "Legacy is your default." });
                }
              }}
            />
          </Row>
          <Row
            title="Open legacy Brandie now"
            subtitle="The original chat-canvas experience is still available."
          >
            <Button asChild size="sm" variant="ghost" className="rounded-full gap-1.5">
              <Link to="/legacy">
                <Sparkles className="h-3.5 w-3.5" /> Switch
              </Link>
            </Button>
          </Row>
        </Section>

        <Section label="Account">
          <Row title="Sign out" subtitle="End this session.">
            <Button
              size="sm"
              variant="ghost"
              className="rounded-full gap-1.5 text-destructive hover:text-destructive"
              onClick={async () => {
                await signOut();
                navigate("/v2");
              }}
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </Button>
          </Row>
        </Section>

        <div className="rounded-3xl border border-border bg-foreground text-background p-6 sm:p-8 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="font-serif text-xl sm:text-2xl tracking-tight">
              Edit your brand
            </h3>
            <p className="text-background/70 text-sm mt-1">
              Logo, colors, audience, and products.
            </p>
          </div>
          <Button asChild variant="secondary" size="lg" className="rounded-full h-12 gap-2 shrink-0">
            <Link to="/brand/editor">
              Brand Centre <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
};

export default SettingsV2;
