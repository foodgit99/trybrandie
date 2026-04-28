import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  X,
  Pencil,
  Trash2,
  Check,
  Upload,
  Loader2,
  Newspaper,
  MessageSquareQuote,
  Calendar,
  Megaphone,
  HeartHandshake,
  Trophy,
  Users,
  Package,
  Sparkles,
  ExternalLink,
  Archive,
  ArchiveRestore,
  Wand2,
  AlertTriangle,
  ListChecks,
} from "lucide-react";

const UPDATE_TYPES: Array<{
  id: string;
  label: string;
  emoji: string;
  Icon: React.ComponentType<{ className?: string }>;
  hint: string;
}> = [
  { id: "testimonial", label: "Testimonial", emoji: "💬", Icon: MessageSquareQuote, hint: "A quote or review from a real customer" },
  { id: "product", label: "Product update", emoji: "📦", Icon: Package, hint: "New launch, feature, drop, or restock" },
  { id: "event", label: "Event", emoji: "🎤", Icon: Calendar, hint: "Something happening / that happened in the business" },
  { id: "milestone", label: "Milestone", emoji: "🏆", Icon: Trophy, hint: "Reached a number, anniversary, or achievement" },
  { id: "csr", label: "CSR / Community", emoji: "🤝", Icon: HeartHandshake, hint: "Outreach, sponsorship, donation, volunteering" },
  { id: "press", label: "Press mention", emoji: "📰", Icon: Newspaper, hint: "Featured in media, blog, podcast, etc." },
  { id: "partnership", label: "Partnership", emoji: "🔗", Icon: Users, hint: "New collaboration or alliance" },
  { id: "customer_story", label: "Customer story", emoji: "✨", Icon: Sparkles, hint: "A success story or transformation" },
  { id: "other", label: "Other", emoji: "📌", Icon: Megaphone, hint: "Anything else worth telling the AI" },
];

const TYPE_META: Record<string, { label: string; emoji: string; tone: string }> = Object.fromEntries(
  UPDATE_TYPES.map((t) => [t.id, { label: t.label, emoji: t.emoji, tone: "bg-secondary text-secondary-foreground" }]),
);

interface BrandUpdate {
  id: string;
  brand_id: string;
  update_type: string;
  title: string;
  content: string;
  attribution: string | null;
  image_url: string | null;
  source_url: string | null;
  event_date: string;
  expires_at: string | null;
  status: string;
  times_used: number;
  last_used_at: string | null;
  created_at: string;
  confidence: number | null;
  missing_fields: string[] | null;
}

type ConfTier = "high" | "medium" | "low";
const tierFor = (confidence: number | null | undefined): ConfTier => {
  if (confidence === null || confidence === undefined) return "low";
  if (confidence >= 75) return "high";
  if (confidence >= 45) return "medium";
  return "low";
};
const tierMeta: Record<ConfTier, { label: string; cls: string; help: string }> = {
  high: {
    label: "Strong signal",
    cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    help: "AI will use this as factual seed material — quoting specifics.",
  },
  medium: {
    label: "Soft signal",
    cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
    help: "AI will use this as inspiration only — no invented specifics.",
  },
  low: {
    label: "Needs detail",
    cls: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30",
    help: "AI will skip this and ask you a follow-up question instead.",
  },
};

interface FormState {
  update_type: string;
  title: string;
  content: string;
  attribution: string;
  image_url: string;
  source_url: string;
  event_date: string;
  expires_at: string;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

const addDaysIso = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

// Returns days until expiry (negative = already expired). Null if no expiry set.
const daysUntilExpiry = (expires_at: string | null): number | null => {
  if (!expires_at) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expires_at + "T00:00:00");
  return Math.ceil((exp.getTime() - today.getTime()) / 86400000);
};

const emptyForm = (): FormState => ({
  update_type: "testimonial",
  title: "",
  content: "",
  attribution: "",
  image_url: "",
  source_url: "",
  event_date: todayIso(),
  expires_at: "",
});

const EXAMPLE_PROMPTS = [
  '"Tola from Lagos Tech Hub said our app saved her team 6 hours a week."',
  '"Hit 10,000 happy customers this morning."',
  '"Sponsored a coding bootcamp for 30 students this weekend."',
];

interface Props {
  brandId: string;
  userId: string;
}

export default function BrandUpdates({ brandId, userId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [planning, setPlanning] = useState(false);

  type FollowUp = {
    update_id: string;
    update_title: string;
    update_type: string;
    confidence: number;
    missing_fields: string[];
    question: string;
  };
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // AI summarise + confidence check
  type AiCheck = {
    summary: string;
    confidence: number;
    confidence_reason: string;
    missing_fields: string[];
    warnings: string[];
    suggested_title: string;
    extracted_attribution: string;
    detected_type: string;
  };
  const [aiCheck, setAiCheck] = useState<AiCheck | null>(null);
  const [aiChecking, setAiChecking] = useState(false);

  // Auto-open the add form when navigated with ?addUpdate=1 (from home / floating nav)
  // Optional prefill via ?type=, ?title=, ?content=, ?attribution=
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("addUpdate") === "1") {
      const validTypes = new Set(UPDATE_TYPES.map((t) => t.id));
      const typeParam = params.get("type") || "";
      setForm({
        ...emptyForm(),
        update_type: validTypes.has(typeParam) ? typeParam : "testimonial",
        title: params.get("title") || "",
        content: params.get("content") || "",
        attribution: params.get("attribution") || "",
      });
      setAdding(true);
      setTimeout(() => {
        document.getElementById("brand-updates")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
      ["addUpdate", "type", "title", "content", "attribution"].forEach((k) => params.delete(k));
      const newSearch = params.toString();
      const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : "") + window.location.hash;
      window.history.replaceState({}, "", newUrl);
    }
  }, []);

  const { data: updates, refetch } = useQuery({
    queryKey: ["brand_updates", brandId, showArchived],
    enabled: !!brandId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brand_updates" as any)
        .select("*")
        .eq("brand_id", brandId)
        .eq("status", showArchived ? "archived" : "active")
        .order("event_date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as unknown as BrandUpdate[];
    },
  });

  const filtered = useMemo(() => {
    if (!updates) return [];
    return filterType ? updates.filter((u) => u.update_type === filterType) : updates;
  }, [updates, filterType]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    (updates || []).forEach((u) => map.set(u.update_type, (map.get(u.update_type) || 0) + 1));
    return map;
  }, [updates]);

  // Updates expiring within 7 days (active, not yet expired)
  const expiringSoon = useMemo(() => {
    if (showArchived) return [];
    return (updates || []).filter((u) => {
      const d = daysUntilExpiry(u.expires_at);
      return d !== null && d >= 0 && d <= 7;
    });
  }, [updates, showArchived]);

  const expired = useMemo(() => {
    if (showArchived) return [];
    return (updates || []).filter((u) => {
      const d = daysUntilExpiry(u.expires_at);
      return d !== null && d < 0;
    });
  }, [updates, showArchived]);

  const reset = () => {
    setForm(emptyForm());
    setAdding(false);
    setEditingId(null);
    setAiCheck(null);
  };

  const planFromUpdates = async () => {
    if (planning) return;
    const activeCount = (updates || []).filter((u) => u.status === "active").length;
    if (activeCount === 0) {
      toast({
        title: "No active updates",
        description: "Add at least one update first — the AI uses these as factual seed material.",
        variant: "destructive",
      });
      return;
    }
    setPlanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("brand-engine", {
        body: { action: "plan_from_updates", brand_id: brandId },
      });
      if (error) throw error;
      const count = (data as any)?.count || 0;
      const used = (data as any)?.updates_used || 0;
      const fups: FollowUp[] = Array.isArray((data as any)?.follow_ups) ? (data as any).follow_ups : [];
      setFollowUps(fups);
      qc.invalidateQueries({ queryKey: ["brand_updates", brandId] });

      if (count === 0 && fups.length > 0) {
        toast({
          title: "Need a bit more detail first",
          description: `${fups.length} quick question${fups.length === 1 ? "" : "s"} below will unlock stronger drafts.`,
        });
        // Stay on this page so the user can answer the follow-ups inline.
        document
          .getElementById("brand-updates-followups")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        toast({
          title: count > 0 ? `Drafted ${count} idea${count === 1 ? "" : "s"}` : "Plan ready",
          description:
            count > 0
              ? `Grounded in ${used} update${used === 1 ? "" : "s"}.${fups.length > 0 ? ` ${fups.length} follow-up${fups.length === 1 ? "" : "s"} for weaker updates.` : ""} Opening Content Hub…`
              : "Opening Content Hub…",
        });
        navigate("/content");
      }
    } catch (e: any) {
      toast({
        title: "Couldn't draft from updates",
        description: e?.message || "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setPlanning(false);
    }
  };

  // Open an update from a follow-up question for editing.
  const answerFollowUp = (updateId: string) => {
    const u = (updates || []).find((x) => x.id === updateId);
    if (!u) return;
    startEdit(u);
    setFollowUps((prev) => prev.filter((f) => f.update_id !== updateId));
    setTimeout(() => {
      document
        .getElementById("brand-updates")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const runAiCheck = async () => {
    if (!form.content.trim() && !form.title.trim()) {
      toast({
        title: "Add some content first",
        description: "Type a short note about the update before running the AI check.",
        variant: "destructive",
      });
      return;
    }
    setAiChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("summarise-update", {
        body: {
          update_type: form.update_type,
          title: form.title,
          content: form.content,
          attribution: form.attribution,
          event_date: form.event_date,
        },
      });
      if (error) throw error;
      if (!data || data.error) throw new Error(data?.error || "AI check failed");
      setAiCheck(data as AiCheck);
    } catch (e: any) {
      toast({
        title: "AI check failed",
        description: e?.message || "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setAiChecking(false);
    }
  };

  // Re-run check should be triggered manually; clear stale check when key fields change
  useEffect(() => {
    if (aiCheck) setAiCheck(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.title, form.content, form.update_type, form.attribution]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/${brandId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("brand-inspiration").upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("brand-inspiration").getPublicUrl(path);
      setForm((f) => ({ ...f, image_url: data.publicUrl }));
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const validate = (): string | null => {
    if (!form.content.trim() && !form.title.trim()) return "Add a short note about the update.";
    if (form.content.length > 600) return "Keep the update under 600 characters.";
    if (form.title.length > 120) return "Keep the title under 120 characters.";
    return null;
  };

  const save = async () => {
    const err = validate();
    if (err) {
      toast({ title: "Heads up", description: err, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        brand_id: brandId,
        user_id: userId,
        update_type: form.update_type,
        title: form.title.trim().slice(0, 120),
        content: form.content.trim().slice(0, 600),
        attribution: form.attribution.trim() || null,
        image_url: form.image_url || null,
        source_url: form.source_url.trim() || null,
        event_date: form.event_date || todayIso(),
        expires_at: form.expires_at || null,
        status: "active",
      };
      // Persist the AI confidence + missing-fields if the user ran the
      // editorial check before saving. This is what the generation
      // pipeline reads to decide how strongly to rely on the update.
      if (aiCheck) {
        payload.confidence = Math.max(0, Math.min(100, Math.round(aiCheck.confidence)));
        payload.missing_fields = Array.isArray(aiCheck.missing_fields)
          ? aiCheck.missing_fields.slice(0, 8)
          : [];
      }
      if (editingId) {
        const { error } = await supabase.from("brand_updates" as any).update(payload).eq("id", editingId);
        if (error) throw error;
        toast({ title: "Update saved" });
      } else {
        const { error } = await supabase.from("brand_updates" as any).insert(payload);
        if (error) throw error;
        toast({ title: "Update added", description: "The AI will use this in your next generation." });
      }
      reset();
      qc.invalidateQueries({ queryKey: ["brand_updates", brandId] });
      refetch();
    } catch (e: any) {
      toast({ title: "Couldn't save", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (u: BrandUpdate) => {
    setEditingId(u.id);
    setAdding(false);
    setForm({
      update_type: u.update_type,
      title: u.title || "",
      content: u.content || "",
      attribution: u.attribution || "",
      image_url: u.image_url || "",
      source_url: u.source_url || "",
      event_date: u.event_date || todayIso(),
      expires_at: u.expires_at || "",
    });
  };

  const archiveToggle = async (u: BrandUpdate) => {
    const next = u.status === "active" ? "archived" : "active";
    const { error } = await supabase.from("brand_updates" as any).update({ status: next }).eq("id", u.id);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: next === "archived" ? "Archived" : "Restored" });
    refetch();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this update? This cannot be undone.")) return;
    const { error } = await supabase.from("brand_updates" as any).delete().eq("id", id);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Deleted" });
    refetch();
  };

  const renderForm = () => (
    <div className="space-y-3">
      {/* Type chips */}
      <div className="flex flex-wrap gap-1.5">
        {UPDATE_TYPES.map((t) => {
          const selected = form.update_type === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setForm((f) => ({ ...f, update_type: t.id }))}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                selected
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-muted-foreground/40"
              }`}
            >
              <span className="mr-1">{t.emoji}</span>
              {t.label}
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {UPDATE_TYPES.find((t) => t.id === form.update_type)?.hint}
      </p>

      <Input
        placeholder="Short headline (optional, e.g. 'Tola's review')"
        value={form.title}
        maxLength={120}
        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
      />
      <Textarea
        placeholder={
          form.update_type === "testimonial"
            ? '"Brandie cut our content production time in half. We finally look professional online." — Quote it verbatim if you have it.'
            : "What happened? Be concrete — names, numbers, places, outcomes."
        }
        value={form.content}
        maxLength={600}
        onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
        className="min-h-[90px]"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Input
          placeholder={form.update_type === "testimonial" ? "Attribution (e.g. Tola, Lagos Tech Hub)" : "Attribution (optional)"}
          value={form.attribution}
          maxLength={140}
          onChange={(e) => setForm((f) => ({ ...f, attribution: e.target.value }))}
        />
        <Input
          type="date"
          value={form.event_date}
          max={todayIso()}
          onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))}
        />
      </div>
      <Input
        placeholder="Source link (optional)"
        value={form.source_url}
        onChange={(e) => setForm((f) => ({ ...f, source_url: e.target.value }))}
      />

      {/* Expiry / reminder */}
      <div className="rounded-lg border border-border bg-background/40 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Expires / stop using on
          </label>
          {form.expires_at && (
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, expires_at: "" }))}
              className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
              Clear
            </button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Set a date for time-sensitive updates (events, sales, launches). The AI will stop using it after this date and you'll see a reminder when it's about to expire.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {[
            { label: "+3 days", days: 3 },
            { label: "+7 days", days: 7 },
            { label: "+14 days", days: 14 },
            { label: "+30 days", days: 30 },
            { label: "+90 days", days: 90 },
          ].map((opt) => {
            const target = addDaysIso(opt.days);
            const selected = form.expires_at === target;
            return (
              <button
                key={opt.label}
                type="button"
                onClick={() => setForm((f) => ({ ...f, expires_at: target }))}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                  selected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:border-muted-foreground/40"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <Input
          type="date"
          value={form.expires_at}
          min={todayIso()}
          onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
        />
        {form.expires_at && (() => {
          const days = daysUntilExpiry(form.expires_at);
          if (days === null) return null;
          if (days < 0) {
            return <p className="text-[11px] text-destructive">⚠ This date is in the past — the update won't be used.</p>;
          }
          if (days === 0) {
            return <p className="text-[11px] text-amber-600 dark:text-amber-400">Expires today.</p>;
          }
          return <p className="text-[11px] text-muted-foreground">Expires in {days} day{days === 1 ? "" : "s"}.</p>;
        })()}
      </div>

      {/* Image */}
      <div className="flex items-center gap-3">
        {form.image_url ? (
          <div className="relative group">
            <img src={form.image_url} alt="" className="w-16 h-16 object-cover rounded-lg border border-border" />
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, image_url: "" }))}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-16 h-16 rounded-lg border-2 border-dashed border-border hover:border-muted-foreground/40 flex flex-col items-center justify-center gap-0.5 text-muted-foreground"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            <span className="text-[10px]">Image</span>
          </button>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        <p className="text-[11px] text-muted-foreground flex-1">
          Optional. A real photo makes Social Proof and BTS designs feel authentic.
        </p>
      </div>

      {/* AI summarise + confidence check */}
      {aiCheck && (() => {
        const c = aiCheck.confidence;
        const tone =
          c >= 80
            ? { label: "Strong", color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", ring: "stroke-emerald-500" }
            : c >= 60
            ? { label: "Usable", color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", ring: "stroke-amber-500" }
            : { label: "Needs detail", color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30", ring: "stroke-destructive" };
        const dash = (c / 100) * 100;
        const typeLabel = UPDATE_TYPES.find((t) => t.id === aiCheck.detected_type)?.label;
        return (
          <div className={`rounded-xl border ${tone.border} ${tone.bg} p-3 space-y-2.5`}>
            <div className="flex items-start gap-3">
              {/* Confidence ring */}
              <div className="relative w-12 h-12 shrink-0">
                <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" className="stroke-muted" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15.9" fill="none"
                    className={tone.ring}
                    strokeWidth="3"
                    strokeDasharray={`${dash} 100`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className={`absolute inset-0 flex items-center justify-center text-[11px] font-semibold ${tone.color}`}>
                  {c}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">AI summary</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${tone.bg} ${tone.color} border ${tone.border}`}>
                    {tone.label}
                  </span>
                  {aiCheck.detected_type !== form.update_type && typeLabel && (
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, update_type: aiCheck.detected_type }))}
                      className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15"
                    >
                      Switch type → {typeLabel}
                    </button>
                  )}
                </div>
                {aiCheck.summary && (
                  <p className="text-sm text-foreground mt-1 leading-snug">{aiCheck.summary}</p>
                )}
                {aiCheck.confidence_reason && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">{aiCheck.confidence_reason}</p>
                )}
              </div>
            </div>

            {/* Suggested title */}
            {aiCheck.suggested_title && aiCheck.suggested_title.trim() && aiCheck.suggested_title !== form.title && (
              <div className="flex items-center gap-2 rounded-lg bg-background/60 border border-border p-2">
                <span className="text-[11px] text-muted-foreground shrink-0">Suggested title:</span>
                <span className="text-xs flex-1 truncate">{aiCheck.suggested_title}</span>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, title: aiCheck.suggested_title }))}
                  className="text-[11px] text-primary hover:underline shrink-0"
                >
                  Apply
                </button>
              </div>
            )}

            {/* Extracted attribution */}
            {aiCheck.extracted_attribution && aiCheck.extracted_attribution.trim() && !form.attribution.trim() && (
              <div className="flex items-center gap-2 rounded-lg bg-background/60 border border-border p-2">
                <span className="text-[11px] text-muted-foreground shrink-0">Found attribution:</span>
                <span className="text-xs flex-1 truncate">— {aiCheck.extracted_attribution}</span>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, attribution: aiCheck.extracted_attribution }))}
                  className="text-[11px] text-primary hover:underline shrink-0"
                >
                  Apply
                </button>
              </div>
            )}

            {/* Missing fields */}
            {aiCheck.missing_fields.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground mb-1">Missing details:</p>
                <div className="flex flex-wrap gap-1.5">
                  {aiCheck.missing_fields.map((m, i) => (
                    <span
                      key={i}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-background/60 border border-dashed border-muted-foreground/40 text-muted-foreground"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {aiCheck.warnings.length > 0 && (
              <div className="space-y-1">
                {aiCheck.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={reset}>
          Cancel
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={runAiCheck}
          disabled={aiChecking}
          className="gap-1"
        >
          {aiChecking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
          {aiCheck ? "Re-check" : "AI check & summarise"}
        </Button>
        <Button size="sm" onClick={save} disabled={saving} className="gap-1">
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          {editingId ? "Save changes" : "Add update"}
        </Button>
      </div>
    </div>
  );

  return (
    <div id="brand-updates" className="rounded-2xl border border-border bg-card p-4 sm:p-6 space-y-4 scroll-mt-20">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Newspaper className="h-4 w-4 text-primary shrink-0" />
          <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground truncate">Updates</h3>
          {(updates?.length || 0) > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              {updates!.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {(updates || []).some((u) => u.status === "active") && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-primary hover:text-primary"
              onClick={planFromUpdates}
              disabled={planning}
              title="Turn your latest updates into draft post ideas in the Content Hub"
            >
              {planning ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <ListChecks className="h-3 w-3" />
              )}
              <span className="hidden sm:inline">Plan content</span>
              <span className="sm:hidden">Plan</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-muted-foreground"
            onClick={() => {
              if (adding || editingId) reset();
              else setAdding(true);
            }}
          >
            <Plus className="h-3 w-3" /> Add
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Drop quick real-time updates — testimonials, events, product news, milestones. The AI uses these as fresh,
        factual material when planning ideas and creating posts (especially Social Proof, BTS, Announcements, and
        Trending).
      </p>

      {(adding || editingId) && (
        <div className="rounded-xl border border-primary/30 bg-muted/30 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{editingId ? "Edit update" : "New update"}</p>
            <button onClick={reset} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          {renderForm()}
        </div>
      )}

      {/* Filters */}
      {(updates?.length || 0) > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setFilterType(null)}
            className={`text-[11px] px-2 py-0.5 rounded-full border ${
              filterType === null ? "bg-foreground text-background border-foreground" : "bg-background text-muted-foreground border-border"
            }`}
          >
            All
          </button>
          {UPDATE_TYPES.filter((t) => counts.get(t.id)).map((t) => (
            <button
              key={t.id}
              onClick={() => setFilterType(filterType === t.id ? null : t.id)}
              className={`text-[11px] px-2 py-0.5 rounded-full border ${
                filterType === t.id
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground border-border"
              }`}
            >
              {t.emoji} {t.label} <span className="opacity-60">{counts.get(t.id)}</span>
            </button>
          ))}
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="ml-auto text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          >
            {showArchived ? "Show active" : "Show archived"}
          </button>
        </div>
      )}

      {/* Expiry warnings banner */}
      {(expiringSoon.length > 0 || expired.length > 0) && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-400">
            <Calendar className="h-3.5 w-3.5" />
            Heads up — some updates need attention
          </div>
          {expiringSoon.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              {expiringSoon.length} update{expiringSoon.length === 1 ? "" : "s"} expiring within 7 days. Refresh, extend, or archive before the AI stops using {expiringSoon.length === 1 ? "it" : "them"}.
            </p>
          )}
          {expired.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              {expired.length} expired update{expired.length === 1 ? "" : "s"} are no longer being used. Archive or extend the expiry date.
            </p>
          )}
        </div>
      )}

      {/* AI follow-up questions for low-confidence updates */}
      {followUps.length > 0 && (
        <div
          id="brand-updates-followups"
          className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 space-y-2 scroll-mt-20"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-medium text-rose-700 dark:text-rose-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              {followUps.length} update{followUps.length === 1 ? "" : "s"} need a quick detail before the AI can plan strong posts
            </div>
            <button
              onClick={() => setFollowUps([])}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              Dismiss
            </button>
          </div>
          <ul className="space-y-1.5">
            {followUps.map((f) => (
              <li key={f.update_id} className="rounded-lg bg-background/60 border border-border p-2.5">
                <p className="text-xs text-foreground">{f.question}</p>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-muted-foreground truncate">
                    On: {f.update_title}
                    {typeof f.confidence === "number" ? ` · confidence ${f.confidence}/100` : ""}
                  </span>
                  <button
                    onClick={() => answerFollowUp(f.update_id)}
                    className="text-[11px] font-medium text-primary hover:underline shrink-0"
                  >
                    Answer →
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-muted-foreground">
            Tip: after answering, run <span className="font-medium">AI check &amp; summarise</span> in the form to refresh the confidence score, then save.
          </p>
        </div>
      )}

      {/* List */}
      {filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map((u) => {
            const meta = TYPE_META[u.update_type] || TYPE_META.other;
            const expDays = daysUntilExpiry(u.expires_at);
            const isExpired = expDays !== null && expDays < 0;
            const isExpiringSoon = expDays !== null && expDays >= 0 && expDays <= 7;
            return (
              <div
                key={u.id}
                className={`rounded-xl border p-3 flex gap-3 ${
                  isExpired
                    ? "border-destructive/30 bg-destructive/5 opacity-70"
                    : isExpiringSoon
                    ? "border-amber-500/40 bg-amber-500/5"
                    : "border-border bg-background/40"
                }`}
              >
                {u.image_url ? (
                  <img src={u.image_url} alt="" className="w-12 h-12 object-cover rounded-lg border border-border shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-muted/50 border border-border flex items-center justify-center text-base shrink-0">
                    {meta.emoji}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                          {meta.emoji} {meta.label}
                        </span>
                        {(() => {
                          const t = tierFor(u.confidence);
                          const tm = tierMeta[t];
                          return (
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded-full border ${tm.cls}`}
                              title={`${tm.help}${typeof u.confidence === "number" ? ` (confidence ${u.confidence}/100)` : " (no AI check yet)"}`}
                            >
                              {tm.label}
                              {typeof u.confidence === "number" ? ` · ${u.confidence}` : ""}
                            </span>
                          );
                        })()}
                        <span className="text-[10px] text-muted-foreground">{u.event_date}</span>
                        {u.times_used > 0 && (
                          <span className="text-[10px] text-muted-foreground">• used {u.times_used}×</span>
                        )}
                        {(() => {
                          const days = daysUntilExpiry(u.expires_at);
                          if (days === null) return null;
                          if (days < 0) {
                            return (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive border border-destructive/30">
                                Expired
                              </span>
                            );
                          }
                          if (days <= 7) {
                            return (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                                {days === 0 ? "Expires today" : `Expires in ${days}d`}
                              </span>
                            );
                          }
                          return (
                            <span className="text-[10px] text-muted-foreground">• expires {u.expires_at}</span>
                          );
                        })()}
                      </div>
                      {u.title && <p className="text-sm font-medium mt-1 truncate">{u.title}</p>}
                      {u.content && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-3 whitespace-pre-wrap">{u.content}</p>
                      )}
                      {u.attribution && (
                        <p className="text-[11px] text-muted-foreground/80 mt-0.5">— {u.attribution}</p>
                      )}
                      {u.source_url && (
                        <a
                          href={u.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-primary inline-flex items-center gap-1 mt-1 hover:underline"
                        >
                          Source <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => startEdit(u)}
                        className="w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground"
                        aria-label="Edit"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => archiveToggle(u)}
                        className="w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground"
                        aria-label={u.status === "active" ? "Archive" : "Restore"}
                      >
                        {u.status === "active" ? <Archive className="h-3 w-3" /> : <ArchiveRestore className="h-3 w-3" />}
                      </button>
                      <button
                        onClick={() => remove(u.id)}
                        className="w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : !adding && !editingId ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 space-y-2">
          <p className="text-sm text-muted-foreground">
            {showArchived ? "No archived updates." : "No updates yet. Try one of these to get started:"}
          </p>
          {!showArchived && (
            <ul className="space-y-1">
              {EXAMPLE_PROMPTS.map((p, i) => (
                <li key={i} className="text-xs text-muted-foreground/90 italic">
                  • {p}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
