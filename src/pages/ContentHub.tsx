import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useBrand } from "@/hooks/useBrand";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { motion } from "framer-motion";
import {
  Sparkles,
  RefreshCw,
  ArrowRight,
  Calendar,
  Loader2,
  Layers,
  Repeat,
  Megaphone,
  Lightbulb,
  Check,
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Play,
  TrendingUp,
  Gift,
  Palette,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Zap,
  AlertTriangle,
  RotateCcw,
  MoreHorizontal,
  Clock,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import CalendarExport from "@/components/CalendarExport";
import AudienceContextBanner from "@/components/content/AudienceContextBanner";
import { CategoryBadge, CategoryBadgeList, CategoryDot } from "@/components/content/CategoryBadge";
import CategoryCoveragePanel from "@/components/content/CategoryCoveragePanel";
import { CONTENT_CATEGORIES, parseCategoryIds, type ContentCategoryId } from "@/lib/contentCategories";
import { getUpcomingHolidays, type UpcomingHoliday } from "@/lib/holidayCalendar";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_LABELS: Record<string, string> = {
  monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu",
  friday: "Fri", saturday: "Sat", sunday: "Sun",
};

// --- Pillar form state ---
interface PillarForm {
  name: string;
  description: string;
  icon_emoji: string;
  content_category: string; // comma-separated ids; pillars can cover multiple
}
const emptyPillar: PillarForm = { name: "", description: "", icon_emoji: "📌", content_category: "" };

// --- Series form state ---
interface SeriesForm {
  name: string;
  description: string;
  recurrence: string;
  preferred_day: string;
  visual_style_notes: string;
  pillar_id: string;
  content_category: string; // single id
}
const emptySeries: SeriesForm = { name: "", description: "", recurrence: "weekly", preferred_day: "", visual_style_notes: "", pillar_id: "", content_category: "" };

// --- Campaign form state ---
interface CampaignForm {
  name: string;
  description: string;
  post_count: number;
  content_category: string; // single id
}
const emptyCampaign: CampaignForm = { name: "", description: "", post_count: 5, content_category: "" };

// --- Idea form state ---
interface IdeaForm {
  title: string;
  prompt: string;
  pillar_id: string;
  series_id: string;
  campaign_id: string;
  content_format: string;
  autopilot: boolean;
  content_category: string; // single id
}
const emptyIdea: IdeaForm = { title: "", prompt: "", pillar_id: "", series_id: "", campaign_id: "", content_format: "graphic", autopilot: false, content_category: "" };

const EMOJI_OPTIONS = ["📌", "🎓", "💡", "🎯", "🔥", "💬", "🛒", "🎨", "📸", "🏷️", "❤️", "⭐", "🚀", "🧠", "🤝", "📢"];

const ContentHub = () => {
  const { user } = useAuth();
  const { brand } = useBrand();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const strategistPrompt = searchParams.get("strategist_prompt");

  const [generating, setGenerating] = useState<string | null>(null);
  const [initialSetupDone, setInitialSetupDone] = useState(false);
  const [regenPending, setRegenPending] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [trendRefreshing, setTrendRefreshing] = useState(false);
  const [selectedTrend, setSelectedTrend] = useState<any>(null);
  const [showAllTrends, setShowAllTrends] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    trends: false,
    pillars: false,
    calendar: true,
    series: false,
    campaigns: false,
  });

  const toggleSection = (key: string) => setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  // Credit confirmation dialog state
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);

  // Pillar dialog
  const [pillarDialogOpen, setPillarDialogOpen] = useState(false);
  const [editingPillarId, setEditingPillarId] = useState<string | null>(null);
  const [pillarForm, setPillarForm] = useState<PillarForm>(emptyPillar);
  const [pillarSaving, setPillarSaving] = useState(false);

  // Series dialog
  const [seriesDialogOpen, setSeriesDialogOpen] = useState(false);
  const [editingSeriesId, setEditingSeriesId] = useState<string | null>(null);
  const [seriesForm, setSeriesForm] = useState<SeriesForm>(emptySeries);
  const [seriesSaving, setSeriesSaving] = useState(false);

  // Campaign dialog
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [campaignForm, setCampaignForm] = useState<CampaignForm>(emptyCampaign);
  const [campaignSaving, setCampaignSaving] = useState(false);

  // Idea dialog
  const [ideaDialogOpen, setIdeaDialogOpen] = useState(false);
  const [editingIdeaId, setEditingIdeaId] = useState<string | null>(null);
  const [ideaForm, setIdeaForm] = useState<IdeaForm>(emptyIdea);
  const [ideaDay, setIdeaDay] = useState<string>("");
  const [ideaSaving, setIdeaSaving] = useState(false);

  const brandId = brand?.id;

  // Autopilot settings from database
  const { data: autopilotSettings } = useQuery({
    queryKey: ["autopilot-settings", brandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("autopilot_settings")
        .select("*")
        .eq("brand_id", brandId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!brandId,
  });

  const autopilotAll = autopilotSettings?.enabled ?? false;
  const deliveryTime = autopilotSettings?.delivery_time ?? "morning";
  const autopilotTimezone = (autopilotSettings as any)?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  const updateAutopilotSetting = async (updates: { enabled?: boolean; delivery_time?: string; timezone?: string }) => {
    if (!brandId || !user) return;
    const { data: existing } = await supabase
      .from("autopilot_settings")
      .select("id")
      .eq("brand_id", brandId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("autopilot_settings")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("brand_id", brandId);
    } else {
      await supabase
        .from("autopilot_settings")
        .insert({
          brand_id: brandId,
          user_id: user.id,
          enabled: updates.enabled ?? false,
          delivery_time: updates.delivery_time ?? "morning",
          timezone: updates.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
    }
    queryClient.invalidateQueries({ queryKey: ["autopilot-settings", brandId] });
  };

  // Last autopilot run
  const { data: lastAutopilotRun } = useQuery({
    queryKey: ["last-autopilot-run"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("autopilot_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: autopilotAll,
  });

  // Compute next scheduled run time
  const getNextRunTime = () => {
    if (!autopilotAll) return null;
    const timeMap: Record<string, number> = { morning: 6, afternoon: 12, evening: 18 };
    const targetHourUTC = timeMap[deliveryTime] ?? 6;
    const now = new Date();
    const next = new Date(now);
    next.setUTCHours(targetHourUTC, 0, 0, 0);
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    return next;
  };

  const formatRunResult = (run: any) => {
    if (!run) return null;
    const date = new Date(run.started_at);
    const timeStr = date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    if (run.errors > 0 && run.processed === 0) return { label: `Failed — ${timeStr}`, status: "error" as const };
    if (run.processed > 0) return { label: `${run.processed} created — ${timeStr}`, status: "success" as const };
    return { label: `No ideas — ${timeStr}`, status: "neutral" as const };
  };

  const [runningAutopilot, setRunningAutopilot] = useState(false);
  const triggerAutopilotNow = async () => {
    if (!brandId || runningAutopilot) return;
    setRunningAutopilot(true);
    try {
      const { data, error } = await supabase.functions.invoke("content-autopilot", {
        body: { delivery_time: deliveryTime },
      });
      toast({
        title: data?.processed > 0 ? `✅ ${data.processed} design${data.processed > 1 ? "s" : ""} created` : "No ideas to process",
        description: data?.processed > 0
          ? "Check your calendar for the new designs"
          : data?.total === 0
            ? "No autopilot ideas are scheduled for today"
            : `${data?.skipped || 0} skipped, ${data?.errors || 0} errors`,
      });
      queryClient.invalidateQueries({ queryKey: ["weekly-ideas", brandId] });
    } catch (e) {
      toast({ title: "Autopilot run failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setRunningAutopilot(false);
    }
  };

  const { data: pillars, isLoading: pillarsLoading } = useQuery({
    queryKey: ["content-pillars", brandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_pillars")
        .select("*")
        .eq("brand_id", brandId!)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!brandId,
  });

  const { data: series, isLoading: seriesLoading } = useQuery({
    queryKey: ["post-series", brandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("post_series")
        .select("*")
        .eq("brand_id", brandId!);
      if (error) throw error;
      return data;
    },
    enabled: !!brandId,
  });

  const { data: campaigns, isLoading: campaignsLoading } = useQuery({
    queryKey: ["campaigns", brandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("brand_id", brandId!);
      if (error) throw error;
      return data;
    },
    enabled: !!brandId,
  });

  // Compute Monday of the selected week
  const getWeekMonday = useCallback((offset: number) => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7) + offset * 7);
    return monday;
  }, []);

  const selectedMonday = getWeekMonday(weekOffset);
  const selectedSunday = new Date(selectedMonday);
  selectedSunday.setDate(selectedMonday.getDate() + 6);

  const weekLabel = weekOffset === 0
    ? "This Week"
    : weekOffset === 1
      ? "Next Week"
      : weekOffset === -1
        ? "Last Week"
        : `${selectedMonday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${selectedSunday.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  const { data: weeklyIdeas, isLoading: ideasLoading } = useQuery({
    queryKey: ["weekly-ideas", brandId, weekOffset],
    queryFn: async () => {
      const monday = getWeekMonday(weekOffset);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      const { data, error } = await supabase
        .from("content_ideas")
        .select("*")
        .eq("brand_id", brandId!)
        .gte("scheduled_for", monday.toISOString().split("T")[0])
        .lte("scheduled_for", sunday.toISOString().split("T")[0])
        .order("scheduled_for");
      if (error) throw error;
      return data;
    },
    enabled: !!brandId,
  });

  // Trend Intel query
  const { data: trendIntel, isLoading: trendIntelLoading } = useQuery({
    queryKey: ["trend-intel", brandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brand_trend_intel")
        .select("*")
        .eq("brand_id", brandId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!brandId,
  });

  const callTrendScout = async (body: Record<string, any>) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) throw new Error("Not authenticated");

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trend-scout`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Failed" }));
      if (res.status === 402) {
        toast({ title: "Not enough credits", description: err.error || "You need more credits for this action.", variant: "destructive" });
        throw new Error("Credits exhausted");
      }
      if (res.status === 429) {
        toast({ title: "Rate limited", description: "Please try again in a moment.", variant: "destructive" });
        throw new Error("Rate limited");
      }
      toast({ title: "Trend research failed", description: err.error || "Please try again.", variant: "destructive" });
      throw new Error(err.error || "Failed");
    }

    return res.json();
  };

  const refreshTrendIntelInner = async () => {
    setTrendRefreshing(true);
    try {
      await callTrendScout({ brand_id: brandId, force_refresh: true });
      queryClient.invalidateQueries({ queryKey: ["trend-intel", brandId] });
      toast({ title: "Trend intel updated!", description: "Latest industry trends have been researched." });
    } catch (e: any) {
      if (!["Rate limited", "Credits exhausted"].includes(e.message)) {
        toast({ title: "Error", description: e.message, variant: "destructive" });
      }
    } finally {
      setTrendRefreshing(false);
    }
  };

  const refreshTrendIntel = async () => {
    try {
      const status = await callTrendScout({ brand_id: brandId, check_only: true });
      if (status.is_free) {
        await refreshTrendIntelInner();
      } else {
        setPendingAction(() => refreshTrendIntelInner);
        setCreditDialogOpen(true);
      }
    } catch (e: any) {
      // If check fails, proceed anyway
      if (!["Rate limited", "Credits exhausted"].includes(e.message)) {
        await refreshTrendIntelInner();
      }
    }
  };

  // Auto-generate on first visit if no pillars exist
  useEffect(() => {
    if (brandId && !pillarsLoading && pillars && pillars.length === 0 && !initialSetupDone && !generating) {
      setInitialSetupDone(true);
      handleFullGenerate();
    }
  }, [brandId, pillarsLoading, pillars, initialSetupDone, generating]);

  // --- Engine Actions ---
  const callEngine = async (action: string, extra: Record<string, any> = {}) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) throw new Error("Not authenticated");

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/brand-engine`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, brand_id: brandId, ...extra }),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Request failed" }));
      if (res.status === 429) {
        toast({ title: "Rate limited", description: "Please try again in a moment.", variant: "destructive" });
        throw new Error("Rate limited");
      }
      if (res.status === 402) {
        toast({ title: "Not enough credits", description: err.error || "You need more credits for this action.", variant: "destructive" });
        throw new Error("Credits exhausted");
      }
      throw new Error(err.error || "Failed");
    }
    return res.json();
  };

  // Check if generation is free or costs credits, show dialog if needed
  const checkCreditsAndProceed = async (actionFn: () => Promise<void>) => {
    try {
      const status = await callEngine("check_content_gen_status");
      if (status.is_free) {
        await actionFn();
      } else {
        // Show confirmation dialog
        setPendingAction(() => actionFn);
        setCreditDialogOpen(true);
      }
    } catch (e: any) {
      console.error("Credit check failed:", e);
      // If check fails, proceed anyway (the backend will enforce)
      await actionFn();
    }
  };

  const handleCreditDialogProceed = async () => {
    setCreditDialogOpen(false);
    if (pendingAction) {
      await pendingAction();
      setPendingAction(null);
    }
  };

  const handleCreditDialogCancel = () => {
    setCreditDialogOpen(false);
    setPendingAction(null);
  };

  // Silent auto-regen of weekly ideas after strategy changes
  const silentRegenWeeklyIdeas = useCallback(async () => {
    const hasPillarsData = pillars && pillars.length > 0;
    const hasSeriesData = series && series.length > 0;
    const hasCampaignsData = campaigns && campaigns.length > 0;
    if (!hasPillarsData && !hasSeriesData && !hasCampaignsData) return;
    if (regenPending || generating) return;

    setRegenPending(true);
    toast({ title: "Updating your weekly plan..." });
    try {
      // Check if free first; if not free, skip silently (don't charge without user consent)
      const status = await callEngine("check_content_gen_status");
      if (!status.is_free) {
        console.log("Silent regen skipped — would cost credits");
        setRegenPending(false);
        return;
      }
      await callEngine("generate_weekly_ideas");
      queryClient.invalidateQueries({ queryKey: ["weekly-ideas", brandId] });
      toast({ title: "Weekly plan updated" });
    } catch (e: any) {
      console.error("Silent regen failed:", e);
    } finally {
      setRegenPending(false);
    }
  }, [brandId, pillars, series, campaigns, regenPending, generating]);

  const handleGenerateInner = async (action: string) => {
    setGenerating(action);
    try {
      const extra: Record<string, any> = {};
      if (action === "generate_weekly_ideas") {
        extra.week_offset = weekOffset;
      }
      await callEngine(action, extra);
      queryClient.invalidateQueries({ queryKey: ["content-pillars", brandId] });
      queryClient.invalidateQueries({ queryKey: ["post-series", brandId] });
      queryClient.invalidateQueries({ queryKey: ["campaigns", brandId] });
      queryClient.invalidateQueries({ queryKey: ["weekly-ideas", brandId] });
      toast({ title: "Generated!", description: `${action.replace("generate_", "").replace("_", " ")} created successfully.` });
    } catch (e: any) {
      if (!["Rate limited", "Credits exhausted"].includes(e.message)) {
        toast({ title: "Generation failed", description: e.message, variant: "destructive" });
      }
    } finally {
      setGenerating(null);
    }
  };

  const handleGenerate = async (action: string) => {
    await checkCreditsAndProceed(() => handleGenerateInner(action));
  };

  const handleFullGenerateInner = async () => {
    setGenerating("full");
    try {
      // First call checks credits; subsequent calls skip credit check
      await callEngine("generate_pillars");
      queryClient.invalidateQueries({ queryKey: ["content-pillars", brandId] });
      await callEngine("generate_series", { skip_credit_check: true });
      queryClient.invalidateQueries({ queryKey: ["post-series", brandId] });
      await callEngine("generate_campaigns", { skip_credit_check: true });
      queryClient.invalidateQueries({ queryKey: ["campaigns", brandId] });
      await callEngine("generate_weekly_ideas", { skip_credit_check: true });
      queryClient.invalidateQueries({ queryKey: ["weekly-ideas", brandId] });
      toast({ title: "Brand Engine ready!", description: "Your content strategy has been generated." });
    } catch (e: any) {
      if (!["Rate limited", "Credits exhausted"].includes(e.message)) {
        toast({ title: "Setup failed", description: e.message, variant: "destructive" });
      }
    } finally {
      setGenerating(null);
    }
  };

  const handleFullGenerate = async () => {
    await checkCreditsAndProceed(() => handleFullGenerateInner());
  };

  const handleFormatAction = (idea: any) => {
    const format = idea.content_format || "graphic";
    if (format === "carousel") {
      const params = new URLSearchParams({ mode: "carousel", prompt: idea.prompt, content_idea_id: idea.id });
      navigate(`/studio?${params.toString()}`);
    } else {
      const params = new URLSearchParams({ prompt: idea.prompt, content_idea_id: idea.id });
      navigate(`/studio?${params.toString()}`);
    }
  };

  // --- Pillar CRUD ---
  const openCreatePillar = () => {
    setPillarForm(emptyPillar);
    setEditingPillarId(null);
    setPillarDialogOpen(true);
  };

  const openEditPillar = (p: any) => {
    setPillarForm({
      name: p.name,
      description: p.description || "",
      icon_emoji: p.icon_emoji || "📌",
      content_category: parseCategoryIds(p.content_category).join(",") || "",
    });
    setEditingPillarId(p.id);
    setPillarDialogOpen(true);
  };

  const savePillar = async () => {
    if (!pillarForm.name.trim() || !brandId || !user) return;
    setPillarSaving(true);
    try {
      if (editingPillarId) {
        const { error } = await supabase
          .from("content_pillars")
          .update({ name: pillarForm.name.trim(), description: pillarForm.description.trim(), icon_emoji: pillarForm.icon_emoji })
          .eq("id", editingPillarId);
        if (error) throw error;
        toast({ title: "Pillar updated" });
      } else {
        const maxOrder = pillars ? Math.max(0, ...pillars.map((p: any) => p.sort_order || 0)) : 0;
        const { error } = await supabase
          .from("content_pillars")
          .insert({
            brand_id: brandId,
            user_id: user.id,
            name: pillarForm.name.trim(),
            description: pillarForm.description.trim(),
            icon_emoji: pillarForm.icon_emoji,
            sort_order: maxOrder + 1,
          });
        if (error) throw error;
        toast({ title: "Pillar created" });
      }
      queryClient.invalidateQueries({ queryKey: ["content-pillars", brandId] });
      setPillarDialogOpen(false);
      // Auto-regen weekly ideas
      setTimeout(() => silentRegenWeeklyIdeas(), 500);
    } catch (e: any) {
      toast({ title: "Failed to save", description: e.message, variant: "destructive" });
    } finally {
      setPillarSaving(false);
    }
  };

  const deletePillar = async (id: string) => {
    const { error } = await supabase.from("content_pillars").delete().eq("id", id);
    if (error) {
      toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["content-pillars", brandId] });
      toast({ title: "Pillar deleted" });
      setTimeout(() => silentRegenWeeklyIdeas(), 500);
    }
  };

  // --- Series CRUD ---
  const openCreateSeries = () => {
    setSeriesForm(emptySeries);
    setEditingSeriesId(null);
    setSeriesDialogOpen(true);
  };

  const openEditSeries = (s: any) => {
    setSeriesForm({
      name: s.name,
      description: s.description || "",
      recurrence: s.recurrence || "weekly",
      preferred_day: s.preferred_day || "",
      visual_style_notes: s.visual_style_notes || "",
      pillar_id: s.pillar_id || "",
    });
    setEditingSeriesId(s.id);
    setSeriesDialogOpen(true);
  };

  const saveSeries = async () => {
    if (!seriesForm.name.trim() || !brandId || !user) return;
    setSeriesSaving(true);
    try {
      const payload: any = {
        name: seriesForm.name.trim(),
        description: seriesForm.description.trim(),
        recurrence: seriesForm.recurrence,
        preferred_day: seriesForm.preferred_day || null,
        visual_style_notes: seriesForm.visual_style_notes.trim() || null,
        pillar_id: seriesForm.pillar_id || null,
      };

      if (editingSeriesId) {
        const { error } = await supabase.from("post_series").update(payload).eq("id", editingSeriesId);
        if (error) throw error;
        toast({ title: "Series updated" });
      } else {
        const { error } = await supabase.from("post_series").insert({
          ...payload,
          brand_id: brandId,
          user_id: user.id,
        });
        if (error) throw error;
        toast({ title: "Series created" });
      }
      queryClient.invalidateQueries({ queryKey: ["post-series", brandId] });
      setSeriesDialogOpen(false);
      setTimeout(() => silentRegenWeeklyIdeas(), 500);
    } catch (e: any) {
      toast({ title: "Failed to save", description: e.message, variant: "destructive" });
    } finally {
      setSeriesSaving(false);
    }
  };

  // --- Campaign CRUD ---
  const openCreateCampaign = () => {
    setCampaignForm(emptyCampaign);
    setEditingCampaignId(null);
    setCampaignDialogOpen(true);
  };

  const openEditCampaign = (c: any) => {
    setCampaignForm({ name: c.name, description: c.description || "", post_count: c.post_count || 5 });
    setEditingCampaignId(c.id);
    setCampaignDialogOpen(true);
  };

  const saveCampaign = async () => {
    if (!campaignForm.name.trim() || !brandId || !user) return;
    setCampaignSaving(true);
    try {
      const payload = {
        name: campaignForm.name.trim(),
        description: campaignForm.description.trim(),
        post_count: campaignForm.post_count,
      };
      if (editingCampaignId) {
        const { error } = await supabase.from("campaigns").update(payload).eq("id", editingCampaignId);
        if (error) throw error;
        toast({ title: "Campaign updated" });
      } else {
        const { error } = await supabase.from("campaigns").insert({ ...payload, brand_id: brandId, user_id: user.id });
        if (error) throw error;
        toast({ title: "Campaign created" });
      }
      queryClient.invalidateQueries({ queryKey: ["campaigns", brandId] });
      setCampaignDialogOpen(false);
      setTimeout(() => silentRegenWeeklyIdeas(), 500);
    } catch (e: any) {
      toast({ title: "Failed to save", description: e.message, variant: "destructive" });
    } finally {
      setCampaignSaving(false);
    }
  };

  const deleteCampaign = async (id: string) => {
    const { error } = await supabase.from("campaigns").delete().eq("id", id);
    if (error) {
      toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["campaigns", brandId] });
      toast({ title: "Campaign deleted" });
      setTimeout(() => silentRegenWeeklyIdeas(), 500);
    }
  };

  const deleteSeries = async (id: string) => {
    const { error } = await supabase.from("post_series").delete().eq("id", id);
    if (error) {
      toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["post-series", brandId] });
      toast({ title: "Series deleted" });
      setTimeout(() => silentRegenWeeklyIdeas(), 500);
    }
  };

  // --- Idea CRUD ---
  const getDateForDay = (day: string) => {
    const monday = getWeekMonday(weekOffset);
    const dayIndex = DAYS.indexOf(day);
    const date = new Date(monday);
    date.setDate(monday.getDate() + dayIndex);
    return date.toISOString().split("T")[0];
  };

  const openCreateIdea = (day: string) => {
    setIdeaForm({ ...emptyIdea, autopilot: autopilotAll });
    setEditingIdeaId(null);
    setIdeaDay(day);
    setIdeaDialogOpen(true);
  };

  const openEditIdea = (idea: any) => {
    setIdeaForm({
      title: idea.title,
      prompt: idea.prompt,
      pillar_id: idea.pillar_id || "",
      series_id: idea.series_id || "",
      campaign_id: idea.campaign_id || "",
      content_format: idea.content_format || "graphic",
      autopilot: idea.autopilot || false,
    });
    setEditingIdeaId(idea.id);
    // Determine day from scheduled_for
    if (idea.scheduled_for) {
      const d = new Date(idea.scheduled_for);
      const dayIndex = (d.getDay() + 6) % 7;
      setIdeaDay(DAYS[dayIndex]);
    }
    setIdeaDialogOpen(true);
  };

  const saveIdea = async () => {
    if (!ideaForm.title.trim() || !ideaForm.prompt.trim() || !brandId || !user) return;
    setIdeaSaving(true);
    try {
      const payload: any = {
        title: ideaForm.title.trim(),
        prompt: ideaForm.prompt.trim(),
        pillar_id: ideaForm.pillar_id || null,
        series_id: ideaForm.series_id || null,
        campaign_id: ideaForm.campaign_id || null,
        content_format: ideaForm.content_format || "graphic",
        autopilot: ideaForm.autopilot,
      };

      if (editingIdeaId) {
        const { error } = await supabase.from("content_ideas").update(payload).eq("id", editingIdeaId);
        if (error) throw error;
        toast({ title: "Idea updated" });
      } else {
        const { error } = await supabase.from("content_ideas").insert({
          ...payload,
          brand_id: brandId,
          user_id: user.id,
          status: "scheduled",
          idea_type: "single",
          scheduled_for: getDateForDay(ideaDay),
        });
        if (error) throw error;
        toast({ title: "Idea added" });
      }
      queryClient.invalidateQueries({ queryKey: ["weekly-ideas", brandId] });
      setIdeaDialogOpen(false);
    } catch (e: any) {
      toast({ title: "Failed to save", description: e.message, variant: "destructive" });
    } finally {
      setIdeaSaving(false);
    }
  };

  const deleteIdea = async (id: string) => {
    const { error } = await supabase.from("content_ideas").delete().eq("id", id);
    if (error) {
      toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["weekly-ideas", brandId] });
      toast({ title: "Idea removed" });
    }
  };

  const isLoading = pillarsLoading || seriesLoading || campaignsLoading || ideasLoading;
  const hasPillars = pillars && pillars.length > 0;

  // Build weekly calendar
  const ideasByDay = DAYS.reduce((acc, day) => {
    acc[day] = (weeklyIdeas || []).filter((i: any) => {
      if (!i.scheduled_for) return false;
      const d = new Date(i.scheduled_for);
      const dayIndex = (d.getDay() + 6) % 7;
      return DAYS[dayIndex] === day;
    });
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-8"
        >
          {/* Header */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif tracking-tight">Content Hub</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Your content strategy, powered by AI
            </p>
          </div>

          {/* Strategist prompt banner */}
          {strategistPrompt && (
            <Card className="border-primary/30 bg-primary/[0.04]">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary shrink-0" />
                  <p className="text-xs font-medium">From your Brand Strategist</p>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{strategistPrompt}</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="h-7 text-xs gap-1.5 rounded-lg"
                    onClick={() => {
                      // Clear the param and generate weekly ideas
                      setSearchParams({});
                      handleGenerate("generate_weekly_ideas");
                    }}
                    disabled={!!generating}
                  >
                    {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    Generate Ideas
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs rounded-lg"
                    onClick={() => setSearchParams({})}
                  >
                    Dismiss
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Upcoming Events Card */}
          {(() => {
            const upcoming = getUpcomingHolidays(14);
            if (upcoming.length === 0) return null;
            return (
              <Card className="border-primary/20 bg-primary/[0.03]">
                <CardContent className="p-4 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Gift className="h-4 w-4 text-primary" />
                    <h2 className="text-sm font-semibold">Upcoming Events</h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {upcoming.slice(0, 4).map((h, i) => {
                      const dateLabel = h.date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                      const urgency = h.daysUntil <= 0 ? "Today" : h.daysUntil === 1 ? "Tomorrow" : `In ${h.daysUntil} days`;
                      return (
                        <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate">{h.name}</p>
                            <p className="text-[10px] text-muted-foreground">{dateLabel} · {urgency}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[10px] gap-1 shrink-0"
                            onClick={() => {
                              const prompt = `Create a ${h.name} themed post for ${brand?.name || "my brand"}`;
                              navigate(`/studio?prompt=${encodeURIComponent(prompt)}`);
                            }}
                          >
                            <Palette className="h-2.5 w-2.5" />
                            Design
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Loading / Empty state */}
          {generating === "full" && !hasPillars && (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                <p className="text-sm text-muted-foreground">
                  Analyzing your brand and building your content strategy…
                </p>
                <p className="text-xs text-muted-foreground/60">
                  This may take up to 30 seconds
                </p>
              </CardContent>
            </Card>
          )}

          <Collapsible open={openSections.calendar} onOpenChange={() => toggleSection("calendar")}>
            <section className="space-y-3">
              <CollapsibleTrigger asChild>
                <button className="flex items-center justify-between w-full hover:opacity-80 transition-opacity">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <h2 className="text-base font-semibold">{openSections.calendar ? weekLabel : "Content Calendar"}</h2>
                    {regenPending && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                    {(() => { const count = (weeklyIdeas || []).filter((i: any) => i.autopilot).length; return count > 0 ? <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">⚡ {count}</span> : null; })()}
                  </div>
                  {openSections.calendar ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 animate-accordion-down data-[state=closed]:animate-accordion-up">
                {/* Autopilot Settings */}
                <Card className={`border transition-colors ${autopilotAll ? "border-primary/40 bg-primary/[0.04]" : "border-border/60"}`}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`flex items-center justify-center h-7 w-7 rounded-lg ${autopilotAll ? "bg-primary/15" : "bg-muted"} transition-colors`}>
                          <Zap className={`h-3.5 w-3.5 ${autopilotAll ? "text-primary" : "text-muted-foreground"} transition-colors`} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium">Autopilot</p>
                          <p className="text-[11px] text-muted-foreground leading-tight">
                            Brandie will automatically create and email your designs on scheduled days
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={autopilotAll}
                        onCheckedChange={async (checked) => {
                          await updateAutopilotSetting({ enabled: checked });
                          toast({
                            title: checked ? "Autopilot enabled" : "Autopilot disabled",
                            description: checked
                              ? "New ideas will have autopilot enabled by default"
                              : "New ideas will no longer auto-generate",
                          });
                          // Bulk cascade: when enabling, offer to enable for existing scheduled ideas
                          if (checked && weeklyIdeas && weeklyIdeas.length > 0) {
                            const nonAutopilotIdeas = weeklyIdeas.filter((i: any) => !i.autopilot && i.status !== "created");
                            if (nonAutopilotIdeas.length > 0) {
                              const confirm = window.confirm(
                                `Enable autopilot for ${nonAutopilotIdeas.length} existing scheduled idea${nonAutopilotIdeas.length > 1 ? "s" : ""} this week?`
                              );
                              if (confirm) {
                                const ids = nonAutopilotIdeas.map((i: any) => i.id);
                                await supabase.from("content_ideas").update({ autopilot: true } as any).in("id", ids);
                                queryClient.invalidateQueries({ queryKey: ["weekly-ideas", brandId] });
                                toast({ title: `${nonAutopilotIdeas.length} ideas set to autopilot ⚡` });
                              }
                            }
                          }
                        }}
                      />
                    </div>
                    {autopilotAll && (
                      <>
                      <div className="flex items-center gap-3 pl-9.5">
                        <Label htmlFor="delivery-time" className="text-xs text-muted-foreground whitespace-nowrap">
                          Delivery time
                        </Label>
                        <Select value={deliveryTime} onValueChange={(val) => updateAutopilotSetting({ delivery_time: val })}>
                          <SelectTrigger id="delivery-time" className="h-8 text-xs w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="morning">🌅 Morning (6 AM)</SelectItem>
                            <SelectItem value="afternoon">☀️ Afternoon (12 PM)</SelectItem>
                            <SelectItem value="evening">🌙 Evening (6 PM)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-3 pl-9.5">
                        <Label htmlFor="timezone" className="text-xs text-muted-foreground whitespace-nowrap">
                          Timezone
                        </Label>
                        <Select value={autopilotTimezone} onValueChange={(val) => updateAutopilotSetting({ timezone: val })}>
                          <SelectTrigger id="timezone" className="h-8 text-xs w-52">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="max-h-60">
                            <SelectItem value="Africa/Lagos">🇳🇬 Lagos (WAT)</SelectItem>
                            <SelectItem value="Africa/Johannesburg">🇿🇦 Johannesburg (SAST)</SelectItem>
                            <SelectItem value="Africa/Nairobi">🇰🇪 Nairobi (EAT)</SelectItem>
                            <SelectItem value="Africa/Cairo">🇪🇬 Cairo (EET)</SelectItem>
                            <SelectItem value="Africa/Accra">🇬🇭 Accra (GMT)</SelectItem>
                            <SelectItem value="Europe/London">🇬🇧 London (GMT/BST)</SelectItem>
                            <SelectItem value="Europe/Paris">🇫🇷 Paris (CET)</SelectItem>
                            <SelectItem value="America/New_York">🇺🇸 New York (EST)</SelectItem>
                            <SelectItem value="America/Chicago">🇺🇸 Chicago (CST)</SelectItem>
                            <SelectItem value="America/Denver">🇺🇸 Denver (MST)</SelectItem>
                            <SelectItem value="America/Los_Angeles">🇺🇸 Los Angeles (PST)</SelectItem>
                            <SelectItem value="Asia/Dubai">🇦🇪 Dubai (GST)</SelectItem>
                            <SelectItem value="Asia/Kolkata">🇮🇳 Mumbai (IST)</SelectItem>
                            <SelectItem value="Asia/Singapore">🇸🇬 Singapore (SGT)</SelectItem>
                            <SelectItem value="Asia/Tokyo">🇯🇵 Tokyo (JST)</SelectItem>
                            <SelectItem value="Australia/Sydney">🇦🇺 Sydney (AEST)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      </>
                    )}
                    {autopilotAll && (
                      <div className="flex items-center gap-2 pl-9.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1.5"
                          disabled={runningAutopilot}
                          onClick={triggerAutopilotNow}
                        >
                          {runningAutopilot ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                          Run Autopilot Now
                        </Button>
                      </div>
                    )}
                    {autopilotAll && (
                      <div className="space-y-1.5 pl-9.5">
                        {(() => {
                          const next = getNextRunTime();
                          if (!next) return null;
                          return (
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>Next run: <span className="font-medium text-foreground">{next.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span></span>
                            </div>
                          );
                        })()}
                        {(() => {
                          const result = formatRunResult(lastAutopilotRun);
                          if (!result) return null;
                          return (
                            <div className={`flex items-center gap-1.5 text-[11px] ${result.status === "success" ? "text-emerald-600 dark:text-emerald-400" : result.status === "error" ? "text-destructive" : "text-muted-foreground"}`}>
                              {result.status === "success" ? <Check className="h-3 w-3" /> : result.status === "error" ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                              <span>Last run: {result.label}</span>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </CardContent>
                </Card>
                {/* Autopilot run summary */}
                {autopilotAll && (() => {
                  const allIdeas = weeklyIdeas || [];
                  const autopilotIdeas = allIdeas.filter((i: any) => i.autopilot);
                  if (autopilotIdeas.length === 0) return null;
                  const completed = autopilotIdeas.filter((i: any) => i.autopilot_status === "completed").length;
                  const processing = autopilotIdeas.filter((i: any) => i.autopilot_status === "processing").length;
                  const failedCredits = autopilotIdeas.filter((i: any) => i.autopilot_status === "failed_no_credits").length;
                  const failedError = autopilotIdeas.filter((i: any) => i.autopilot_status === "failed_error").length;
                  const pending = autopilotIdeas.filter((i: any) => !i.autopilot_status || i.autopilot_status === "pending").length;
                  const failed = failedCredits + failedError;
                  if (completed === 0 && failed === 0 && processing === 0) return null;
                  return (
                    <div className="flex items-center gap-3 flex-wrap text-[11px] px-1">
                      <span className="text-muted-foreground font-medium">Autopilot this week:</span>
                      {completed > 0 && (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <Check className="h-3 w-3" /> {completed} created
                        </span>
                      )}
                      {processing > 0 && (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <Loader2 className="h-3 w-3 animate-spin" /> {processing} processing
                        </span>
                      )}
                      {pending > 0 && (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Zap className="h-3 w-3" /> {pending} queued
                        </span>
                      )}
                      {failedCredits > 0 && (
                        <span className="inline-flex items-center gap-1 text-destructive">
                          <AlertTriangle className="h-3 w-3" /> {failedCredits} no credits
                        </span>
                      )}
                      {failedError > 0 && (
                        <span className="inline-flex items-center gap-1 text-destructive">
                          <RotateCcw className="h-3 w-3" /> {failedError} retrying
                        </span>
                      )}
                    </div>
                  );
                })()}
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setWeekOffset((o) => o - 1)} title="Previous week">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {weekOffset !== 0 && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => setWeekOffset(0)}>Today</Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setWeekOffset((o) => o + 1)} title="Next week">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => handleGenerate("generate_weekly_ideas")} disabled={!!generating}>
                    {generating === "generate_weekly_ideas" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    Generate Ideas
                  </Button>
                  <CalendarExport
                    weeklyIdeas={weeklyIdeas}
                    brand={brand}
                    pillars={pillars}
                    series={series}
                    campaigns={campaigns}
                    weekLabel={weekLabel}
                    selectedMonday={selectedMonday}
                    selectedSunday={selectedSunday}
                  />
                </div>
                <Card>
                  <CardContent className="p-0 divide-y divide-border">
                    {DAYS.map((day) => {
                      const dayIdeas = ideasByDay[day] || [];
                      const todayIndex = (new Date().getDay() + 6) % 7;
                      const isToday = DAYS[todayIndex] === day;
                      return (
                        <div key={day} className={`flex items-center gap-3 px-4 py-3 group/day ${isToday ? "bg-brandie-neon/10" : ""}`}>
                          <span className={`text-xs font-medium w-8 shrink-0 ${isToday ? "text-brandie-neon font-bold" : "text-muted-foreground"}`}>
                            {DAY_LABELS[day]}
                          </span>
                          <div className="flex-1 min-w-0">
                            {dayIdeas.length === 0 ? (
                              <span className="text-xs text-muted-foreground/50">—</span>
                            ) : (
                              <div className="space-y-1.5">
                                {dayIdeas.map((idea: any) => (
                                  <div key={idea.id} className="flex items-center gap-2 group/idea">
                                    {idea.status === "created" ? (
                                      <Check className="h-3 w-3 text-green-500 shrink-0" />
                                    ) : (
                                      <Lightbulb className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                                    )}
                                    <span className={`text-xs truncate ${idea.status === "created" ? "text-muted-foreground line-through" : "text-foreground"}`}>
                                      {idea.title}
                                    </span>
                                    {idea.autopilot && idea.status !== "created" && (idea as any).autopilot_status !== "completed" && (
                                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 gap-0.5 bg-primary/15 text-primary border-primary/20">
                                        <Zap className="h-2 w-2" />
                                        autopilot
                                      </Badge>
                                    )}
                                    {/* Actionable autopilot states only */}
                                    {(idea as any).autopilot_status === "failed_no_credits" && (
                                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 gap-0.5 bg-destructive/15 text-destructive border-destructive/20" title="Autopilot couldn't create — no credits remaining">
                                        <AlertTriangle className="h-2 w-2" />
                                        no credits
                                      </Badge>
                                    )}
                                    {(idea as any).autopilot_status === "failed_error" && (
                                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 gap-0.5 bg-destructive/15 text-destructive border-destructive/20" title="Autopilot encountered an error — will retry automatically">
                                        <AlertTriangle className="h-2 w-2" />
                                        failed
                                      </Badge>
                                    )}
                                    {(idea as any).autopilot_status === "processing" && (
                                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 gap-0.5 bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20">
                                        <Loader2 className="h-2 w-2 animate-spin" />
                                        creating…
                                      </Badge>
                                    )}
                                    {/* Only show format chip when it's a carousel (graphic is the default — no need to label) */}
                                    {idea.content_format === "carousel" && (
                                      <span className="inline-flex items-center rounded-full border px-1.5 py-0 h-4 text-[9px] font-semibold shrink-0 bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/20">
                                        carousel
                                      </span>
                                    )}
                                    {idea.idea_type === "holiday" && (
                                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 gap-0.5 bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20">
                                        <Gift className="h-2 w-2" />
                                        holiday
                                      </Badge>
                                    )}
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <button className="p-0.5 rounded hover:bg-muted transition-colors ml-auto shrink-0 opacity-0 group-hover/idea:opacity-100 max-sm:opacity-100">
                                          <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                                        </button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="w-44">
                                        {idea.status !== "created" && (
                                          <DropdownMenuItem onClick={() => handleFormatAction(idea)} className="text-xs gap-2">
                                            {(idea.content_format || "graphic") === "carousel"
                                              ? <><Layers className="h-3.5 w-3.5" /> Create carousel</>
                                              : <><ArrowRight className="h-3.5 w-3.5" /> Create graphic</>
                                            }
                                          </DropdownMenuItem>
                                        )}
                                        <DropdownMenuItem
                                          onClick={async () => {
                                            const newVal = !idea.autopilot;
                                            await supabase.from("content_ideas").update({ autopilot: newVal } as any).eq("id", idea.id);
                                            queryClient.invalidateQueries({ queryKey: ["weekly-ideas", brandId] });
                                            toast({ title: newVal ? "Autopilot enabled ⚡" : "Autopilot disabled" });
                                          }}
                                          className="text-xs gap-2"
                                        >
                                          <Zap className={`h-3.5 w-3.5 ${idea.autopilot ? "text-primary" : ""}`} />
                                          {idea.autopilot ? "Disable autopilot" : "Enable autopilot"}
                                        </DropdownMenuItem>
                                        {((idea as any).autopilot_status === "failed_no_credits" || (idea as any).autopilot_status === "failed_error") && (
                                          <DropdownMenuItem
                                            onClick={async () => {
                                              const today = new Date().toISOString().split("T")[0];
                                              await supabase.from("content_ideas").update({
                                                autopilot_status: "pending",
                                                scheduled_for: today,
                                              } as any).eq("id", idea.id);
                                              queryClient.invalidateQueries({ queryKey: ["weekly-ideas", brandId] });
                                              toast({ title: "Retry queued", description: "Will be retried on the next autopilot run" });
                                            }}
                                            className="text-xs gap-2"
                                          >
                                            <RotateCcw className="h-3.5 w-3.5" />
                                            Retry autopilot
                                          </DropdownMenuItem>
                                        )}
                                        <DropdownMenuItem onClick={() => openCreateIdea(day)} className="text-xs gap-2">
                                          <Plus className="h-3.5 w-3.5" />
                                          Add idea
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => openEditIdea(idea)} className="text-xs gap-2">
                                          <Pencil className="h-3.5 w-3.5" />
                                          Edit idea
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => deleteIdea(idea.id)} className="text-xs gap-2 text-destructive focus:text-destructive">
                                          <Trash2 className="h-3.5 w-3.5" />
                                          Delete
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          {dayIdeas.length === 0 && (
                            <div className="shrink-0">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className="p-0.5 rounded hover:bg-muted transition-colors opacity-0 group-hover/day:opacity-100 max-sm:opacity-100">
                                    <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44">
                                  <DropdownMenuItem onClick={() => openCreateIdea(day)} className="text-xs gap-2">
                                    <Plus className="h-3.5 w-3.5" />
                                    Add idea
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </CollapsibleContent>
            </section>
          </Collapsible>
          {/* Trend Intel Card */}
          <Collapsible open={openSections.trends} onOpenChange={() => toggleSection("trends")}>
            <section className="space-y-3">
              <CollapsibleTrigger asChild>
                <button className="flex items-center justify-between w-full hover:opacity-80 transition-opacity">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <h2 className="text-base font-semibold">Trend Intel</h2>
                    {trendIntel?.generated_at && (
                      <span className="text-[10px] text-muted-foreground">
                        Updated {(() => {
                          const age = Date.now() - new Date(trendIntel.generated_at).getTime();
                          const days = Math.floor(age / (1000 * 60 * 60 * 24));
                          return days === 0 ? "today" : `${days}d ago`;
                        })()}
                      </span>
                    )}
                  </div>
                  {openSections.trends ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 animate-accordion-down data-[state=closed]:animate-accordion-up">
                <div className="flex items-center justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={refreshTrendIntel}
                    disabled={trendRefreshing}
                  >
                    {trendRefreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    {trendIntel ? "Refresh" : "Research Trends"}
                  </Button>
                </div>
                {trendIntel?.trends_data && Array.isArray(trendIntel.trends_data) && (trendIntel.trends_data as any[]).length > 0 ? (
                  <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {(trendIntel.trends_data as any[]).slice(0, showAllTrends ? undefined : 4).map((trend: any, i: number) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <Card
                          className="hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 transition-all duration-200 cursor-pointer group"
                          onClick={() => setSelectedTrend(trend)}
                        >
                          <CardContent className="p-3 space-y-1">
                            <div className="flex items-center gap-1.5">
                              <TrendingUp className="h-3 w-3 text-primary shrink-0" />
                              <p className="text-xs font-semibold leading-tight truncate flex-1">{trend.title}</p>
                              <ArrowRight className="h-3 w-3 text-muted-foreground/0 group-hover:text-primary/60 transition-all duration-200 shrink-0 -translate-x-1 group-hover:translate-x-0" />
                            </div>
                            <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">{trend.summary}</p>
                            {trend.content_angles?.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-0.5">
                                {trend.content_angles.slice(0, 2).map((angle: string, j: number) => (
                                  <span key={j} className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary truncate max-w-[140px]">
                                    {angle}
                                  </span>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                  {(trendIntel.trends_data as any[]).length > 4 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full h-7 text-xs gap-1"
                      onClick={() => setShowAllTrends(!showAllTrends)}
                    >
                      {showAllTrends ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {showAllTrends ? "Show less" : `Show all ${(trendIntel.trends_data as any[]).length} trends`}
                    </Button>
                  )}
                  </>
                ) : !trendRefreshing && (
                  <Card className="border-dashed">
                    <CardContent className="py-6 text-center space-y-2">
                      <TrendingUp className="h-6 w-6 mx-auto text-muted-foreground/40" />
                      <p className="text-xs text-muted-foreground">No trend intel yet. Click "Research Trends" to discover what's happening in your industry.</p>
                    </CardContent>
                  </Card>
                )}
                {trendRefreshing && (
                  <Card className="border-dashed">
                    <CardContent className="py-8 text-center space-y-2">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                      <p className="text-xs text-muted-foreground">Researching industry trends…</p>
                    </CardContent>
                  </Card>
                )}
              </CollapsibleContent>
            </section>
          </Collapsible>

          {/* Pillars */}
          <Collapsible open={openSections.pillars} onOpenChange={() => toggleSection("pillars")}>
            <section className="space-y-3">
              <CollapsibleTrigger asChild>
                <button className="flex items-center justify-between w-full hover:opacity-80 transition-opacity">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    <h2 className="text-base font-semibold">Content Pillars</h2>
                    {hasPillars && <Badge variant="secondary" className="text-[10px]">{pillars!.length}</Badge>}
                  </div>
                  {openSections.pillars ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 animate-accordion-down data-[state=closed]:animate-accordion-up">
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={openCreatePillar}>
                    <Plus className="h-3 w-3" /> Add
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => handleGenerate("generate_pillars")} disabled={!!generating}>
                    {generating === "generate_pillars" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    AI Generate
                  </Button>
                </div>
                {hasPillars ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                    {pillars!.map((p: any, i: number) => (
                      <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                        <Card className="h-full hover:border-primary/30 transition-colors group relative">
                          <CardContent className="p-3 text-center space-y-1">
                            <span className="text-2xl">{p.icon_emoji}</span>
                            <p className="text-xs font-medium leading-tight">{p.name}</p>
                            <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">{p.description}</p>
                          </CardContent>
                          <div className="absolute top-1 right-1 flex md:hidden md:group-hover:flex gap-0.5">
                            <button onClick={() => openEditPillar(p)} className="p-1 rounded-md hover:bg-muted transition-colors" title="Edit">
                              <Pencil className="h-3 w-3 text-muted-foreground" />
                            </button>
                            <button onClick={() => deletePillar(p.id)} className="p-1 rounded-md hover:bg-destructive/10 transition-colors" title="Delete">
                              <Trash2 className="h-3 w-3 text-destructive/70" />
                            </button>
                          </div>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                ) : !generating && (
                  <Card className="border-dashed">
                    <CardContent className="py-8 text-center">
                      <p className="text-sm text-muted-foreground">No pillars yet. Add one manually or let AI generate them.</p>
                    </CardContent>
                  </Card>
                )}
              </CollapsibleContent>
            </section>
          </Collapsible>


          {/* Series */}
          <Collapsible open={openSections.series} onOpenChange={() => toggleSection("series")}>
            <section className="space-y-3">
              <CollapsibleTrigger asChild>
                <button className="flex items-center justify-between w-full hover:opacity-80 transition-opacity">
                  <div className="flex items-center gap-2">
                    <Repeat className="h-4 w-4 text-muted-foreground" />
                    <h2 className="text-base font-semibold">Recurring Series</h2>
                    {series && series.length > 0 && <Badge variant="secondary" className="text-[10px]">{series.length}</Badge>}
                  </div>
                  {openSections.series ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 animate-accordion-down data-[state=closed]:animate-accordion-up">
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={openCreateSeries}>
                    <Plus className="h-3 w-3" /> Add
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => handleGenerate("generate_series")} disabled={!!generating}>
                    {generating === "generate_series" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    AI Generate
                  </Button>
                </div>
                {series && series.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {series.map((s: any, i: number) => (
                      <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                        <Card className="hover:border-primary/30 transition-colors group relative">
                          <CardContent className="p-4 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-semibold">{s.name}</h3>
                              <Badge variant="secondary" className="text-[10px]">
                                {s.recurrence}{s.preferred_day ? ` · ${DAY_LABELS[s.preferred_day] || s.preferred_day}` : ""}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">{s.description}</p>
                          </CardContent>
                          <div className="absolute top-2 right-2 flex md:hidden md:group-hover:flex gap-0.5">
                            <button onClick={() => openEditSeries(s)} className="p-1 rounded-md hover:bg-muted transition-colors" title="Edit">
                              <Pencil className="h-3 w-3 text-muted-foreground" />
                            </button>
                            <button onClick={() => deleteSeries(s.id)} className="p-1 rounded-md hover:bg-destructive/10 transition-colors" title="Delete">
                              <Trash2 className="h-3 w-3 text-destructive/70" />
                            </button>
                          </div>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                ) : !generating && (
                  <Card className="border-dashed">
                    <CardContent className="py-8 text-center">
                      <p className="text-sm text-muted-foreground">No series yet. Add one manually or let AI generate them.</p>
                    </CardContent>
                  </Card>
                )}
              </CollapsibleContent>
            </section>
          </Collapsible>

          {/* Campaigns */}
          <Collapsible open={openSections.campaigns} onOpenChange={() => toggleSection("campaigns")}>
            <section className="space-y-3">
              <CollapsibleTrigger asChild>
                <button className="flex items-center justify-between w-full hover:opacity-80 transition-opacity">
                  <div className="flex items-center gap-2">
                    <Megaphone className="h-4 w-4 text-muted-foreground" />
                    <h2 className="text-base font-semibold">Campaigns</h2>
                    {campaigns && campaigns.length > 0 && <Badge variant="secondary" className="text-[10px]">{campaigns.length}</Badge>}
                  </div>
                  {openSections.campaigns ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 animate-accordion-down data-[state=closed]:animate-accordion-up">
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={openCreateCampaign}>
                    <Plus className="h-3 w-3" /> Add
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => handleGenerate("generate_campaigns")} disabled={!!generating}>
                    {generating === "generate_campaigns" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    AI Generate
                  </Button>
                </div>
                {campaigns && campaigns.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {campaigns.map((c: any, i: number) => (
                      <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                        <Card className="hover:border-primary/30 transition-colors group relative">
                          <CardContent className="p-4 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-semibold">{c.name}</h3>
                              <Badge variant="outline" className="text-[10px]">{c.post_count} posts</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">{c.description}</p>
                          </CardContent>
                          <div className="absolute top-2 right-2 flex md:hidden md:group-hover:flex gap-0.5">
                            <button onClick={() => openEditCampaign(c)} className="p-1 rounded-md hover:bg-muted transition-colors" title="Edit">
                              <Pencil className="h-3 w-3 text-muted-foreground" />
                            </button>
                            <button onClick={() => deleteCampaign(c.id)} className="p-1 rounded-md hover:bg-destructive/10 transition-colors" title="Delete">
                              <Trash2 className="h-3 w-3 text-destructive/70" />
                            </button>
                          </div>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                ) : !generating && (
                  <Card className="border-dashed">
                    <CardContent className="py-8 text-center">
                      <p className="text-sm text-muted-foreground">No campaigns yet. Add one manually or let AI generate them.</p>
                    </CardContent>
                  </Card>
                )}
              </CollapsibleContent>
            </section>
          </Collapsible>

          {/* Regenerate All */}
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl gap-2"
              onClick={handleFullGenerate}
              disabled={!!generating}
            >
              {generating === "full" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Regenerate All
            </Button>
          </div>

          {/* Audience Intelligence context banner */}
          <AudienceContextBanner brandId={brand?.id} />

          <div className="h-[70px]" />
        </motion.div>
      </main>

      {/* --- Pillar Dialog --- */}
      <Dialog open={pillarDialogOpen} onOpenChange={setPillarDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPillarId ? "Edit Pillar" : "Add Content Pillar"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Icon</Label>
              <div className="flex flex-wrap gap-1.5">
                {EMOJI_OPTIONS.map((e) => (
                  <button
                    key={e}
                    onClick={() => setPillarForm((f) => ({ ...f, icon_emoji: e }))}
                    className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-colors
                      ${pillarForm.icon_emoji === e ? "bg-primary/15 ring-1 ring-primary" : "hover:bg-muted"}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input
                placeholder="e.g. Skincare Education"
                value={pillarForm.name}
                onChange={(e) => setPillarForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea
                placeholder="What kind of content falls under this pillar?"
                className="resize-none"
                rows={2}
                value={pillarForm.description}
                onChange={(e) => setPillarForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPillarDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={savePillar} disabled={!pillarForm.name.trim() || pillarSaving}>
              {pillarSaving && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
              {editingPillarId ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- Series Dialog --- */}
      <Dialog open={seriesDialogOpen} onOpenChange={setSeriesDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSeriesId ? "Edit Series" : "Add Recurring Series"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input
                placeholder="e.g. Tip Tuesday"
                value={seriesForm.name}
                onChange={(e) => setSeriesForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea
                placeholder="What is this series about?"
                className="resize-none"
                rows={2}
                value={seriesForm.description}
                onChange={(e) => setSeriesForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Recurrence</Label>
                <Select value={seriesForm.recurrence} onValueChange={(v) => setSeriesForm((f) => ({ ...f, recurrence: v }))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Biweekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Preferred Day</Label>
                <Select value={seriesForm.preferred_day || "none"} onValueChange={(v) => setSeriesForm((f) => ({ ...f, preferred_day: v === "none" ? "" : v }))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Any</SelectItem>
                    {DAYS.map((d) => (
                      <SelectItem key={d} value={d}>{DAY_LABELS[d]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {pillars && pillars.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Content Pillar (optional)</Label>
                <Select value={seriesForm.pillar_id || "none"} onValueChange={(v) => setSeriesForm((f) => ({ ...f, pillar_id: v === "none" ? "" : v }))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {pillars.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.icon_emoji} {p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Visual Style Notes (optional)</Label>
              <Textarea
                placeholder="e.g. Use a consistent blue gradient background with bold headline"
                className="resize-none"
                rows={2}
                value={seriesForm.visual_style_notes}
                onChange={(e) => setSeriesForm((f) => ({ ...f, visual_style_notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSeriesDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={saveSeries} disabled={!seriesForm.name.trim() || seriesSaving}>
              {seriesSaving && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
              {editingSeriesId ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- Campaign Dialog --- */}
      <Dialog open={campaignDialogOpen} onOpenChange={setCampaignDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCampaignId ? "Edit Campaign" : "Add Campaign"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input
                placeholder="e.g. Summer Launch"
                value={campaignForm.name}
                onChange={(e) => setCampaignForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea
                placeholder="What is this campaign about?"
                className="resize-none"
                rows={2}
                value={campaignForm.description}
                onChange={(e) => setCampaignForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Number of Posts</Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={campaignForm.post_count}
                onChange={(e) => setCampaignForm((f) => ({ ...f, post_count: parseInt(e.target.value) || 1 }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCampaignDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={saveCampaign} disabled={!campaignForm.name.trim() || campaignSaving}>
              {campaignSaving && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
              {editingCampaignId ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- Idea Dialog --- */}
      <Dialog open={ideaDialogOpen} onOpenChange={setIdeaDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingIdeaId ? "Edit Idea" : `Add Idea — ${DAY_LABELS[ideaDay] || ideaDay}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Title</Label>
              <Input
                placeholder="e.g. Product spotlight post"
                value={ideaForm.title}
                onChange={(e) => setIdeaForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Design Prompt</Label>
              <Textarea
                placeholder="Describe the graphic you want to create…"
                className="resize-none"
                rows={3}
                value={ideaForm.prompt}
                onChange={(e) => setIdeaForm((f) => ({ ...f, prompt: e.target.value }))}
              />
            </div>
            {pillars && pillars.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Pillar (optional)</Label>
                <Select value={ideaForm.pillar_id || "none"} onValueChange={(v) => setIdeaForm((f) => ({ ...f, pillar_id: v === "none" ? "" : v }))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {pillars.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.icon_emoji} {p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {series && series.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Series (optional)</Label>
                <Select value={ideaForm.series_id || "none"} onValueChange={(v) => setIdeaForm((f) => ({ ...f, series_id: v === "none" ? "" : v }))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {series.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {campaigns && campaigns.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Campaign (optional)</Label>
                <Select value={ideaForm.campaign_id || "none"} onValueChange={(v) => setIdeaForm((f) => ({ ...f, campaign_id: v === "none" ? "" : v }))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {campaigns.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Content Format</Label>
              <Select value={ideaForm.content_format || "graphic"} onValueChange={(v) => setIdeaForm((f) => ({ ...f, content_format: v }))}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="graphic">📷 Single Graphic</SelectItem>
                  <SelectItem value="carousel">📚 Carousel</SelectItem>
                  
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Zap className={`h-4 w-4 ${ideaForm.autopilot ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                  <p className="text-xs font-medium">Autopilot</p>
                  <p className="text-[10px] text-muted-foreground">Auto-create and email this design on the scheduled day</p>
                </div>
              </div>
              <Switch
                checked={ideaForm.autopilot}
                onCheckedChange={(v) => setIdeaForm((f) => ({ ...f, autopilot: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIdeaDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={saveIdea} disabled={!ideaForm.title.trim() || !ideaForm.prompt.trim() || ideaSaving}>
              {ideaSaving && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
              {editingIdeaId ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Trend Detail Dialog */}
      <Dialog open={!!selectedTrend} onOpenChange={(open) => !open && setSelectedTrend(null)}>
        <DialogContent className="sm:max-w-lg">
          {selectedTrend && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary shrink-0" />
                  <DialogTitle className="text-base">{selectedTrend.title}</DialogTitle>
                </div>
              </DialogHeader>
              <div className="space-y-4 py-1">
                <p className="text-sm text-muted-foreground leading-relaxed">{selectedTrend.summary}</p>

                {selectedTrend.relevance_to_brand && (
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-semibold text-foreground">Why this matters for your brand</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">{selectedTrend.relevance_to_brand}</p>
                  </div>
                )}

                {selectedTrend.content_angles?.length > 0 && (
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-semibold text-foreground">Content angles</h4>
                    <ol className="space-y-1.5 list-none">
                      {selectedTrend.content_angles.map((angle: string, j: number) => (
                        <li key={j} className="flex items-start gap-2">
                          <span className="text-[10px] font-bold text-primary mt-0.5 shrink-0">{j + 1}.</span>
                          <span className="text-xs text-muted-foreground">{angle}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    const prompt = `${selectedTrend.title}: ${selectedTrend.content_angles?.[0] || selectedTrend.summary}`;
                    navigate(`/studio?prompt=${encodeURIComponent(prompt)}`);
                    setSelectedTrend(null);
                  }}
                >
                  <Palette className="h-3 w-3" />
                  Generate Design
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    setSelectedTrend(null);
                    setIdeaForm({
                      ...emptyIdea,
                      title: selectedTrend.title,
                      prompt: `${selectedTrend.title}: ${selectedTrend.content_angles?.[0] || selectedTrend.summary}`,
                    });
                    setIdeaDay("monday");
                    setEditingIdeaId(null);
                    setIdeaDialogOpen(true);
                  }}
                >
                  <Plus className="h-3 w-3" />
                  Create Content Idea
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    const prompt = `How can I leverage the trend "${selectedTrend.title}" for my brand?`;
                    navigate(`/studio?mode=plan&prompt=${encodeURIComponent(prompt)}`);
                    setSelectedTrend(null);
                  }}
                >
                  <MessageSquare className="h-3 w-3" />
                  Ask Strategist
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Credit confirmation dialog */}
      <AlertDialog open={creditDialogOpen} onOpenChange={setCreditDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Use 2 credits?</AlertDialogTitle>
            <AlertDialogDescription>
              You've used your free AI generation for this week. This generation will cost 2 credits. Would you like to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCreditDialogCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCreditDialogProceed}>Proceed</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ContentHub;