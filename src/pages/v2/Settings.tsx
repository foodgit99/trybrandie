import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBrand } from "@/hooks/useBrand";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  ArrowRight,
  Bell,
  CreditCard,
  Loader2,
  LogOut,
  Sparkles,
} from "lucide-react";
import SEO from "@/components/SEO";
import NewAppHeader from "@/components/v2/NewAppHeader";

type AutopilotSettings = {
  brand_id: string;
  enabled: boolean;
  delivery_time: string;
  timezone: string;
};

const DELIVERY_OPTIONS = [
  { id: "morning", label: "Morning", hint: "~8am" },
  { id: "afternoon", label: "Afternoon", hint: "~1pm" },
  { id: "evening", label: "Evening", hint: "~6pm" },
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
  const { brand, isLoading: brandLoading } = useBrand(user);
  const { toast } = useToast();
  const navigate = useNavigate();

  const [whatsapp, setWhatsapp] = useState("");
  const [autopilot, setAutopilot] = useState<AutopilotSettings | null>(null);
  const [v2Default, setV2Default] = useState<boolean>(true);
  const [briefingHour, setBriefingHour] = useState<number>(7);
  const [pushHour, setPushHour] = useState<number>(8);
  const [pushTz, setPushTz] = useState<string>("Africa/Lagos");
  const [savingBriefing, setSavingBriefing] = useState(false);
  const [savingPush, setSavingPush] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("whatsapp_number, v2_enabled, monday_briefing_hour, daily_push_hour, posting_timezone")
        .eq("user_id", user.id)
        .maybeSingle();
      setWhatsapp((data?.whatsapp_number as string) ?? "");
      setV2Default(!!(data as any)?.v2_enabled);
      setBriefingHour(((data as any)?.monday_briefing_hour as number) ?? 7);
      setPushHour(((data as any)?.daily_push_hour as number) ?? 8);
      setPushTz(((data as any)?.posting_timezone as string) ?? "Africa/Lagos");
    })();
  }, [user]);

  useEffect(() => {
    if (!brand?.id) return;
    (async () => {
      const { data } = await supabase
        .from("autopilot_settings")
        .select("brand_id, enabled, delivery_time, timezone")
        .eq("brand_id", brand.id)
        .maybeSingle();
      if (data) setAutopilot(data as AutopilotSettings);
      else
        setAutopilot({
          brand_id: brand.id,
          enabled: false,
          delivery_time: "morning",
          timezone:
            Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Lagos",
        });
    })();
  }, [brand?.id]);

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
      <SEO title="Settings — Brandie" description="Tune the system." path="/settings" noindex />
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

        <Section label="Autopilot">
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
        </Section>

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
          <Row title="Email reminders" subtitle="Sent each morning with your post.">
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Bell className="h-3.5 w-3.5" /> On
            </span>
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
