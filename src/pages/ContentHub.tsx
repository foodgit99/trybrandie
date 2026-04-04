import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useBrand } from "@/hooks/useBrand";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import CalendarExport from "@/components/CalendarExport";

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
}
const emptyPillar: PillarForm = { name: "", description: "", icon_emoji: "📌" };

// --- Series form state ---
interface SeriesForm {
  name: string;
  description: string;
  recurrence: string;
  preferred_day: string;
  visual_style_notes: string;
  pillar_id: string;
}
const emptySeries: SeriesForm = { name: "", description: "", recurrence: "weekly", preferred_day: "", visual_style_notes: "", pillar_id: "" };

// --- Campaign form state ---
interface CampaignForm {
  name: string;
  description: string;
  post_count: number;
}
const emptyCampaign: CampaignForm = { name: "", description: "", post_count: 5 };

// --- Idea form state ---
interface IdeaForm {
  title: string;
  prompt: string;
  pillar_id: string;
  series_id: string;
  campaign_id: string;
  content_format: string;
}
const emptyIdea: IdeaForm = { title: "", prompt: "", pillar_id: "", series_id: "", campaign_id: "", content_format: "graphic" };

const EMOJI_OPTIONS = ["📌", "🎓", "💡", "🎯", "🔥", "💬", "🛒", "🎨", "📸", "🏷️", "❤️", "⭐", "🚀", "🧠", "🤝", "📢"];

const ContentHub = () => {
  const { user } = useAuth();
  const { brand } = useBrand();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [generating, setGenerating] = useState<string | null>(null);
  const [initialSetupDone, setInitialSetupDone] = useState(false);
  const [regenPending, setRegenPending] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);

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

  // --- Queries ---
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
    setPillarForm({ name: p.name, description: p.description || "", icon_emoji: p.icon_emoji || "📌" });
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
    setIdeaForm(emptyIdea);
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
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-serif tracking-tight">Content Hub</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Your content strategy, powered by AI
              </p>
            </div>
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

          {/* Pillars */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-base font-semibold">Content Pillars</h2>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={openCreatePillar}
                >
                  <Plus className="h-3 w-3" />
                  Add
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => handleGenerate("generate_pillars")}
                  disabled={!!generating}
                >
                  {generating === "generate_pillars" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  AI Generate
                </Button>
              </div>
            </div>
            {hasPillars ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                {pillars!.map((p: any, i: number) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card className="h-full hover:border-primary/30 transition-colors group relative">
                      <CardContent className="p-3 text-center space-y-1">
                        <span className="text-2xl">{p.icon_emoji}</span>
                        <p className="text-xs font-medium leading-tight">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">{p.description}</p>
                      </CardContent>
                      {/* Hover actions */}
                      <div className="absolute top-1 right-1 flex md:hidden md:group-hover:flex gap-0.5">
                        <button
                          onClick={() => openEditPillar(p)}
                          className="p-1 rounded-md hover:bg-muted transition-colors"
                          title="Edit"
                        >
                          <Pencil className="h-3 w-3 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => deletePillar(p.id)}
                          className="p-1 rounded-md hover:bg-destructive/10 transition-colors"
                          title="Delete"
                        >
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
          </section>

          {/* Weekly Calendar — always visible */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-base font-semibold">{weekLabel}</h2>
                {regenPending && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setWeekOffset((o) => o - 1)}
                  title="Previous week"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {weekOffset !== 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => setWeekOffset(0)}
                  >
                    Today
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setWeekOffset((o) => o + 1)}
                  title="Next week"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => handleGenerate("generate_weekly_ideas")}
                  disabled={!!generating}
                >
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
                                {(() => {
                                  const fmt = idea.content_format || "graphic";
                                  const colorMap: Record<string, string> = {
                                    carousel: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/20",
                                    graphic: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
                                  };
                                  return (
                                    <span className={`inline-flex items-center rounded-full border px-1.5 py-0 h-4 text-[9px] font-semibold shrink-0 ${colorMap[fmt] || colorMap.graphic}`}>
                                      {fmt}
                                    </span>
                                  );
                                })()}
                                {idea.idea_type === "series_post" && (
                                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">series</Badge>
                                )}
                                {idea.idea_type === "campaign_post" && (
                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">campaign</Badge>
                                )}
                                {/* Hover edit/delete for ideas */}
                                <div className="flex md:hidden md:group-hover/idea:flex gap-0.5 ml-auto shrink-0">
                                  <button
                                    onClick={() => openEditIdea(idea)}
                                    className="p-0.5 rounded hover:bg-muted transition-colors"
                                    title="Edit idea"
                                  >
                                    <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
                                  </button>
                                  <button
                                    onClick={() => deleteIdea(idea.id)}
                                    className="p-0.5 rounded hover:bg-destructive/10 transition-colors"
                                    title="Delete idea"
                                  >
                                    <Trash2 className="h-2.5 w-2.5 text-destructive/70" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 flex gap-1 items-center">
                        {dayIdeas.filter((i: any) => i.status !== "created").map((idea: any) => {
                          const format = idea.content_format || "graphic";
                          const FormatIcon = format === "carousel" ? Layers : format === "video" ? Play : ArrowRight;
                          const formatLabel = format === "carousel" ? "Create carousel" : format === "video" ? "Create video" : "Create graphic";
                          return (
                            <Button
                              key={idea.id}
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleFormatAction(idea)}
                              title={formatLabel}
                            >
                              <FormatIcon className="h-3.5 w-3.5" />
                            </Button>
                          );
                        })}
                        {/* Add idea button per day */}
                        <button
                          onClick={() => openCreateIdea(day)}
                          className="p-1 rounded-md hover:bg-muted transition-colors opacity-0 group-hover/day:opacity-100 sm:opacity-0 max-sm:opacity-100"
                          title="Add idea"
                        >
                          <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </section>

          {/* Series */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Repeat className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-base font-semibold">Recurring Series</h2>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={openCreateSeries}
                >
                  <Plus className="h-3 w-3" />
                  Add
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => handleGenerate("generate_series")}
                  disabled={!!generating}
                >
                  {generating === "generate_series" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  AI Generate
                </Button>
              </div>
            </div>
            {series && series.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {series.map((s: any, i: number) => (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
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
                      {/* Hover actions */}
                      <div className="absolute top-2 right-2 flex md:hidden md:group-hover:flex gap-0.5">
                        <button
                          onClick={() => openEditSeries(s)}
                          className="p-1 rounded-md hover:bg-muted transition-colors"
                          title="Edit"
                        >
                          <Pencil className="h-3 w-3 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => deleteSeries(s.id)}
                          className="p-1 rounded-md hover:bg-destructive/10 transition-colors"
                          title="Delete"
                        >
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
          </section>

          {/* Campaigns */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-base font-semibold">Campaigns</h2>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={openCreateCampaign}
                >
                  <Plus className="h-3 w-3" />
                  Add
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => handleGenerate("generate_campaigns")}
                  disabled={!!generating}
                >
                  {generating === "generate_campaigns" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  AI Generate
                </Button>
              </div>
            </div>
            {campaigns && campaigns.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {campaigns.map((c: any, i: number) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card className="hover:border-primary/30 transition-colors group relative">
                      <CardContent className="p-4 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold">{c.name}</h3>
                          <Badge variant="outline" className="text-[10px]">{c.post_count} posts</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{c.description}</p>
                      </CardContent>
                      <div className="absolute top-2 right-2 flex md:hidden md:group-hover:flex gap-0.5">
                        <button
                          onClick={() => openEditCampaign(c)}
                          className="p-1 rounded-md hover:bg-muted transition-colors"
                          title="Edit"
                        >
                          <Pencil className="h-3 w-3 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => deleteCampaign(c.id)}
                          className="p-1 rounded-md hover:bg-destructive/10 transition-colors"
                          title="Delete"
                        >
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
          </section>
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