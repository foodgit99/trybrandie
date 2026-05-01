import { useState, useRef, useEffect, useCallback } from "react";
// Guard ref to prevent stale generation results from previous sessions
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useBrand } from "@/hooks/useBrand";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import DesignViewer from "@/components/DesignViewer";
import ReactMarkdown from "react-markdown";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Send,
  Download,
  ThumbsUp,
  ThumbsDown,
  Save,
  Copy,
  Loader2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Paperclip,
  X,
  Users,
  Palette,
  RefreshCw,
  Share2,
  MoreHorizontal,
  BarChart3,
  Info,
  Lightbulb,
  MessageSquare,
  Plus,
  Trash2,
  Layers,
  Search,
  ExternalLink,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { TREND_PRESETS, getTrendById } from "@/lib/trendPresets";
import ChatSuggestions from "@/components/ChatSuggestions";
import { useDesignGeneration, type DesignVariation } from "@/contexts/DesignGenerationContext";
type ResearchSource = {
  title: string;
  url: string;
  description: string;
};

type UpdateUsed = { id: string; title: string; type: string; event_date?: string };

type Message = {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  attachedImageUrl?: string;
  researchSources?: ResearchSource[];
  updatesUsed?: UpdateUsed[];
  contentCategory?: string;
};

type StrategistAction = {
  label: string;
  action: "design" | "ideas";
  prompt: string;
};

const parseStrategistActions = (content: string): { cleanContent: string; actions: StrategistAction[] } => {
  const regex = /<!-- ACTIONS\s*\n([\s\S]*?)\nACTIONS -->/;
  const match = content.match(regex);
  if (!match) return { cleanContent: content, actions: [] };
  try {
    const actions = JSON.parse(match[1]) as StrategistAction[];
    const cleanContent = content.replace(regex, "").trimEnd();
    return { cleanContent, actions: actions.slice(0, 2) };
  } catch {
    return { cleanContent: content, actions: [] };
  }
};

// Platform-locked canvas presets. Each value is the EXACT pixel output
// (width × height) the renderer is forced to produce — see strict resize/crop
// in supabase/functions/design-studio/index.ts.
import {
  CANVAS_PRESETS,
  AUTO_CANVAS_VALUE,
  AUTO_PREVIEW_ASPECT,
  resolveAutoCanvas,
  type CanvasPreset,
} from "@/lib/autoCanvas";

// Backwards-compat list used by the existing currentAspect lookup.
const CANVAS_SIZES = CANVAS_PRESETS;

// Group presets by platform for the Select dropdown.
const CANVAS_GROUPS = CANVAS_PRESETS.reduce<Record<string, CanvasPreset[]>>((acc, p) => {
  (acc[p.platform] ||= []).push(p);
  return acc;
}, {});

const FREE_MONTHLY = 5;

const DesignStudio = () => {
  const { brand } = useBrand();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const generation = useDesignGeneration();
  const [messages, setMessages] = useState<Message[]>([]);
  const [planMessages, setPlanMessages] = useState<Message[]>([]);
  const [chatMode, setChatMode] = useState<"create" | "plan">("create");
  const [planLoading, setPlanLoading] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [showConversationList, setShowConversationList] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState<string | null>(null);
  const [vote, setVote] = useState<-1 | 0 | 1>(0);
  const [saved, setSaved] = useState(false);
  const [currentDesignId, setCurrentDesignId] = useState<string | null>(null);
  const [currentGenome, setCurrentGenome] = useState<any>(null);
  const [currentCaption, setCurrentCaption] = useState<string | null>(null);
  const [genomeScores, setGenomeScores] = useState<Record<string, number> | null>(null);
  const [wasRefined, setWasRefined] = useState(false);
  const [showScores, setShowScores] = useState(false);
  const [canvasSize, setCanvasSize] = useState<string>(AUTO_CANVAS_VALUE);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitContext, setLimitContext] = useState<{ cost: number; available: number } | null>(null);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [mobileTab, setMobileTab] = useState<"chat" | "preview">("chat");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedAudienceId, setSelectedAudienceId] = useState<string | "none">("none");
  const [selectedTrend, setSelectedTrend] = useState<string>("none");
  const [trendIntensity, setTrendIntensity] = useState(40);
  const [trendRecommendation, setTrendRecommendation] = useState<{ trend_id: string; reason: string } | null>(null);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  

  // Carousel mode state — can be activated via URL or local toggle
  const [isCarouselMode, setIsCarouselMode] = useState(searchParams.get("mode") === "carousel");
  const [slideCount, setSlideCount] = useState(5);
  const [carouselSlides, setCarouselSlides] = useState<Array<{ image_url: string; slide_index: number; copy_structure: any; design_id: string }>>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [carouselId, setCarouselId] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  // Dual variation state
  const [variations, setVariations] = useState<DesignVariation[]>([]);
  const [selectedVariationIdx, setSelectedVariationIdx] = useState(0);

  const planAbortRef = useRef<AbortController | null>(null);
  const recommendationFetched = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const planChatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const generationInitiated = useRef(false);

  const currentAspect =
    canvasSize === AUTO_CANVAS_VALUE
      ? AUTO_PREVIEW_ASPECT
      : CANVAS_SIZES.find((s) => s.value === canvasSize)?.aspect || "1 / 1";

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    const lineHeight = Number.parseFloat(window.getComputedStyle(textarea).lineHeight) || 24;
    const maxHeight = lineHeight * 6;
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);

    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [input]);

  // Credit counter
  const { data: profile, refetch: refetchProfile } = useQuery({
    queryKey: ["profile-studio", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("generations_count, generations_reset_at, bonus_credits, subscription_tier, paid_credits").eq("user_id", user!.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Active reward credits (admin-granted, expiring) — must be included in totals
  const { data: rewardCredits = 0, refetch: refetchRewardCredits } = useQuery({
    queryKey: ["reward-credits-studio", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_rewards")
        .select("remaining")
        .eq("user_id", user!.id)
        .gt("remaining", 0)
        .gt("expires_at", new Date().toISOString());
      if (error) return 0;
      return (data || []).reduce((sum, r) => sum + r.remaining, 0);
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  // Audience profiles for the current brand
  const { data: audiences = [] } = useQuery({
    queryKey: ["target_audiences_studio", brand?.id],
    queryFn: async () => {
      if (!brand) return [];
      const { data, error } = await supabase.from("target_audiences" as any).select("id, label, jtbd_profile").eq("brand_id", brand.id).order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!brand,
  });

  // Content ideas for ChatSuggestions
  const { data: contentIdeas = [] } = useQuery({
    queryKey: ["content_ideas_studio", brand?.id],
    queryFn: async () => {
      if (!brand) return [];
      const { data, error } = await supabase
        .from("content_ideas")
        .select("id, title, prompt, status")
        .eq("brand_id", brand.id)
        .in("status", ["suggested", "scheduled"])
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as { id: string; title: string; prompt: string; status: string }[];
    },
    enabled: !!brand,
  });

  // Strategy conversations
  const { data: strategyConversations = [], refetch: refetchConversations } = useQuery({
    queryKey: ["strategy_conversations", brand?.id],
    queryFn: async () => {
      if (!brand) return [];
      const { data, error } = await supabase
        .from("strategy_conversations" as any)
        .select("id, title, updated_at")
        .eq("brand_id", brand.id)
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as unknown as { id: string; title: string; updated_at: string }[];
    },
    enabled: !!brand && !!user,
  });

  // Trend preferences for the current brand
  const { data: trendPrefs } = useQuery({
    queryKey: ["brand_trend_prefs_studio", brand?.id],
    queryFn: async () => {
      if (!brand) return null;
      const { data, error } = await supabase.from("brand_trend_preferences" as any).select("*").eq("brand_id", brand.id).maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!brand,
  });

  // Initialize trend state from saved preferences
  useEffect(() => {
    if (trendPrefs) {
      if (trendPrefs.trend_enabled && trendPrefs.selected_trend !== "none") {
        setSelectedTrend(trendPrefs.selected_trend);
        setTrendIntensity(trendPrefs.default_trend_intensity ?? 40);
      }
    }
  }, [trendPrefs]);

  // Fetch AI trend recommendation when no trend is pre-selected
  useEffect(() => {
    if (recommendationFetched.current) return;
    if (!brand) return;
    // Wait for trendPrefs to load — if they have a trend set, skip recommendation
    if (trendPrefs === undefined) return; // still loading
    if (trendPrefs?.trend_enabled && trendPrefs?.selected_trend !== "none") return; // user already chose

    // Only recommend when starting fresh (no messages)
    if (messages.length > 0) return;

    recommendationFetched.current = true;
    setRecommendationLoading(true);

    const activeAudience = audiences.find((a: any) => a.id === selectedAudienceId);
    const audienceSummary = activeAudience?.jtbd_profile?.persona_summary || null;

    supabase.functions
      .invoke("trend-recommend", {
        body: {
          brand: {
            name: brand.name,
            vibe: brand.vibe,
            description: brand.description,
            tone_of_voice: (brand as any).tone_of_voice,
            personality_traits: (brand as any).personality_traits,
          },
          audience_summary: audienceSummary,
        },
      })
      .then(({ data, error }) => {
        if (!error && data?.trend_id) {
          setTrendRecommendation({ trend_id: data.trend_id, reason: data.reason });
        }
      })
      .catch(() => {})
      .finally(() => setRecommendationLoading(false));
  }, [brand, trendPrefs, audiences, selectedAudienceId, messages.length]);

  // Auto-select first audience
  useEffect(() => {
    if (audiences.length > 0 && selectedAudienceId === "none") {
      setSelectedAudienceId(audiences[0].id);
    }
  }, [audiences, selectedAudienceId]);

  const getCreditsRemaining = () => {
    if (!profile) return FREE_MONTHLY;
    const resetAt = new Date(profile.generations_reset_at);
    const now = new Date();
    const isCurrentMonth = now.getMonth() === resetAt.getMonth() && now.getFullYear() === resetAt.getFullYear();
    const monthlyUsed = isCurrentMonth ? profile.generations_count : 0;
    const freeRemaining = Math.max(0, FREE_MONTHLY - monthlyUsed);
    const bonus = (profile as any).bonus_credits ?? 0;
    const paid = (profile as any).paid_credits ?? 0;
    return freeRemaining + bonus + (rewardCredits ?? 0) + paid;
  };

  useEffect(() => {
    if (chatMode === "plan") {
      planChatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } else {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, planMessages, chatMode]);

  // Reset state when opening studio fresh (no design or carousel param)
  useEffect(() => {
    const designId = searchParams.get("design");
    const carouselParam = searchParams.get("carousel");
    if (!designId && !carouselParam) {
      setMessages([]);
      setCurrentImage(null);
      setCurrentPrompt(null);
      setCurrentDesignId(null);
      setCurrentCaption(null);
      setCurrentGenome(null);
      setGenomeScores(null);
      setVote(0);
      setSaved(false);
      setWasRefined(false);
      setShowScores(false);
      setAttachedImage(null);
      setPreviewImage(null);
      setVariations([]);
      setSelectedVariationIdx(0);
      generationInitiated.current = false;
      generation.clearResult();
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load existing design from query param
  useEffect(() => {
    const designId = searchParams.get("design");
    if (!designId || !user) return;
    const loadDesign = async () => {
      const { data, error } = await supabase
        .from("designs")
        .select("*")
        .eq("id", designId)
        .eq("user_id", user.id)
        .single();
      if (error || !data) return;
      setCurrentImage(data.image_url);
      setCurrentPrompt(data.prompt);
      setCurrentCaption((data as any).caption || null);
      setCanvasSize(data.canvas_size || "1080x1080");
      setVote((data.vote as -1 | 0 | 1) || 0);
      setSaved(true);
      setCurrentDesignId(designId);

      // Load full chat history
      const { data: msgData } = await supabase
        .from("design_messages")
        .select("role, content, image_url, attached_image_url")
        .eq("design_id", designId)
        .order("created_at", { ascending: true });

      if (msgData && msgData.length > 0) {
        setMessages(
          msgData.map((m: any) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
            imageUrl: m.image_url || undefined,
            attachedImageUrl: m.attached_image_url || undefined,
          }))
        );
      } else {
        // Fallback for designs saved before chat history was stored
        setMessages([
          { role: "user", content: data.prompt },
          { role: "assistant", content: "Here's your design.", imageUrl: data.image_url },
        ]);
      }
    };
    loadDesign();
  }, [searchParams, user]);

  // Load existing carousel from ?carousel= param
  useEffect(() => {
    const carouselParam = searchParams.get("carousel");
    if (!carouselParam || !user) return;
    const loadCarousel = async () => {
      const { data, error } = await supabase
        .from("designs")
        .select("*")
        .eq("carousel_id", carouselParam)
        .eq("user_id", user.id)
        .order("slide_index", { ascending: true });
      if (error || !data || data.length === 0) return;

      const slides = data.map((d: any) => ({
        image_url: d.image_url,
        slide_index: d.slide_index ?? 0,
        copy_structure: d.copy_structure,
        design_id: d.id,
      }));

      setCarouselSlides(slides);
      setCarouselId(carouselParam);
      setIsCarouselMode(true);
      setCurrentSlideIndex(0);
      setCurrentImage(slides[0].image_url);
      setCurrentDesignId(slides[0].design_id);
      setCanvasSize(data[0].canvas_size || "1080x1080");
      setCurrentPrompt(data[0].prompt);
      setCurrentCaption((data[0] as any).caption || null);
      setSaved(true);

      // Load chat history from the first slide
      const { data: msgData } = await supabase
        .from("design_messages")
        .select("role, content, image_url, attached_image_url")
        .eq("design_id", slides[0].design_id)
        .order("created_at", { ascending: true });

      if (msgData && msgData.length > 0) {
        setMessages(
          msgData.map((m: any) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
            imageUrl: m.image_url || undefined,
            attachedImageUrl: m.attached_image_url || undefined,
          }))
        );
      } else {
        setMessages([
          { role: "user", content: data[0].prompt },
          { role: "assistant", content: "Here's your carousel.", imageUrl: slides[0].image_url },
        ]);
      }
    };
    loadCarousel();
  }, [searchParams, user]);

  // Pick up hero prompt from sessionStorage (set on landing page → auth)
  useEffect(() => {
    const heroPrompt = sessionStorage.getItem("brandie_hero_prompt");
    if (heroPrompt && messages.length === 0 && !searchParams.get("design")) {
      sessionStorage.removeItem("brandie_hero_prompt");
      setInput(heroPrompt);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pick up prompt and mode from Content Hub URL params
  useEffect(() => {
    const promptParam = searchParams.get("prompt");
    const modeParam = searchParams.get("mode");
    if (modeParam === "plan") {
      setChatMode("plan");
    }
    if (promptParam && messages.length === 0 && !searchParams.get("design")) {
      setInput(promptParam);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const checkGenerationLimit = async (): Promise<boolean> => {
    if (!user) return false;
    const [{ data }, { data: rewards }] = await Promise.all([
      supabase
        .from("profiles")
        .select("generations_count, generations_reset_at, bonus_credits, subscription_tier, paid_credits")
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("credit_rewards")
        .select("remaining")
        .eq("user_id", user.id)
        .gt("remaining", 0)
        .gt("expires_at", new Date().toISOString()),
    ]);
    if (!data) return true;
    const resetAt = new Date(data.generations_reset_at);
    const now = new Date();
    const isCurrentMonth = now.getMonth() === resetAt.getMonth() && now.getFullYear() === resetAt.getFullYear();
    const monthlyUsed = isCurrentMonth ? data.generations_count : 0;
    const freeRemaining = Math.max(0, FREE_MONTHLY - monthlyUsed);
    const bonus = (data as any).bonus_credits ?? 0;
    const paid = (data as any).paid_credits ?? 0;
    const reward = (rewards || []).reduce((sum: number, r: any) => sum + (r.remaining ?? 0), 0);
    const totalAvailable = freeRemaining + bonus + reward + paid;

    const isEdit = !!currentImage && !!currentPrompt;
    // Pricing: Single = 2 credits flat. Carousel = floor(slides * 1.5).
    const creditCost = isCarouselMode
      ? Math.floor(slideCount * 1.5)
      : 2;

    if (creditCost > totalAvailable) {
      setLimitContext({ cost: creditCost, available: totalAvailable });
      setShowLimitModal(true);
      if (user?.email) {
        supabase.functions.invoke("send-email", {
          body: { type: "out_of_credits", to: user.email },
        }).catch(() => {});
      }
      return false;
    }
    return true;
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingImage(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const filePath = `${user.id}/chat-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("brand-inspiration")
        .upload(filePath, file, { contentType: file.type });
      if (error) throw error;
      const { data: urlData } = supabase.storage
        .from("brand-inspiration")
        .getPublicUrl(filePath);
      setAttachedImage(urlData.publicUrl);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading || generation.status === "generating") return;

    const isEdit = !!currentImage && !!currentPrompt;

    // Only check credit limit for new generations (edits may be free — server decides)
    if (!isEdit) {
      const canGenerate = await checkGenerationLimit();
      if (!canGenerate) return;
    }

    const userMsg: Message = { role: "user", content: trimmed, attachedImageUrl: attachedImage || undefined };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setAttachedImage(null);
    setLoading(true);
    setSaved(false);
    if (!isEdit) {
      setCurrentDesignId(null);
    }
    setVote(0);

    // Resolve "Auto" canvas based on the prompt before sending. Edits inherit
    // the current canvas to preserve layout continuity per session memory rules.
    let resolvedCanvasSize = canvasSize;
    if (canvasSize === AUTO_CANVAS_VALUE && !isEdit) {
      const picked = resolveAutoCanvas(trimmed);
      resolvedCanvasSize = picked.value;
      setCanvasSize(picked.value); // sync the selector & preview aspect
      toast({
        title: "Auto-sized for you",
        description: `Using ${picked.label}.`,
      });
    } else if (canvasSize === AUTO_CANVAS_VALUE && isEdit) {
      // Safety net: edits should never ship "auto" to the backend.
      resolvedCanvasSize = "1080x1080";
      setCanvasSize(resolvedCanvasSize);
    }

    const brandPayload = brand
      ? {
          id: brand.id,
          name: brand.name,
          tagline: brand.tagline,
          description: brand.description,
          vibe: brand.vibe,
          primary_colors: brand.primary_colors,
          secondary_colors: brand.secondary_colors,
          accent_colors: brand.accent_colors,
          typography_primary: brand.typography_primary,
          typography_secondary: brand.typography_secondary,
          logo_url: brand.logo_url,
          tone_of_voice: (brand as any).tone_of_voice,
          personality_traits: (brand as any).personality_traits,
          special_instructions: (brand as any).special_instructions,
        }
      : null;

    generationInitiated.current = true;
    generation.startGeneration({
      action: isCarouselMode ? "generate_carousel" : isEdit ? "edit" : "generate",
      ...(isCarouselMode && { slide_count: slideCount }),
      canvas_size: resolvedCanvasSize,
      messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
      brand: brandPayload,
      ...(selectedAudienceId && selectedAudienceId !== "none" && { audience_id: selectedAudienceId }),
      ...(selectedTrend !== "none" && { trend: selectedTrend, trend_intensity: trendIntensity }),
      ...(userMsg.attachedImageUrl && { user_image_url: userMsg.attachedImageUrl }),
      ...(isEdit && {
        previous_prompt: currentPrompt!,
        previous_image_url: currentImage!,
      }),
      // Internal fields for auto-save
      user_id: user!.id,
      brand_id: brand!.id,
      title: trimmed,
      current_design_id: isEdit ? currentDesignId : null,
      selected_trend: selectedTrend,
      user_email: user?.email || undefined,
      full_messages: newMessages.map((m) => ({
        role: m.role,
        content: m.content,
        imageUrl: m.imageUrl,
        attachedImageUrl: m.attachedImageUrl,
      })),
    });
  };

  // Sync generation results back to local state
  useEffect(() => {
    if (!generationInitiated.current) return;
    if (generation.status === "complete" && generation.result) {
      const r = generation.result;

      // Handle carousel result
      if (r.carousel_id && r.slides && r.slides.length > 0) {
        setCarouselSlides(r.slides);
        setCarouselId(r.carousel_id);
        setCurrentSlideIndex(0);
        setCurrentImage(r.slides[0].image_url);
        setCurrentPrompt(r.design_prompt);
        setCurrentGenome(r.genome);
        setCurrentCaption(r.caption);
        setGenomeScores(r.genome_scores);
        setCurrentDesignId(r.slides[0].design_id);
        const assistantMsg: Message = {
          role: "assistant",
          content: r.explanation + ` (${r.slides.length} slides generated)`,
          imageUrl: r.slides[0].image_url,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setSaved(true);
        setLoading(false);
        refetchProfile();
        // Mark content idea as created
        const contentIdeaId = searchParams.get("content_idea_id");
        if (contentIdeaId && r.slides[0].design_id) {
          supabase.from("content_ideas").update({ status: "created", design_id: r.slides[0].design_id } as any).eq("id", contentIdeaId).then(() => {});
        }
        return;
      }

      const freeLabel = r.free_edit ? " (free edit — no credit used)" : "";
      const assistantMsg: Message = {
        role: "assistant",
        content: r.explanation + freeLabel,
        imageUrl: r.image_url,
        researchSources: Array.isArray(r.research_sources) ? r.research_sources : undefined,
        updatesUsed: Array.isArray(r.updates_used) ? r.updates_used : undefined,
        contentCategory: r.content_category,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setCurrentImage(r.image_url);
      setCurrentPrompt(r.design_prompt);
      setCurrentGenome(r.genome);
      setCurrentCaption(r.caption);
      setGenomeScores(r.genome_scores);
      setWasRefined(r.refined);
      setShowScores(false);
      setSaved(true);

      setVariations([]);
      setSelectedVariationIdx(0);

      if (r.design_id) {
        setCurrentDesignId(r.design_id);
        // Mark content idea as created if navigated from Content Hub
        const contentIdeaId = searchParams.get("content_idea_id");
        if (contentIdeaId) {
          supabase.from("content_ideas").update({ status: "created", design_id: r.design_id } as any).eq("id", contentIdeaId).then(() => {});
        }
      }
      setLoading(false);
      refetchProfile();
    } else if (generation.status === "error") {
      const errMsg = generation.error || "Something went wrong";
      if (errMsg.includes("429") || errMsg.toLowerCase().includes("limit")) {
        setShowLimitModal(true);
        setMessages((prev) => [...prev, { role: "assistant", content: "You've reached your generation limit. Upgrade your plan for more credits." }]);
      } else {
        toast({ title: "Generation failed", description: errMsg, variant: "destructive" });
      }
      setLoading(false);
    }
  }, [generation.status, generation.result, generation.error]);

  const handleSave = async () => {
    // Auto-save already persisted the design — just show confirmation
    if (saved) {
      toast({ title: "Design already saved" });
      return;
    }
    if (!currentImage || !user || !brand) return;
    const { data: designData, error } = await supabase.from("designs").insert({
      user_id: user.id,
      brand_id: brand.id,
      title: messages.find((m) => m.role === "user")?.content?.slice(0, 100) || "Untitled",
      prompt: currentPrompt || "",
      image_url: currentImage,
      canvas_size: canvasSize,
      vote,
      ...(selectedTrend !== "none" && { trend_used: selectedTrend, trend_intensity: trendIntensity }),
      ...(currentGenome && { genome: currentGenome }),
    } as any).select("id").single();
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      if (designData?.id && messages.length > 0) {
        setCurrentDesignId(designData.id);
        const rows = messages.map((m) => ({
          design_id: designData.id,
          user_id: user.id,
          role: m.role,
          content: m.content,
          image_url: m.imageUrl || null,
          attached_image_url: m.attachedImageUrl || null,
        }));
        await supabase.from("design_messages").insert(rows);
      }
      setSaved(true);
      toast({ title: "Design saved" });
    }
  };

  const handleVote = async (v: -1 | 1) => {
    const newVote = vote === v ? 0 : v;
    setVote(newVote);
    // Update vote on the auto-saved or manually saved design
    if (currentDesignId) {
      await supabase
        .from("designs")
        .update({ vote: newVote })
        .eq("id", currentDesignId)
        .eq("user_id", user!.id);
    } else if (saved && currentImage) {
      await supabase
        .from("designs")
        .update({ vote: newVote })
        .eq("image_url", currentImage)
        .eq("user_id", user!.id);
    }
  };

  const addWatermark = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = "#ffffff";
    const fontSize = Math.max(14, Math.round(w / 50));
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 4;
    ctx.fillText("Made with Brandie", w - 16, h - 12);
    ctx.restore();
  };

  const downloadAs = async (format: "png" | "jpg") => {
    if (!currentImage) return;
    try {
      const response = await fetch(currentImage);
      const blob = await response.blob();
      const isFree = !profile || (profile as any)?.subscription_tier === "free";

      // Fast path for paid users + PNG: ship original bytes from storage
      // (zero re-encoding, max quality, full native resolution).
      if (format === "png" && !isFree) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `brandie-design-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      }

      const img = new Image();
      img.crossOrigin = "anonymous";
      const objectUrl = URL.createObjectURL(blob);
      img.src = objectUrl;
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; });
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      if (format === "jpg") {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0);
      if (isFree) {
        addWatermark(ctx, canvas.width, canvas.height);
      }
      const mime = format === "png" ? "image/png" : "image/jpeg";
      const ext = format === "png" ? "png" : "jpg";
      // Maximum quality for both formats (1.0 = lossless-ish for JPEG).
      canvas.toBlob((outBlob) => {
        if (!outBlob) return;
        const url = URL.createObjectURL(outBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `brandie-design-${Date.now()}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, mime, 1.0);
      URL.revokeObjectURL(objectUrl);
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    }
  };

  const loadConversation = async (convId: string) => {
    if (!user) return;
    const { data, error } = await supabase
      .from("strategy_messages" as any)
      .select("role, content")
      .eq("conversation_id", convId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    if (error) {
      toast({ title: "Failed to load conversation", variant: "destructive" });
      return;
    }
    const msgs = ((data || []) as unknown as { role: string; content: string }[]).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
    setPlanMessages(msgs);
    setCurrentConversationId(convId);
    setShowConversationList(false);
  };

  const startNewConversation = () => {
    setPlanMessages([]);
    setCurrentConversationId(null);
    setShowConversationList(false);
  };

  const deleteConversation = async (convId: string) => {
    if (!user) return;
    await supabase.from("strategy_conversations" as any).delete().eq("id", convId).eq("user_id", user.id);
    if (currentConversationId === convId) {
      startNewConversation();
    }
    refetchConversations();
  };

  const sendPlanMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || planLoading || !brand || !user) return;

    const userMsg: Message = { role: "user", content: trimmed };
    const newPlanMessages = [...planMessages, userMsg];
    setPlanMessages(newPlanMessages);
    setInput("");
    setPlanLoading(true);

    // Create conversation if needed
    let convId = currentConversationId;
    if (!convId) {
      const title = trimmed.slice(0, 80);
      const { data: convData, error: convError } = await supabase
        .from("strategy_conversations" as any)
        .insert({ user_id: user.id, brand_id: brand.id, title } as any)
        .select("id")
        .single();
      if (convError || !convData) {
        toast({ title: "Failed to create conversation", variant: "destructive" });
        setPlanLoading(false);
        return;
      }
      convId = (convData as any).id;
      setCurrentConversationId(convId);
    }

    // Save user message
    await supabase.from("strategy_messages" as any).insert({
      conversation_id: convId,
      user_id: user.id,
      role: "user",
      content: trimmed,
    } as any);

    const abortController = new AbortController();
    planAbortRef.current = abortController;

    let assistantSoFar = "";
    const upsertAssistant = (nextChunk: string) => {
      assistantSoFar += nextChunk;
      setPlanMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/brand-strategist`;
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const accessToken = currentSession?.access_token;
      if (!accessToken) {
        toast({ title: "Please sign in to use the strategist", variant: "destructive" });
        setPlanLoading(false);
        return;
      }
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          messages: newPlanMessages.map((m) => ({ role: m.role, content: m.content })),
          brand_id: brand.id,
        }),
        signal: abortController.signal,
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({ error: "Request failed" }));
        if (resp.status === 429) {
          toast({ title: "Rate limit reached", description: "Please wait a moment and try again.", variant: "destructive" });
        } else if (resp.status === 402) {
          toast({ title: "Credits exhausted", description: "Please add credits to continue.", variant: "destructive" });
        } else {
          toast({ title: "Error", description: errData.error || "Something went wrong", variant: "destructive" });
        }
        setPlanLoading(false);
        return;
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch { /* ignore */ }
        }
      }

      // Save assistant message + update conversation timestamp
      if (assistantSoFar && convId) {
        await Promise.all([
          supabase.from("strategy_messages" as any).insert({
            conversation_id: convId,
            user_id: user.id,
            role: "assistant",
            content: assistantSoFar,
          } as any),
          supabase.from("strategy_conversations" as any).update({ updated_at: new Date().toISOString() } as any).eq("id", convId),
        ]);
        refetchConversations();
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        toast({ title: "Error", description: "Failed to get a response", variant: "destructive" });
      }
    } finally {
      setPlanLoading(false);
      planAbortRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (chatMode === "plan") {
        sendPlanMessage();
      } else {
        sendMessage();
      }
    }
  };

  // Carousel slide navigation
  const navigateSlide = (delta: number) => {
    if (carouselSlides.length === 0) return;
    const next = Math.max(0, Math.min(carouselSlides.length - 1, currentSlideIndex + delta));
    setCurrentSlideIndex(next);
    setCurrentImage(carouselSlides[next].image_url);
    setCurrentDesignId(carouselSlides[next].design_id);
  };

  // Download all carousel slides
  const downloadAllSlides = async () => {
    for (let i = 0; i < carouselSlides.length; i++) {
      try {
        const resp = await fetch(carouselSlides[i].image_url);
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `carousel-slide-${i + 1}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        await new Promise(r => setTimeout(r, 300));
      } catch {}
    }
    toast({ title: `${carouselSlides.length} slides downloaded` });
  };

  return (
    <div className="h-screen flex flex-col bg-background relative overflow-hidden">
      {/* Top bar — fixed */}
      <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="flex items-center gap-2 sm:gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="hidden sm:block text-lg font-serif tracking-tight">
            Studio
          </h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-secondary text-xs sm:text-sm">
            <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary" />
            <span className="font-medium">{getCreditsRemaining()}</span>
            <span className="text-muted-foreground hidden sm:inline">left</span>
          </div>
          {/* Format toggle: Single / Carousel */}
          {chatMode === "create" && (
            <div className="flex items-center h-8 sm:h-9 rounded-xl border border-input bg-background overflow-hidden">
              <button
                onClick={() => { setIsCarouselMode(false); setCarouselSlides([]); setCarouselId(null); }}
                className={`px-2.5 sm:px-3 h-full text-xs font-medium transition-colors ${
                  !isCarouselMode
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Single
              </button>
              <button
                onClick={() => setIsCarouselMode(true)}
                className={`px-2.5 sm:px-3 h-full text-xs font-medium transition-colors flex items-center gap-1 ${
                  isCarouselMode
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Layers className="h-3 w-3" />
                Carousel
              </button>
            </div>
          )}
          {/* Slide count selector when in carousel mode */}
          {isCarouselMode && chatMode === "create" && (
            <Select value={String(slideCount)} onValueChange={(v) => setSlideCount(Number(v))}>
              <SelectTrigger className="w-[70px] h-8 rounded-xl text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2,3,4,5,6,7,8,9,10].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n} slides</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {chatMode === "create" && (
            <>
          <Select value={canvasSize} onValueChange={setCanvasSize}>
            <SelectTrigger className="w-[150px] sm:w-[230px] h-8 sm:h-9 rounded-xl text-xs sm:text-sm">
              <SelectValue placeholder="Choose platform" />
            </SelectTrigger>
            <SelectContent className="max-h-[60vh]">
              <SelectGroup>
                <SelectLabel className="text-[11px] uppercase tracking-wider text-muted-foreground/70">
                  Smart
                </SelectLabel>
                <SelectItem value={AUTO_CANVAS_VALUE} className="text-xs sm:text-sm">
                  ✨ Auto — pick from prompt
                </SelectItem>
              </SelectGroup>
              {Object.entries(CANVAS_GROUPS).map(([platform, presets]) => (
                <SelectGroup key={platform}>
                  <SelectLabel className="text-[11px] uppercase tracking-wider text-muted-foreground/70">
                    {platform}
                  </SelectLabel>
                  {presets.map((s) => (
                    <SelectItem key={s.value} value={s.value} className="text-xs sm:text-sm">
                      {s.label.replace(`${platform} · `, "").replace(`${platform} `, "")}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
            </>
          )}
          {/* Audience selector removed from header — now in chat input area */}
          <span className="text-xs sm:text-sm text-muted-foreground px-2 sm:px-3 py-1 rounded-lg bg-secondary hidden sm:inline">
            {brand?.name || "Brand"}
          </span>
        </div>
      </header>

      {/* Single-column chat layout — scrollable between fixed header and input */}
      {(
      <div className="flex flex-col flex-1 min-h-0 max-w-2xl mx-auto w-full pt-[60px] pb-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 pb-[180px] space-y-4">
          {chatMode === "plan" ? (
            <>
              {planMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Lightbulb className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-serif">Brand Strategist</h3>
                  <p className="text-sm text-muted-foreground max-w-[300px]">
                    I'm your seasoned branding expert. Ask me anything about your brand strategy, positioning, messaging, or growth.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 max-w-[340px]">
                    {[
                      "How strong is my brand positioning?",
                      "What's my brand archetype?",
                      "How can I differentiate more?",
                      "Review my content strategy",
                    ].map((q) => (
                      <button
                        key={q}
                        onClick={() => setInput(q)}
                        className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>

                  {/* Past conversations */}
                  {strategyConversations.length > 0 && (
                    <div className="w-full max-w-[340px] mt-2">
                      <button
                        onClick={() => setShowConversationList(!showConversationList)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto"
                      >
                        <MessageSquare className="h-3 w-3" />
                        <span>{strategyConversations.length} past conversation{strategyConversations.length !== 1 ? "s" : ""}</span>
                        <ChevronDown className={`h-3 w-3 transition-transform ${showConversationList ? "rotate-180" : ""}`} />
                      </button>
                      <AnimatePresence>
                        {showConversationList && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden mt-2"
                          >
                            <div className="space-y-1 max-h-[200px] overflow-y-auto rounded-xl border border-border bg-card p-2">
                              {strategyConversations.map((conv) => (
                                <div
                                  key={conv.id}
                                  className="flex items-center gap-2 group"
                                >
                                  <button
                                    onClick={() => loadConversation(conv.id)}
                                    className="flex-1 text-left text-xs px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors truncate"
                                  >
                                    <span className="font-medium">{conv.title}</span>
                                    <span className="text-muted-foreground ml-2">
                                      {new Date(conv.updated_at).toLocaleDateString()}
                                    </span>
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteConversation(conv.id);
                                    }}
                                    className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              )}
              {planMessages.length > 0 && (
                <div className="flex justify-center pb-2">
                  <button
                    onClick={startNewConversation}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full border border-border hover:bg-muted/50"
                  >
                    <Plus className="h-3 w-3" />
                    New conversation
                  </button>
                </div>
              )}
              {planMessages.map((msg, i) => {
                const isAssistant = msg.role === "assistant";
                const { cleanContent, actions } = isAssistant
                  ? parseStrategistActions(msg.content)
                  : { cleanContent: msg.content, actions: [] };
                const isLastAssistant = isAssistant && !planLoading && i === planMessages.length - 1;

                return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className="max-w-[85%]">
                    <div
                      className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                          h3: ({ children }) => <h3 className="font-semibold mt-2 mb-1">{children}</h3>,
                          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                        }}
                      >
                        {cleanContent}
                      </ReactMarkdown>
                    </div>
                    {/* Action buttons */}
                    {isLastAssistant && actions.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.2 }}
                        className="flex flex-wrap gap-2 mt-2"
                      >
                        {actions.map((action, j) => (
                          <button
                            key={j}
                            onClick={() => {
                              if (action.action === "design") {
                                setChatMode("create");
                                setInput(action.prompt);
                              } else if (action.action === "ideas") {
                                navigate(`/content?strategist_prompt=${encodeURIComponent(action.prompt)}`);
                              }
                            }}
                            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
                          >
                            {action.action === "design" ? (
                              <Palette className="h-3 w-3" />
                            ) : (
                              <Lightbulb className="h-3 w-3" />
                            )}
                            {action.label}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </div>
                </motion.div>
                );
              })}
              {planLoading && planMessages[planMessages.length - 1]?.role !== "assistant" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                  <div className="bg-secondary rounded-2xl px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Thinking…
                    <button
                      onClick={() => planAbortRef.current?.abort()}
                      className="ml-2 rounded-md bg-destructive/10 hover:bg-destructive/20 text-destructive px-2 py-0.5 text-xs font-medium transition-colors"
                    >
                      Stop
                    </button>
                  </div>
                </motion.div>
              )}
              <div ref={planChatEndRef} />
            </>
          ) : (
            <>
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center">
                <span className="text-xl">✨</span>
              </div>
              <h3 className="text-lg font-serif">What would you like to design?</h3>
              <p className="text-sm text-muted-foreground max-w-[260px]">
                Describe your social media post and I'll bring it to life — always on brand.
              </p>

              {/* Trend recommendation */}
              {recommendationLoading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Finding the perfect trend for your brand…</span>
                </div>
              )}
              {trendRecommendation && selectedTrend === "none" && !recommendationLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full max-w-[300px]"
                >
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                      <Sparkles className="h-3 w-3" />
                      Recommended trend
                    </div>
                    <p className="text-sm font-medium">{getTrendById(trendRecommendation.trend_id)?.name}</p>
                    <p className="text-[11px] text-muted-foreground leading-snug">{trendRecommendation.reason}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedTrend(trendRecommendation.trend_id);
                          setTrendRecommendation(null);
                        }}
                        className="flex-1 text-xs font-medium py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                      >
                        Apply
                      </button>
                      <button
                        onClick={() => setTrendRecommendation(null)}
                        className="flex-1 text-xs font-medium py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted/50 transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Suggestion bubbles — empty state */}
              <ChatSuggestions
                brandName={brand?.name}
                brandVibe={brand?.vibe}
                brandDescription={brand?.description}
                onSelect={(text) => setInput(text)}
                hasMessages={false}
                hasImage={false}
                contentIdeas={contentIdeas}
              />
            </div>
          )}
          {(() => {
            // Find the index of the last assistant message with an image (the current design)
            let lastImageIdx = -1;
            for (let j = messages.length - 1; j >= 0; j--) {
              if (messages[j].role === "assistant" && messages[j].imageUrl) { lastImageIdx = j; break; }
            }
            return messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[85%] ${msg.role === "user" ? "" : ""}`}>
                <div className="relative group">
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {msg.attachedImageUrl && (
                      <img
                        src={msg.attachedImageUrl}
                        alt="Attached reference"
                        className="mb-2 rounded-lg w-20 h-20 object-cover border border-border"
                      />
                    )}
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                  {msg.role === "user" && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(msg.content);
                        toast({ title: "Prompt copied" });
                      }}
                      className="absolute -bottom-1 -left-1 translate-y-full opacity-0 group-hover:opacity-100 h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-150"
                      title="Copy prompt"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Research sources panel — shown when Firecrawl returned grounding for this category */}
                {msg.role === "assistant" && msg.researchSources && msg.researchSources.length > 0 && (
                  <details className="mt-2 rounded-xl border border-border/60 bg-muted/30 text-xs overflow-hidden group/research">
                    <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors list-none [&::-webkit-details-marker]:hidden">
                      <Search className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium text-foreground/80">
                        Research sources
                        {msg.contentCategory ? ` · ${msg.contentCategory}` : ""}
                      </span>
                      <span className="text-muted-foreground">({msg.researchSources.length})</span>
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-auto transition-transform group-open/research:rotate-180" />
                    </summary>
                    <ul className="divide-y divide-border/50">
                      {msg.researchSources.map((src, idx) => {
                        let host = "";
                        try { host = new URL(src.url).hostname.replace(/^www\./, ""); } catch { /* noop */ }
                        return (
                          <li key={idx} className="px-3 py-2">
                            <a
                              href={src.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group/src flex items-start gap-2 hover:text-primary transition-colors"
                            >
                              <ExternalLink className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground group-hover/src:text-primary" />
                              <span className="min-w-0 flex-1">
                                <span className="block font-medium leading-snug truncate">
                                  {src.title || host || src.url}
                                </span>
                                {src.description && (
                                  <span className="block text-muted-foreground leading-snug line-clamp-1 mt-0.5">
                                    {src.description}
                                  </span>
                                )}
                                {host && (
                                  <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/70 mt-0.5">
                                    {host}
                                  </span>
                                )}
                              </span>
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                )}

                {/* Updates used panel — first-party brand updates that fed this design */}
                {msg.role === "assistant" && msg.updatesUsed && msg.updatesUsed.length > 0 && (
                  <details className="mt-2 rounded-xl border border-border/60 bg-muted/30 text-xs overflow-hidden group/updates">
                    <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors list-none [&::-webkit-details-marker]:hidden">
                      <Search className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium text-foreground/80">Pulled from your Updates</span>
                      <span className="text-muted-foreground">({msg.updatesUsed.length})</span>
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-auto transition-transform group-open/updates:rotate-180" />
                    </summary>
                    <ul className="divide-y divide-border/50">
                      {msg.updatesUsed.map((u) => (
                        <li key={u.id} className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">
                              {u.type.replace(/_/g, " ")}
                            </span>
                            <span className="font-medium leading-snug truncate">{u.title}</span>
                            {u.event_date && (
                              <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{u.event_date}</span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                {/* Inline image with action icons beneath */}
                {msg.imageUrl && (
                  <div className="mt-3 space-y-2">
                    {/* Carousel slide navigator */}
                    {carouselSlides.length > 0 && carouselSlides.some(s => s.image_url === msg.imageUrl) && (
                      <div className="space-y-2">
                        <div className="relative">
                          <img
                            src={carouselSlides[currentSlideIndex].image_url}
                            alt={`Slide ${currentSlideIndex + 1}`}
                            className="w-full rounded-2xl border border-border cursor-pointer hover:opacity-95 transition-opacity"
                            style={{ aspectRatio: currentAspect }}
                            onClick={() => { setViewerIndex(currentSlideIndex); setViewerOpen(true); }}
                          />
                          {currentSlideIndex > 0 && (
                            <button onClick={() => navigateSlide(-1)} className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center text-foreground hover:bg-background transition-colors shadow-sm">
                              <ChevronLeft className="h-4 w-4" />
                            </button>
                          )}
                          {currentSlideIndex < carouselSlides.length - 1 && (
                            <button onClick={() => navigateSlide(1)} className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center text-foreground hover:bg-background transition-colors shadow-sm">
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          )}
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1 rounded-full bg-background/80 backdrop-blur-sm">
                            {carouselSlides.map((_, idx) => (
                              <button key={idx} onClick={() => { setCurrentSlideIndex(idx); setCurrentImage(carouselSlides[idx].image_url); setCurrentDesignId(carouselSlides[idx].design_id); }} className={`w-2 h-2 rounded-full transition-colors ${idx === currentSlideIndex ? "bg-primary" : "bg-muted-foreground/30"}`} />
                            ))}
                          </div>
                        </div>
                        {/* Thumbnail strip */}
                        <div className="flex gap-1.5 overflow-x-auto pb-1">
                          {carouselSlides.map((slide, idx) => (
                            <button key={idx} onClick={() => { setCurrentSlideIndex(idx); setCurrentImage(slide.image_url); setCurrentDesignId(slide.design_id); }} className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors ${idx === currentSlideIndex ? "border-primary" : "border-transparent hover:border-border"}`}>
                              <img src={slide.image_url} alt={`Slide ${idx + 1}`} className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                        <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={downloadAllSlides}>
                          <Download className="h-3 w-3" />
                          Download All ({carouselSlides.length} slides)
                        </Button>
                      </div>
                    )}
                    {/* Regular single image (or active variation) */}
                    {(carouselSlides.length === 0 || msg.imageUrl !== carouselSlides[currentSlideIndex]?.image_url) && (
                    <>
                    <img
                      src={msg.imageUrl}
                      alt="Generated design"
                      className="w-full rounded-2xl border border-border cursor-pointer hover:opacity-95 transition-opacity"
                      style={{ aspectRatio: currentAspect }}
                      onClick={() => setPreviewImage(msg.imageUrl!)}
                    />
                    </>
                    )}
                    <div className="flex items-center gap-1 px-1">
                      <button
                        onClick={() => handleVote(1)}
                        className={`h-8 w-8 flex items-center justify-center rounded-lg transition-colors ${
                          i === lastImageIdx && vote === 1 ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        }`}
                      >
                        <ThumbsUp className="h-[18px] w-[18px]" />
                      </button>
                      <button
                        onClick={() => handleVote(-1)}
                        className={`h-8 w-8 flex items-center justify-center rounded-lg transition-colors ${
                          i === lastImageIdx && vote === -1 ? "text-destructive bg-destructive/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        }`}
                      >
                        <ThumbsDown className="h-[18px] w-[18px]" />
                      </button>
                      <button
                        onClick={() => {
                          setInput("Regenerate this design with a fresh approach");
                        }}
                        className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                      >
                        <RefreshCw className="h-[18px] w-[18px]" />
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(msg.imageUrl!);
                          toast({ title: "Image URL copied" });
                        }}
                        className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                      >
                        <Share2 className="h-[18px] w-[18px]" />
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                            <MoreHorizontal className="h-[18px] w-[18px]" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem onClick={handleSave} disabled={saved}>
                            <Save className="h-3.5 w-3.5 mr-2" />
                            {saved ? "Saved" : "Save design"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => downloadAs("png")}>
                            <Download className="h-3.5 w-3.5 mr-2" />
                            Download PNG
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => downloadAs("jpg")}>
                            <Download className="h-3.5 w-3.5 mr-2" />
                            Download JPG
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            navigator.clipboard.writeText(msg.imageUrl!);
                            toast({ title: "Image URL copied" });
                          }}>
                            <Copy className="h-3.5 w-3.5 mr-2" />
                            Copy URL
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Genome Scores */}
                    {genomeScores && msg.imageUrl === currentImage && (
                      <div className="mt-1">
                        <button
                          onClick={() => setShowScores(!showScores)}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-1 py-0.5"
                        >
                          <BarChart3 className="h-3 w-3" />
                          <span>Design Score: {genomeScores.overall}/100</span>
                          <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                            genomeScores.overall >= 75
                              ? "bg-green-500/15 text-green-600 dark:text-green-400"
                              : genomeScores.overall >= 55
                              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                              : "bg-red-500/15 text-red-600 dark:text-red-400"
                          }`}>
                            {genomeScores.overall >= 75 ? "Strong" : genomeScores.overall >= 55 ? "Good" : "Weak"}
                          </span>
                          {wasRefined && (
                            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary">
                              Refined
                            </span>
                          )}
                          <ChevronDown className={`h-3 w-3 transition-transform ${showScores ? "rotate-180" : ""}`} />
                        </button>
                        <AnimatePresence>
                          {showScores && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-2 p-3 bg-secondary/50 rounded-xl space-y-2">
                                {[
                                  { key: "brand_alignment", label: "Brand Alignment", color: "bg-primary" },
                                  { key: "trend_balance", label: "Trend Balance", color: "bg-accent-foreground" },
                                  { key: "visual_clarity", label: "Visual Clarity", color: "bg-primary" },
                                  { key: "conversion", label: "Conversion", color: "bg-accent-foreground" },
                                  { key: "visual_balance", label: "Visual Balance", color: "bg-primary" },
                                ].map(({ key, label, color }) => (
                                  <div key={key} className="space-y-0.5">
                                    <div className="flex justify-between text-xs">
                                      <span className="text-muted-foreground">{label}</span>
                                      <span className="font-medium text-foreground">{genomeScores[key]}</span>
                                    </div>
                                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                      <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${genomeScores[key]}%` }}
                                        transition={{ duration: 0.5, ease: "easeOut" }}
                                        className={`h-full rounded-full ${color} opacity-80`}
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {/* Caption card */}
                    {currentCaption && msg.imageUrl === currentImage && (
                      <div className="mt-3 rounded-xl border border-border bg-card p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">Caption</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(currentCaption);
                              toast({ title: "Caption copied!" });
                            }}
                            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                          >
                            <Copy className="h-3 w-3" />
                            Copy
                          </button>
                        </div>
                        <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{currentCaption}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
            ));
          })()}
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="bg-secondary rounded-2xl px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Designing…
                <button
                  onClick={() => generation.stopGeneration()}
                  className="ml-2 rounded-md bg-destructive/10 hover:bg-destructive/20 text-destructive px-2 py-0.5 text-xs font-medium transition-colors"
                >
                  Stop
                </button>
              </div>
            </motion.div>
          )}
          {/* Suggestion bubbles — after messages */}
          {messages.length > 0 && !loading && (
            <div className="py-2">
              <ChatSuggestions
                brandName={brand?.name}
                brandVibe={brand?.vibe}
                brandDescription={brand?.description}
                onSelect={(text) => setInput(text)}
                hasMessages={true}
                hasImage={!!currentImage}
                contentIdeas={contentIdeas}
              />
            </div>
          )}
          <div ref={chatEndRef} />
            </>
          )}
        </div>

        {/* Input — fixed at bottom */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm">
          <div className="max-w-2xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="rounded-2xl border border-border bg-card shadow-[0_0_15px_-3px_hsl(var(--primary)/0.15),0_0_30px_-5px_hsl(var(--primary)/0.08)] p-3 sm:p-4 space-y-3">
            {/* Attached image preview — only in create mode */}
            {chatMode === "create" && (
              <AnimatePresence>
                {attachedImage && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <div className="relative inline-block mb-1">
                      <img
                        src={attachedImage}
                        alt="Attached"
                        className="w-16 h-16 object-cover rounded-xl border border-border"
                      />
                      <button
                        onClick={() => setAttachedImage(null)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}

            {/* Text input */}
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={chatMode === "plan" ? "Ask your brand strategist…" : currentImage ? "Edit your design…" : "Describe your design"}
              className="w-full bg-transparent text-sm sm:text-base placeholder:text-muted-foreground/50 focus:outline-none resize-none overflow-y-hidden break-words"
              disabled={loading || planLoading}
              maxLength={2000}
            />

            {/* Bottom row */}
            <div className="flex items-center justify-between gap-2">
              {/* Left group */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setChatMode(chatMode === "plan" ? "create" : "plan")}
                  className={`h-8 flex items-center gap-1.5 px-3 rounded-full text-xs font-medium border transition-all ${
                    chatMode === "plan"
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  <Lightbulb className="h-3.5 w-3.5" />
                  Plan
                </button>

                {chatMode === "create" && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                    <button
                      className="h-8 w-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={loading || uploadingImage}
                    >
                      {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className={`h-8 flex items-center gap-1 px-2 rounded-full text-xs font-medium border transition-all ${
                            selectedAudienceId !== "none"
                              ? "border-primary/30 bg-primary/5 text-primary"
                              : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
                          }`}
                        >
                          <Users className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline max-w-[80px] truncate">
                            {audiences.find((a: any) => a.id === selectedAudienceId)?.label || "Audience"}
                          </span>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="min-w-[180px]">
                        <DropdownMenuItem
                          onClick={() => setSelectedAudienceId("none")}
                          className={selectedAudienceId === "none" ? "bg-accent" : ""}
                        >
                          <span className="text-muted-foreground">No audience</span>
                        </DropdownMenuItem>
                        {audiences.map((a: any) => (
                          <DropdownMenuItem
                            key={a.id}
                            onClick={() => setSelectedAudienceId(a.id)}
                            className={selectedAudienceId === a.id ? "bg-accent" : ""}
                          >
                            {a.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </div>

              {/* Right group */}
              <div className="flex items-center gap-1.5">
                {chatMode === "create" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      {(() => {
                        const activeTrend = getTrendById(selectedTrend);
                        return (
                          <button
                            className={`h-8 flex items-center gap-1 px-2.5 rounded-full text-xs font-medium border transition-all ${
                              activeTrend
                                ? "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
                                : "border-border text-muted-foreground hover:border-muted-foreground/40 hover:bg-muted/50"
                            }`}
                          >
                            <Palette className="h-3.5 w-3.5 sm:hidden" />
                            <span className="hidden sm:inline">{activeTrend?.name || "Trend"}</span>
                            <span className="sm:hidden">{activeTrend ? "" : ""}</span>
                            <ChevronDown className="h-3 w-3 opacity-60" />
                          </button>
                        );
                      })()}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[220px] space-y-1 p-2">
                      <DropdownMenuItem
                        onClick={() => setSelectedTrend("none")}
                        className={selectedTrend === "none" ? "bg-accent" : ""}
                      >
                        <span className="text-muted-foreground">No trend</span>
                      </DropdownMenuItem>
                      {TREND_PRESETS.map((t) => (
                        <DropdownMenuItem
                          key={t.id}
                          onClick={() => setSelectedTrend(t.id)}
                          className={selectedTrend === t.id ? "bg-accent" : ""}
                        >
                          <div>
                            <p className="text-sm font-medium">{t.name}</p>
                            <p className="text-[10px] text-muted-foreground">{t.description}</p>
                          </div>
                        </DropdownMenuItem>
                      ))}
                      {selectedTrend !== "none" && (
                        <div className="px-2 py-2 space-y-1.5 border-t border-border mt-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground">Intensity</span>
                            <span className="text-[10px] font-mono text-muted-foreground">{trendIntensity}%</span>
                          </div>
                          <Slider
                            value={[trendIntensity]}
                            onValueChange={([val]) => setTrendIntensity(val)}
                            min={0}
                            max={100}
                            step={5}
                            className="w-full"
                          />
                        </div>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <button
                  className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                  onClick={chatMode === "plan" ? sendPlanMessage : sendMessage}
                  disabled={(chatMode === "plan" ? planLoading : loading) || !input.trim()}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
      )}

      {/* Fullscreen image preview — carousel viewer or single image */}
      {carouselSlides.length > 0 ? (
        <DesignViewer
          designs={carouselSlides.map((slide, idx) => ({
            id: slide.design_id || `carousel-${idx}`,
            title: `Slide ${idx + 1}`,
            prompt: "",
            image_url: slide.image_url,
            created_at: new Date().toISOString(),
            canvas_size: canvasSize,
          }))}
          initialIndex={viewerIndex}
          open={viewerOpen}
          onClose={() => setViewerOpen(false)}
        />
      ) : (
        <AnimatePresence>
          {previewImage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center"
              onClick={() => setPreviewImage(null)}
            >
              <button
                onClick={() => setPreviewImage(null)}
                className="absolute top-4 right-4 h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-foreground hover:bg-muted transition-colors z-10"
              >
                <X className="h-5 w-5" />
              </button>
              <motion.img
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.2 }}
                src={previewImage}
                alt="Design preview"
                className="max-h-[90vh] max-w-[90vw] rounded-2xl shadow-2xl border border-border"
                onClick={(e) => e.stopPropagation()}
              />
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Limit reached modal */}
      <Dialog open={showLimitModal} onOpenChange={setShowLimitModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Not enough credits</DialogTitle>
            <DialogDescription>
              {limitContext
                ? `This generation needs ${limitContext.cost} credit${limitContext.cost === 1 ? "" : "s"}, but you only have ${limitContext.available} available. Top up to keep creating.`
                : "You don't have enough credits for this generation. Top up to keep creating."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLimitModal(false)}>
              Close
            </Button>
            <Button onClick={() => navigate("/plans")}>View Plans</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DesignStudio;
