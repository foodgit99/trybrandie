import SEO from "@/components/SEO";
import { useState, useEffect, useCallback, useRef } from "react";
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
  LayoutGrid,
  X,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import CalendarExport from "@/components/CalendarExport";
import AudienceContextBanner from "@/components/content/AudienceContextBanner";
import { CategoryBadge, CategoryBadgeList, CategoryDot } from "@/components/content/CategoryBadge";
import CategoryCoveragePanel from "@/components/content/CategoryCoveragePanel";
import { CONTENT_CATEGORIES, parseCategoryIds, type ContentCategoryId } from "@/lib/contentCategories";
const validCategoryIds: readonly string[] = CONTENT_CATEGORIES.map((c) => c.id);
import { getUpcomingHolidays, fetchUpcomingHolidaysLive, type UpcomingHoliday } from "@/lib/holidayCalendar";
import { getLastCategory, setLastCategory, clearLastCategory, hydrateLastCategoriesForBrand, getLastFilterCategory, setLastFilterCategory, getLastSortOption, setLastSortOption, type ContentHubSortOption } from "@/lib/lastCategoryPref";
import FeatureInfoButton from "@/components/content/FeatureInfoButton";
import CarouselPreviewDialog from "@/components/content/CarouselPreviewDialog";
import BrandPulse from "@/components/content/BrandPulse";
import NextBestActionCard, { type CtaAction } from "@/components/content/NextBestActionCard";

// --- Feature info copy (summary + deeper marketing rationale) ---
const FEATURE_INFO = {
  upcomingEvents: {
    title: "Upcoming Events",
    summary:
      "Holidays and key cultural moments coming up in the next 14 days, with one-tap design starters.",
    learnMore:
      "Timely content earns disproportionate attention. Audiences are already searching, talking, and shopping around well-known events, so brands that show up early ride that wave instead of fighting for attention from scratch.\n\nUse this to plan ahead, secure visibility before competitors, and build emotional relevance by aligning your brand with moments your audience already cares about.",
  },
  pillars: {
    title: "Content Pillars",
    summary:
      "The 3–5 core themes your brand consistently talks about across all your content.",
    learnMore:
      "Pillars are the marketing equivalent of brand positioning. They keep your messaging focused so the audience quickly understands what you stand for and why to follow you.\n\nWithout pillars, content feels random and forgettable. With them, every post reinforces a clear identity, which builds trust, recall, and category authority over time.",
  },
  campaigns: {
    title: "Campaigns",
    summary:
      "Time-bound content pushes around a specific goal, a launch, promo, or seasonal moment.",
    learnMore:
      "Campaigns concentrate your audience's attention. By telling a connected story across multiple posts within a tight window, you create momentum, urgency, and a reason to act now.\n\nThis is how brands turn awareness into measurable outcomes, sales, sign-ups, bookings, instead of just posting steady content that quietly fades.",
  },
  series: {
    title: "Recurring Series",
    summary:
      "Repeating post formats your audience can expect on a schedule (e.g. Monday Tips, Friday Features).",
    learnMore:
      "Series build the most powerful asset in marketing: appointment viewing. When people learn to expect something from you on a specific day, you stop competing for attention, they come looking for you.\n\nThey also dramatically reduce content fatigue. Once a format works, you can reuse the structure forever, swapping only the topic. Less effort, more consistency, stronger brand recognition.",
  },
  trends: {
    title: "Trends",
    summary:
      "What's currently moving in your industry, topics, formats, and conversations to ride.",
    learnMore:
      "Riding a relevant trend gives your content a natural reach boost because algorithms and audiences are already paying attention. It signals that your brand is alive, current, and tuned in.\n\nThe key is selective participation: trends that align with your pillars amplify your positioning, while random trend-chasing dilutes it. Use this list to spot the few that genuinely fit.",
  },
  calendar: {
    title: "Content Calendar",
    summary:
      "A weekly view of every idea scheduled across your days, color-coded by category.",
    learnMore:
      "Consistency outperforms intensity. Brands that post predictably stay top-of-mind, while bursts of activity followed by silence quietly erode trust and reach.\n\nThe calendar lets you plan a balanced mix, promotional, educational, social-proof, entertainment, so you're nurturing the audience instead of only selling. That balance is what turns followers into buyers over time.",
  },
  categoryCoverage: {
    title: "Category Coverage",
    summary:
      "A breakdown of how your scheduled posts are distributed across content categories.",
    learnMore:
      "A healthy content mix protects you from looking too 'salesy' or too 'fluffy'. Audiences disengage from feeds that lean too far in one direction.\n\nUse coverage as a quick diagnostic: if you're 80% promotional, audiences tune out; if you never sell, you build attention but no revenue. Aim for a deliberate ratio that supports both relationship and conversion.",
  },
  autopilot: {
    title: "Autopilot",
    summary:
      "Brandie automatically generates and emails your scheduled designs at your chosen delivery time.",
    learnMore:
      "The biggest reason brands stop posting isn't strategy, it's friction. Autopilot removes the daily decision of 'what should I post today?' so consistency becomes the default.\n\nBy delivering ready-made, on-brand designs to your inbox, it turns content from a recurring task into a system. The compounding effect is what most small brands never reach: months of consistent presence with minimal effort.",
  },
  regenerateAll: {
    title: "Regenerate All",
    summary:
      "Rebuild your full content strategy, pillars, campaigns, series, and weekly ideas, in one go.",
    learnMore:
      "Brands evolve. Audiences shift, offers change, seasons turn. A periodic full refresh keeps your content engine aligned with where the business is now, not where it was when you started.\n\nUse this when you've updated your brand, audience profile, or goals, or when content has started to feel repetitive. A clean regeneration restores creative range and strategic relevance.",
  },
  audienceContext: {
    title: "Audience Suggestions",
    summary:
      "Ideas pulled directly from your audience's pains, desires, and decision triggers.",
    learnMore:
      "The most persuasive content speaks to a specific person, not a market. By grounding ideas in your audience's actual jobs-to-be-done, what they're struggling with, what they want, what makes them buy, you bypass generic advice and create content that feels personally written.\n\nThis is the difference between content people scroll past and content people screenshot.",
  },
} as const;

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
  slide_count: number;
  autopilot: boolean;
  content_category: string; // single id
}
const emptyIdea: IdeaForm = { title: "", prompt: "", pillar_id: "", series_id: "", campaign_id: "", content_format: "graphic", slide_count: 5, autopilot: false, content_category: "" };

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
    trends: true,
    pillars: true,
    calendar: true,
    series: true,
    campaigns: true,
  });

  const toggleSection = (key: string) => setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  // Hub section dialogs (replacing inline expandable sections)
  const [hubDialog, setHubDialog] = useState<null | "pillars" | "campaigns" | "series" | "trends">(null);

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

  // Carousel slide preview dialog
  const [previewState, setPreviewState] = useState<{ open: boolean; designId: string | null; title: string }>({
    open: false,
    designId: null,
    title: "",
  });

  // Category filter (applies across Series, Campaigns, and Ideas), persisted per user+brand
  const [categoryFilter, setCategoryFilterState] = useState<string>("all");
  const setCategoryFilter = (v: string) => {
    setCategoryFilterState(v);
    setLastFilterCategory(user?.id, brand?.id, v);
  };

  // Sort option (applies across Series, Campaigns, and Ideas), persisted per user+brand
  const [sortOption, setSortOptionState] = useState<ContentHubSortOption>("newest");
  const setSortOption = (v: ContentHubSortOption) => {
    setSortOptionState(v);
    setLastSortOption(user?.id, brand?.id, v);
  };

  const brandId = brand?.id;

  // Live (Firecrawl-sourced, weekly-cached) upcoming holidays for this brand.
  // Falls back to hardcoded list synchronously during initial render.
  const [liveHolidays, setLiveHolidays] = useState<UpcomingHoliday[]>(() => getUpcomingHolidays(21));
  useEffect(() => {
    let cancelled = false;
    fetchUpcomingHolidaysLive({ brandId, days: 21 }).then((list) => {
      if (!cancelled && list.length > 0) setLiveHolidays(list);
    });
    return () => { cancelled = true; };
  }, [brandId]);



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
  const autopilotMode: "manual" | "assisted" | "autonomous" =
    ((autopilotSettings as any)?.mode as any) ?? (autopilotAll ? "assisted" : "manual");
  const minQueueThreshold: number = (autopilotSettings as any)?.min_queue_threshold ?? 5;
  const autoFillMode: "never" | "free_only" | "always" =
    ((autopilotSettings as any)?.auto_fill_mode as any) ?? "free_only";

  const updateAutopilotSetting = async (updates: {
    enabled?: boolean;
    delivery_time?: string;
    timezone?: string;
    mode?: "manual" | "assisted" | "autonomous";
    min_queue_threshold?: number;
    auto_fill_mode?: "never" | "free_only" | "always";
  }) => {
    if (!brandId || !user) return;
    // Keep `enabled` in sync with `mode` so legacy queries / cron filters keep working.
    const finalUpdates: Record<string, unknown> = { ...updates };
    if (updates.mode !== undefined) {
      finalUpdates.enabled = updates.mode !== "manual";
    }

    const { data: existing } = await supabase
      .from("autopilot_settings")
      .select("id")
      .eq("brand_id", brandId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("autopilot_settings")
        .update({ ...finalUpdates, updated_at: new Date().toISOString() } as any)
        .eq("brand_id", brandId);
    } else {
      await supabase
        .from("autopilot_settings")
        .insert({
          brand_id: brandId,
          user_id: user.id,
          enabled: finalUpdates.enabled ?? false,
          delivery_time: (finalUpdates.delivery_time as string) ?? "morning",
          timezone: (finalUpdates.timezone as string) ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
          mode: (finalUpdates.mode as string) ?? "manual",
          min_queue_threshold: (finalUpdates.min_queue_threshold as number) ?? 5,
        } as any);
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
    if (run.errors > 0 && run.processed === 0) return { label: `Failed, ${timeStr}`, status: "error" as const };
    if (run.processed > 0) return { label: `${run.processed} created, ${timeStr}`, status: "success" as const };
    return { label: `No ideas, ${timeStr}`, status: "neutral" as const };
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

  // Hydrate last-selected categories for the active brand so they follow the user across devices
  useEffect(() => {
    if (!user?.id || !brandId) return;
    let cancelled = false;
    void hydrateLastCategoriesForBrand(user.id, brandId).then(() => {
      if (cancelled) return;
      setCategoryFilterState(getLastFilterCategory(user.id, brandId, validCategoryIds));
      setSortOptionState(getLastSortOption(user.id, brandId));
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, brandId]);

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
        console.log("Silent regen skipped, would cost credits");
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
      const normalizedCategory = parseCategoryIds(pillarForm.content_category).join(",") || null;
      if (editingPillarId) {
        const { error } = await supabase
          .from("content_pillars")
          .update({
            name: pillarForm.name.trim(),
            description: pillarForm.description.trim(),
            icon_emoji: pillarForm.icon_emoji,
            content_category: normalizedCategory,
          })
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
            content_category: normalizedCategory,
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
    setSeriesForm({ ...emptySeries, content_category: getLastCategory(user?.id, brandId, "series", validCategoryIds) });
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
      content_category: parseCategoryIds(s.content_category)[0] || "",
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
        content_category: parseCategoryIds(seriesForm.content_category)[0] || null,
      };
      setLastCategory(user.id, brandId, "series", payload.content_category);

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
    setCampaignForm({ ...emptyCampaign, content_category: getLastCategory(user?.id, brandId, "campaign", validCategoryIds) });
    setEditingCampaignId(null);
    setCampaignDialogOpen(true);
  };

  const openEditCampaign = (c: any) => {
    setCampaignForm({
      name: c.name,
      description: c.description || "",
      post_count: c.post_count || 5,
      content_category: parseCategoryIds(c.content_category)[0] || "",
    });
    setEditingCampaignId(c.id);
    setCampaignDialogOpen(true);
  };

  const saveCampaign = async () => {
    if (!campaignForm.name.trim() || !brandId || !user) return;
    setCampaignSaving(true);
    try {
      const payload: any = {
        name: campaignForm.name.trim(),
        description: campaignForm.description.trim(),
        post_count: campaignForm.post_count,
        content_category: parseCategoryIds(campaignForm.content_category)[0] || null,
      };
      setLastCategory(user.id, brandId, "campaign", payload.content_category);
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
    setIdeaForm({ ...emptyIdea, autopilot: autopilotAll, content_category: getLastCategory(user?.id, brandId, "idea", validCategoryIds) });
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
      slide_count: Number(idea.slide_count) || 5,
      autopilot: idea.autopilot || false,
      content_category: parseCategoryIds(idea.content_category)[0] || "",
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
      const fmt = ideaForm.content_format || "graphic";
      const payload: any = {
        title: ideaForm.title.trim(),
        prompt: ideaForm.prompt.trim(),
        pillar_id: ideaForm.pillar_id || null,
        series_id: ideaForm.series_id || null,
        campaign_id: ideaForm.campaign_id || null,
        content_format: fmt,
        slide_count: fmt === "carousel" ? Math.min(10, Math.max(2, Number(ideaForm.slide_count) || 5)) : null,
        autopilot: ideaForm.autopilot,
        content_category: parseCategoryIds(ideaForm.content_category)[0] || null,
      };
      setLastCategory(user.id, brandId, "idea", payload.content_category);

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

  // Apply category filter
  const matchesCategory = (raw: string | null | undefined) => {
    if (categoryFilter === "all") return true;
    return parseCategoryIds(raw).includes(categoryFilter as ContentCategoryId);
  };
  const sortItems = <T extends Record<string, any>>(items: T[], nameKey: "name" | "title"): T[] => {
    const arr = [...items];
    const ts = (v: any) => {
      const t = v ? new Date(v).getTime() : 0;
      return Number.isFinite(t) ? t : 0;
    };
    const nm = (it: T) => String((it as any)[nameKey] || "").toLowerCase();
    switch (sortOption) {
      case "oldest":
        return arr.sort((a, b) => ts(a.created_at) - ts(b.created_at));
      case "az":
        return arr.sort((a, b) => nm(a).localeCompare(nm(b)));
      case "za":
        return arr.sort((a, b) => nm(b).localeCompare(nm(a)));
      case "newest":
      default:
        return arr.sort((a, b) => ts(b.created_at) - ts(a.created_at));
    }
  };
  const filteredSeries = sortItems((series || []).filter((s: any) => matchesCategory(s.content_category)), "name");
  const filteredCampaigns = sortItems((campaigns || []).filter((c: any) => matchesCategory(c.content_category)), "name");
  const filteredWeeklyIdeas = sortItems((weeklyIdeas || []).filter((i: any) => matchesCategory(i.content_category)), "title");

  // Build weekly calendar
  const ideasByDay = DAYS.reduce((acc, day) => {
    acc[day] = filteredWeeklyIdeas.filter((i: any) => {
      if (!i.scheduled_for) return false;
      const d = new Date(i.scheduled_for);
      const dayIndex = (d.getDay() + 6) % 7;
      return DAYS[dayIndex] === day;
    });
    return acc;
  }, {} as Record<string, any[]>);

  // --- Holiday conflicts: map a day-of-week (within current week) -> upcoming holiday on that day with no idea
  const holidayByDay: Record<string, UpcomingHoliday | null> = DAYS.reduce((acc, day) => {
    acc[day] = null;
    return acc;
  }, {} as Record<string, UpcomingHoliday | null>);
  {
    const monday = getWeekMonday(weekOffset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const upcoming = liveHolidays;
    for (const h of upcoming) {
      if (h.date >= monday && h.date <= sunday) {
        const dayIndex = (h.date.getDay() + 6) % 7;
        const dayKey = DAYS[dayIndex];
        if (!holidayByDay[dayKey]) holidayByDay[dayKey] = h;
      }
    }
  }

  // --- Drag & drop reschedule ---
  const [draggingIdeaId, setDraggingIdeaId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);

  const rescheduleIdea = async (ideaId: string, targetDay: string) => {
    const newDate = getDateForDay(targetDay);
    const idea = (weeklyIdeas || []).find((i: any) => i.id === ideaId);
    if (!idea) return;
    if (idea.scheduled_for === newDate) return;
    const { error } = await supabase
      .from("content_ideas")
      .update({ scheduled_for: newDate } as any)
      .eq("id", ideaId);
    if (error) {
      toast({ title: "Couldn't reschedule", description: error.message, variant: "destructive" });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["weekly-ideas", brandId] });
    toast({ title: `Moved to ${DAY_LABELS[targetDay]}` });
  };

  const fillDay = (day: string) => {
    // Manual create, pre-fill the create dialog for this day with last-used category
    setIdeaForm({
      ...emptyIdea,
      autopilot: autopilotAll,
      content_category: getLastCategory(user?.id, brandId, "idea", validCategoryIds),
    });
    setEditingIdeaId(null);
    setIdeaDay(day);
    setIdeaDialogOpen(true);
  };

  // AI-fill a single empty day (additive, never wipes existing ideas)
  const [fillingDay, setFillingDay] = useState<string | null>(null);
  const aiFillDay = async (day: string) => {
    if (!brandId || fillingDay) return;
    setFillingDay(day);
    try {
      const status = await callEngine("check_content_gen_status");
      const run = async () => {
        const res = await callEngine("fill_empty_days", { week_offset: weekOffset, target_days: [day], skip_credit_check: true });
        queryClient.invalidateQueries({ queryKey: ["weekly-ideas", brandId] });
        if ((res?.filled || 0) > 0) toast({ title: `Filled ${DAY_LABELS[day]}` });
      };
      if (status.is_free) {
        await run();
      } else {
        setPendingAction(() => async () => { await run(); });
        setCreditDialogOpen(true);
      }
    } catch (e: any) {
      if (!["Rate limited", "Credits exhausted"].includes(e?.message)) {
        toast({ title: "Couldn't fill day", description: e?.message || "Please try again.", variant: "destructive" });
      }
    } finally {
      setFillingDay(null);
    }
  };

  // AI-fill every empty day in the current week
  const [fillingWeek, setFillingWeek] = useState(false);
  const fillWeekEmptyDays = useCallback(async (opts?: { silent?: boolean; force?: boolean }) => {
    if (!brandId || fillingWeek) return;
    const emptyCount = DAYS.filter((d) => !(ideasByDay[d] || []).length).length;
    if (emptyCount === 0) return;
    const silent = !!opts?.silent;
    const force = !!opts?.force;
    const run = async () => {
      setFillingWeek(true);
      try {
        const res = await callEngine("fill_empty_days", { week_offset: weekOffset, skip_credit_check: true });
        queryClient.invalidateQueries({ queryKey: ["weekly-ideas", brandId] });
        if (!silent && (res?.filled || 0) > 0) toast({ title: `Filled ${res.filled} day${res.filled === 1 ? "" : "s"}` });
      } catch (e: any) {
        if (!silent && !["Rate limited", "Credits exhausted"].includes(e?.message)) {
          toast({ title: "Couldn't fill week", description: e?.message || "Please try again.", variant: "destructive" });
        }
      } finally {
        setFillingWeek(false);
      }
    };
    if (force) {
      await run();
      return;
    }
    try {
      const status = await callEngine("check_content_gen_status");
      if (status.is_free) {
        await run();
      } else if (!silent) {
        setPendingAction(() => run);
        setCreditDialogOpen(true);
      }
      // if not free and silent → skip without charging
    } catch {
      if (!silent) await run();
    }
  }, [brandId, fillingWeek, ideasByDay, weekOffset]);

  // Auto-fill empty days when the week loads, based on the user's auto-fill setting.
  // Modes: 'never' (skip), 'free_only' (only if user is on free tier), 'always' (always fill, may use credits).
  // Runs once per (brand, weekOffset) per session.
  const autoFilledRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!brandId || ideasLoading) return;
    if (autoFillMode === "never") return;
    const key = `${brandId}:${weekOffset}`;
    if (autoFilledRef.current.has(key)) return;
    const hasAnyStrategy = (pillars && pillars.length > 0) || (series && series.length > 0) || (campaigns && campaigns.length > 0);
    if (!hasAnyStrategy) return;
    const empty = DAYS.filter((d) => !(ideasByDay[d] || []).length).length;
    if (empty === 0) return;
    autoFilledRef.current.add(key);
    fillWeekEmptyDays({ silent: true, force: autoFillMode === "always" });
  }, [brandId, weekOffset, ideasLoading, ideasByDay, pillars, series, campaigns, fillWeekEmptyDays, autoFillMode]);

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Content Hub, Brandie" description="Your weekly content engine: pulse, blueprint, and queued posts." path="/content" noindex />
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

          {/* Category filter + sort, applies to Series, Campaigns, and weekly Ideas */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none flex-1 min-w-0">
              <button
                type="button"
                onClick={() => setCategoryFilter("all")}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors inline-flex items-center gap-1.5 ${
                  categoryFilter === "all"
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/40"
                }`}
                title="Show every category"
              >
                <LayoutGrid className="h-3 w-3" />
                <span>All categories</span>
              </button>
              {CONTENT_CATEGORIES.map((cat) => {
                const active = categoryFilter === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryFilter(cat.id)}
                    className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors inline-flex items-center gap-1.5 ${
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/40"
                    }`}
                    title={cat.label}
                  >
                    <span>{cat.emoji}</span>
                    <span>{cat.label}</span>
                  </button>
                );
              })}
              {categoryFilter !== "all" && (
                <button
                  type="button"
                  onClick={() => setCategoryFilter("all")}
                  className="shrink-0 rounded-full border border-border bg-background text-[11px] text-muted-foreground hover:text-foreground hover:border-foreground/40 px-2.5 py-1 inline-flex items-center gap-1 transition-colors"
                  title="Reset filter to show all categories"
                  aria-label="Reset category filter"
                >
                  <X className="h-3 w-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>
            <Select value={sortOption} onValueChange={(v) => setSortOption(v as ContentHubSortOption)}>
              <SelectTrigger className="h-8 text-xs w-full sm:w-[160px] shrink-0" aria-label="Sort order">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="az">Name A → Z</SelectItem>
                <SelectItem value="za">Name Z → A</SelectItem>
              </SelectContent>
            </Select>
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

          {/* Brand Pulse, composite health header */}
          {brandId && (
            <BrandPulse
              weeklyIdeas={(weeklyIdeas as any[]) || []}
              autopilotEnabled={autopilotAll}
              nextRunAt={getNextRunTime()}
              timezone={autopilotTimezone}
              pillarsCount={pillars?.length ?? 0}
            />
          )}

          {/* Next Best Action, single recommendation that turns the Hub from passive to autonomous */}
          {brandId && (
            <NextBestActionCard
              brandId={brandId}
              onAction={(action: CtaAction) => {
                switch (action) {
                  case "open_pillars":
                    setHubDialog("pillars");
                    break;
                  case "open_campaigns":
                    setHubDialog("campaigns");
                    break;
                  case "open_series":
                    setHubDialog("series");
                    break;
                  case "generate_weekly_ideas":
                    handleGenerate("generate_weekly_ideas");
                    break;
                  case "enable_autopilot":
                    updateAutopilotSetting({ enabled: true });
                    toast({ title: "Autopilot enabled ⚡", description: "We'll deliver designs daily." });
                    break;
                  case "review_failed": {
                    // Retry all failed_error ideas in one batch
                    (async () => {
                      const failed = ((weeklyIdeas as any[]) || []).filter(
                        (i) => i.autopilot_status === "failed_error",
                      );
                      if (failed.length === 0) return;
                      await supabase
                        .from("content_ideas")
                        .update({ autopilot_status: "pending" } as any)
                        .in("id", failed.map((f) => f.id));
                      toast({ title: `${failed.length} idea${failed.length > 1 ? "s" : ""} queued for retry` });
                      queryClient.invalidateQueries({ queryKey: ["weekly-ideas", brandId] });
                      queryClient.invalidateQueries({ queryKey: ["next-best-action", brandId] });
                    })();
                    break;
                  }
                  default:
                    break;
                }
              }}
            />
          )}

          {/* Upcoming Events Card */}
          {(() => {
            const upcoming = liveHolidays.filter(h => h.daysUntil <= 14);
            if (upcoming.length === 0) return null;
            return (
              <Card className="border-primary/20 bg-primary/[0.03]">
                <CardContent className="p-4 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Gift className="h-4 w-4 text-primary" />
                    <h2 className="text-sm font-semibold">Upcoming Events</h2>
                    <FeatureInfoButton {...FEATURE_INFO.upcomingEvents} />
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

          {/* Hub action buttons, open dialogs */}
          <section className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { key: "pillars" as const, label: "Content Pillars", description: "Themes that guide your content", icon: Layers, count: pillars?.length ?? 0 },
                { key: "campaigns" as const, label: "Campaigns", description: "Time-bound content pushes", icon: Megaphone, count: campaigns?.length ?? 0 },
                { key: "series" as const, label: "Recurring Series", description: "Repeating post formats", icon: Repeat, count: series?.length ?? 0 },
                { key: "trends" as const, label: "Trends", description: "What's moving in your industry", icon: TrendingUp, count: Array.isArray(trendIntel?.trends_data) ? (trendIntel!.trends_data as any[]).length : 0 },
              ].map((action) => (
                <button
                  key={action.key}
                  onClick={() => setHubDialog(action.key)}
                  className="group flex flex-col items-center gap-2.5 rounded-2xl border border-border bg-card p-5 hover:bg-secondary/60 hover:border-primary/30 transition-all text-center"
                >
                  <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/15 transition-colors">
                    <action.icon className="h-5 w-5 text-primary" />
                    {action.count > 0 && (
                      <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
                        {action.count}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{action.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{action.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

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
                    <FeatureInfoButton {...FEATURE_INFO.calendar} />
                    {regenPending && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                    {(() => { const count = (weeklyIdeas || []).filter((i: any) => i.autopilot).length; return count > 0 ? <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">⚡ {count}</span> : null; })()}
                  </div>
                  {openSections.calendar ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 animate-accordion-down data-[state=closed]:animate-accordion-up">
                {/* Calendar nav + actions */}
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
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => fillWeekEmptyDays()} disabled={fillingWeek || !!generating} title="Auto-fill any empty days this week">
                    {fillingWeek ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    Fill week
                  </Button>
                  <Select value={autoFillMode} onValueChange={(v) => updateAutopilotSetting({ auto_fill_mode: v as any })}>
                    <SelectTrigger className="h-8 w-[120px] text-xs" title="Choose when Brandie should automatically fill empty calendar days">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never" className="text-xs">Never auto-fill</SelectItem>
                      <SelectItem value="free_only" className="text-xs">Free tier only</SelectItem>
                      <SelectItem value="always" className="text-xs">Always auto-fill</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => handleGenerate("generate_weekly_ideas")} disabled={!!generating} title="Regenerate the entire week's plan">
                    {generating === "generate_weekly_ideas" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    Regenerate
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
                {/* Calendar */}
                <Card>
                  <CardContent className="p-0 divide-y divide-border">
                    {DAYS.map((day) => {
                      const dayIdeas = ideasByDay[day] || [];
                      const todayIndex = (new Date().getDay() + 6) % 7;
                      const isToday = DAYS[todayIndex] === day;
                      const conflictHoliday = holidayByDay[day];
                      const hasConflict = !!conflictHoliday && dayIdeas.length === 0;
                      const isDropTarget = dragOverDay === day && draggingIdeaId !== null;
                      return (
                        <div
                          key={day}
                          className={`flex items-center gap-3 px-4 py-3 group/day transition-colors ${isToday ? "bg-brandie-neon/10" : ""} ${isDropTarget ? "bg-primary/10 ring-1 ring-primary/40" : ""}`}
                          onDragOver={(e) => {
                            if (draggingIdeaId) {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = "move";
                              if (dragOverDay !== day) setDragOverDay(day);
                            }
                          }}
                          onDragLeave={() => {
                            if (dragOverDay === day) setDragOverDay(null);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const id = e.dataTransfer.getData("text/plain") || draggingIdeaId;
                            setDragOverDay(null);
                            setDraggingIdeaId(null);
                            if (id) rescheduleIdea(id, day);
                          }}
                        >
                          <span className={`text-xs font-medium w-8 shrink-0 ${isToday ? "text-brandie-neon font-bold" : "text-muted-foreground"}`}>
                            {DAY_LABELS[day]}
                          </span>
                          <div className="flex-1 min-w-0">
                            {dayIdeas.length === 0 ? (
                              <div className="flex items-center gap-2">
                                {hasConflict ? (
                                  <span
                                    className="inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400"
                                    title={`${conflictHoliday!.name} falls on this day with nothing scheduled`}
                                  >
                                    <AlertTriangle className="h-3 w-3" />
                                    {conflictHoliday!.name}, nothing scheduled
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground/50">-</span>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                {dayIdeas.map((idea: any) => (
                                  <div
                                    key={idea.id}
                                    className={`flex items-center gap-2 group/idea rounded px-1 -mx-1 transition-opacity ${draggingIdeaId === idea.id ? "opacity-40" : ""}`}
                                    draggable
                                    onDragStart={(e) => {
                                      setDraggingIdeaId(idea.id);
                                      e.dataTransfer.effectAllowed = "move";
                                      e.dataTransfer.setData("text/plain", idea.id);
                                    }}
                                    onDragEnd={() => {
                                      setDraggingIdeaId(null);
                                      setDragOverDay(null);
                                    }}
                                    title="Drag to another day to reschedule"
                                  >
                                    {idea.status === "created" ? (
                                      <Check className="h-3 w-3 text-green-500 shrink-0" />
                                    ) : (
                                      <Lightbulb className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                                    )}
                                    <CategoryDot raw={idea.content_category} />
                                    <span className={`text-xs truncate ${idea.status === "created" ? "text-muted-foreground line-through" : "text-foreground"}`}>
                                      {idea.title}
                                    </span>
                                    {idea.autopilot && idea.status !== "created" && (idea as any).autopilot_status !== "completed" && (
                                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 gap-0.5 bg-primary/15 text-primary border-primary/20">
                                        <Zap className="h-2 w-2" />
                                        autopilot
                                      </Badge>
                                    )}
                                    {(idea as any).autopilot_status === "failed_no_credits" && (
                                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 gap-0.5 bg-destructive/15 text-destructive border-destructive/20" title="Autopilot couldn't create, no credits remaining">
                                        <AlertTriangle className="h-2 w-2" />
                                        no credits
                                      </Badge>
                                    )}
                                    {(idea as any).autopilot_status === "failed_error" && (
                                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 gap-0.5 bg-destructive/15 text-destructive border-destructive/20" title="Autopilot encountered an error, will retry automatically">
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
                                    {idea.content_format === "carousel" && (
                                      idea.status === "created" && (idea as any).design_id ? (
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); setPreviewState({ open: true, designId: (idea as any).design_id, title: idea.title }); }}
                                          title="Preview carousel slides"
                                          className="inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0 h-4 text-[9px] font-semibold shrink-0 bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/20 hover:bg-purple-500/25 transition-colors"
                                        >
                                          <LayoutGrid className="h-2 w-2" />
                                          carousel
                                        </button>
                                      ) : (
                                        <span className="inline-flex items-center rounded-full border px-1.5 py-0 h-4 text-[9px] font-semibold shrink-0 bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/20">
                                          carousel
                                        </span>
                                      )
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
                                        {idea.status === "created" && idea.content_format === "carousel" && (idea as any).design_id && (
                                          <DropdownMenuItem
                                            onClick={() => setPreviewState({ open: true, designId: (idea as any).design_id, title: idea.title })}
                                            className="text-xs gap-2"
                                          >
                                            <LayoutGrid className="h-3.5 w-3.5" />
                                            Preview slides
                                          </DropdownMenuItem>
                                        )}
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
                            <div className="shrink-0 flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => aiFillDay(day)}
                                disabled={fillingDay === day || fillingWeek}
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors disabled:opacity-50 ${hasConflict ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20" : "border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground"}`}
                                title={hasConflict ? `Auto-fill ${DAY_LABELS[day]} with a ${conflictHoliday!.name} idea` : `Auto-fill ${DAY_LABELS[day]} with an AI idea`}
                              >
                                {fillingDay === day ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                                Auto-fill
                              </button>
                              <button
                                type="button"
                                onClick={() => fillDay(day)}
                                className="inline-flex items-center gap-1 rounded-full border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground px-2 py-0.5 text-[10px] font-medium transition-colors opacity-0 group-hover/day:opacity-100 max-sm:opacity-100"
                                title={`Manually add an idea for ${DAY_LABELS[day]}`}
                              >
                                <Plus className="h-3 w-3" />
                                Add
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
                {/* Category Coverage */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 px-1">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Category Coverage</h3>
                    <FeatureInfoButton {...FEATURE_INFO.categoryCoverage} />
                  </div>
                  <CategoryCoveragePanel
                    weeklyIdeas={weeklyIdeas || []}
                    pillars={pillars || []}
                    series={series || []}
                    campaigns={campaigns || []}
                    onAddIdeaForCategory={(catId) => {
                      const todayIdx = (new Date().getDay() + 6) % 7;
                      const day = DAYS[todayIdx];
                      setIdeaForm({ ...emptyIdea, autopilot: autopilotAll, content_category: catId });
                      setEditingIdeaId(null);
                      setIdeaDay(day);
                      setIdeaDialogOpen(true);
                    }}
                  />
                </div>
                {/* Autopilot Settings */}
                <Card className={`border transition-colors ${autopilotAll ? "border-primary/40 bg-primary/[0.04]" : "border-border/60"}`}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`flex items-center justify-center h-7 w-7 rounded-lg ${autopilotAll ? "bg-primary/15" : "bg-muted"} transition-colors`}>
                          <Zap className={`h-3.5 w-3.5 ${autopilotAll ? "text-primary" : "text-muted-foreground"} transition-colors`} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium">Autopilot</p>
                            <FeatureInfoButton {...FEATURE_INFO.autopilot} />
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-tight">
                            Brandie will automatically create and email your designs on scheduled days
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={autopilotAll}
                        onCheckedChange={async (checked) => {
                          // Switch is a quick on/off, sets mode to assisted (on) or manual (off)
                          await updateAutopilotSetting({ mode: checked ? "assisted" : "manual" });
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

                    {/* Mode selector, Manual / Assisted / Autonomous */}
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-xs text-muted-foreground">Mode</Label>
                        <span className="text-[10px] text-muted-foreground">
                          {autopilotMode === "manual" && "You plan, you deliver"}
                          {autopilotMode === "assisted" && "You plan, Brandie delivers"}
                          {autopilotMode === "autonomous" && "Brandie plans and delivers"}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted/50 p-1">
                        {(["manual", "assisted", "autonomous"] as const).map((m) => {
                          const active = autopilotMode === m;
                          const label = m === "manual" ? "Manual" : m === "assisted" ? "Assisted" : "Autonomous";
                          return (
                            <button
                              key={m}
                              type="button"
                              onClick={async () => {
                                await updateAutopilotSetting({ mode: m });
                                toast({
                                  title:
                                    m === "manual"
                                      ? "Switched to Manual"
                                      : m === "assisted"
                                      ? "Switched to Assisted ⚡"
                                      : "Switched to Autonomous 🚀",
                                  description:
                                    m === "manual"
                                      ? "Brandie will not auto-create or auto-plan."
                                      : m === "assisted"
                                      ? "Brandie will auto-create scheduled ideas."
                                      : "Brandie will auto-plan each week and auto-create ideas.",
                                });
                                queryClient.invalidateQueries({ queryKey: ["next-best-action", brandId] });
                              }}
                              className={`text-xs font-medium px-2 py-1.5 rounded-md transition-colors ${
                                active
                                  ? "bg-background text-foreground shadow-sm"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                      {autopilotMode === "autonomous" && (
                        <div className="flex items-center gap-2 pt-1">
                          <Label htmlFor="min-queue" className="text-[11px] text-muted-foreground whitespace-nowrap">
                            Auto-plan when queue below
                          </Label>
                          <Input
                            id="min-queue"
                            type="number"
                            min={1}
                            max={30}
                            value={minQueueThreshold}
                            onChange={(e) => {
                              const v = Math.max(1, Math.min(30, parseInt(e.target.value || "5", 10)));
                              updateAutopilotSetting({ min_queue_threshold: v });
                            }}
                            className="h-7 w-16 text-xs"
                          />
                          <span className="text-[11px] text-muted-foreground">ideas</span>
                        </div>
                      )}
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
              </CollapsibleContent>
            </section>
          </Collapsible>
          {/* Regenerate All */}
          <div className="flex items-center justify-center gap-1.5 pt-2">
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
            <FeatureInfoButton {...FEATURE_INFO.regenerateAll} />
          </div>

          {/* Audience Intelligence context banner */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 px-1">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Audience Suggestions</h3>
              <FeatureInfoButton {...FEATURE_INFO.audienceContext} />
            </div>
            <AudienceContextBanner brandId={brand?.id} />
          </div>

          <div className="h-[70px]" />
        </motion.div>
      </main>

      {/* --- Hub Section Dialogs --- */}
      {/* Content Pillars */}
      <Dialog open={hubDialog === "pillars"} onOpenChange={(open) => !open && setHubDialog(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Content Pillars
              {hasPillars && <Badge variant="secondary" className="text-[10px]">{pillars!.length}</Badge>}
              <FeatureInfoButton {...FEATURE_INFO.pillars} className="ml-1" />
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
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
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {pillars!.map((p: any, i: number) => (
                  <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <Card className="h-full hover:border-primary/30 transition-colors group relative">
                      <CardContent className="p-3 text-center space-y-1">
                        <span className="text-2xl">{p.icon_emoji}</span>
                        <p className="text-xs font-medium leading-tight">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">{p.description}</p>
                        <CategoryBadgeList raw={p.content_category} max={2} className="justify-center pt-0.5" />
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
          </div>
        </DialogContent>
      </Dialog>

      {/* Campaigns */}
      <Dialog open={hubDialog === "campaigns"} onOpenChange={(open) => !open && setHubDialog(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-primary" />
              Campaigns
              {campaigns && campaigns.length > 0 && <Badge variant="secondary" className="text-[10px]">{campaigns.length}</Badge>}
              <FeatureInfoButton {...FEATURE_INFO.campaigns} className="ml-1" />
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-end gap-1">
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={openCreateCampaign}>
                <Plus className="h-3 w-3" /> Add
              </Button>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => handleGenerate("generate_campaigns")} disabled={!!generating}>
                {generating === "generate_campaigns" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                AI Generate
              </Button>
            </div>
            {filteredCampaigns.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredCampaigns.map((c: any, i: number) => (
                  <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <Card className="hover:border-primary/30 transition-colors group relative">
                      <CardContent className="p-4 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold truncate">{c.name}</h3>
                          <Badge variant="outline" className="text-[10px] shrink-0">{c.post_count} posts</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{c.description}</p>
                        <CategoryBadgeList raw={c.content_category} max={2} />
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
          </div>
        </DialogContent>
      </Dialog>

      {/* Recurring Series */}
      <Dialog open={hubDialog === "series"} onOpenChange={(open) => !open && setHubDialog(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Repeat className="h-4 w-4 text-primary" />
              Recurring Series
              {series && series.length > 0 && <Badge variant="secondary" className="text-[10px]">{series.length}</Badge>}
              <FeatureInfoButton {...FEATURE_INFO.series} className="ml-1" />
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-end gap-1">
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={openCreateSeries}>
                <Plus className="h-3 w-3" /> Add
              </Button>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => handleGenerate("generate_series")} disabled={!!generating}>
                {generating === "generate_series" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                AI Generate
              </Button>
            </div>
            {filteredSeries.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredSeries.map((s: any, i: number) => (
                  <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <Card className="hover:border-primary/30 transition-colors group relative">
                      <CardContent className="p-4 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold truncate">{s.name}</h3>
                          <Badge variant="secondary" className="text-[10px] shrink-0">
                            {s.recurrence}{s.preferred_day ? ` · ${DAY_LABELS[s.preferred_day] || s.preferred_day}` : ""}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{s.description}</p>
                        <CategoryBadgeList raw={s.content_category} max={2} />
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
          </div>
        </DialogContent>
      </Dialog>

      {/* Trend Intel */}
      <Dialog open={hubDialog === "trends"} onOpenChange={(open) => !open && setHubDialog(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Trend Intel
              {trendIntel?.generated_at && (
                <span className="text-[10px] font-normal text-muted-foreground">
                  Updated {(() => {
                    const age = Date.now() - new Date(trendIntel.generated_at).getTime();
                    const days = Math.floor(age / (1000 * 60 * 60 * 24));
                    return days === 0 ? "today" : `${days}d ago`;
                  })()}
                </span>
              )}
              <FeatureInfoButton {...FEATURE_INFO.trends} className="ml-1" />
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
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
          </div>
        </DialogContent>
      </Dialog>

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
            <div className="space-y-1.5">
              <Label className="text-xs">Content Categories <span className="text-muted-foreground">(pick up to 3)</span></Label>
              <div className="flex flex-wrap gap-1.5">
                {CONTENT_CATEGORIES.map((c) => {
                  const selected = parseCategoryIds(pillarForm.content_category);
                  const isSel = selected.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        const next = isSel
                          ? selected.filter((s) => s !== c.id)
                          : selected.length >= 3 ? selected : [...selected, c.id];
                        setPillarForm((f) => ({ ...f, content_category: next.join(",") }));
                      }}
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${isSel ? c.badgeClass + " border-transparent" : "border-border/70 text-muted-foreground hover:border-primary/40"}`}
                    >
                      <span>{c.emoji}</span>{c.short}
                    </button>
                  );
                })}
              </div>
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
              <Label className="text-xs">Content Category (optional)</Label>
              <Select
                value={seriesForm.content_category || "none"}
                onValueChange={(v) => setSeriesForm((f) => ({ ...f, content_category: v === "none" ? "" : v }))}
              >
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {CONTENT_CATEGORIES.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.emoji} {c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!editingSeriesId && seriesForm.content_category && seriesForm.content_category === getLastCategory(user?.id, brandId, "series", validCategoryIds) && (
                <p className="text-[10px] text-muted-foreground/80 leading-snug flex items-center gap-1.5 flex-wrap animate-fade-in">
                  <span>Using your last category.</span>
                  <button
                    type="button"
                    onClick={() => {
                      clearLastCategory(user?.id, brandId, "series");
                      setSeriesForm((f) => ({ ...f, content_category: "" }));
                    }}
                    className="underline underline-offset-2 hover:text-foreground transition-colors"
                  >
                    Reset to default
                  </button>
                </p>
              )}
            </div>
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
            <div className="space-y-1.5">
              <Label className="text-xs">Content Category (optional)</Label>
              <Select
                value={campaignForm.content_category || "none"}
                onValueChange={(v) => setCampaignForm((f) => ({ ...f, content_category: v === "none" ? "" : v }))}
              >
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {CONTENT_CATEGORIES.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.emoji} {c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!editingCampaignId && campaignForm.content_category && campaignForm.content_category === getLastCategory(user?.id, brandId, "campaign", validCategoryIds) && (
                <p className="text-[10px] text-muted-foreground/80 leading-snug flex items-center gap-1.5 flex-wrap animate-fade-in">
                  <span>Using your last category.</span>
                  <button
                    type="button"
                    onClick={() => {
                      clearLastCategory(user?.id, brandId, "campaign");
                      setCampaignForm((f) => ({ ...f, content_category: "" }));
                    }}
                    className="underline underline-offset-2 hover:text-foreground transition-colors"
                  >
                    Reset to default
                  </button>
                </p>
              )}
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
              {editingIdeaId ? "Edit Idea" : `Add Idea, ${DAY_LABELS[ideaDay] || ideaDay}`}
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
            {ideaForm.content_format === "carousel" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Slides</Label>
                <Select
                  value={String(ideaForm.slide_count || 5)}
                  onValueChange={(v) => setIdeaForm((f) => ({ ...f, slide_count: Number(v) }))}
                >
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[2,3,4,5,6,7,8,9,10].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n} slides</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div className="space-y-1.5">
              <Label className="text-xs">Content Category (optional)</Label>
              <Select
                value={ideaForm.content_category || "none"}
                onValueChange={(v) => setIdeaForm((f) => ({ ...f, content_category: v === "none" ? "" : v }))}
              >
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {CONTENT_CATEGORIES.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.emoji} {c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!editingIdeaId && ideaForm.content_category && ideaForm.content_category === getLastCategory(user?.id, brandId, "idea", validCategoryIds) && (
                <p className="text-[10px] text-muted-foreground/80 leading-snug flex items-center gap-1.5 flex-wrap animate-fade-in">
                  <span>Using your last category.</span>
                  <button
                    type="button"
                    onClick={() => {
                      clearLastCategory(user?.id, brandId, "idea");
                      setIdeaForm((f) => ({ ...f, content_category: "" }));
                    }}
                    className="underline underline-offset-2 hover:text-foreground transition-colors"
                  >
                    Reset to default
                  </button>
                </p>
              )}
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
      <CarouselPreviewDialog
        open={previewState.open}
        onOpenChange={(o) => setPreviewState((s) => ({ ...s, open: o }))}
        designId={previewState.designId}
        title={previewState.title}
      />
    </div>
  );
};

export default ContentHub;