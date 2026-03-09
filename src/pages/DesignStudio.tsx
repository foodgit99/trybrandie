import { useState, useRef, useEffect, useCallback } from "react";
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
  SelectItem,
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
  Sparkles,
  Paperclip,
  X,
  Users,
  Palette,
  RefreshCw,
  Share2,
  MoreHorizontal,
  BarChart3,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { TREND_PRESETS, getTrendById } from "@/lib/trendPresets";
import ChatSuggestions from "@/components/ChatSuggestions";
import { useDesignGeneration } from "@/contexts/DesignGenerationContext";
type Message = {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  attachedImageUrl?: string;
};

const CANVAS_SIZES = [
  { label: "Square (1080×1080)", value: "1080x1080", aspect: "1 / 1" },
  { label: "Landscape (1920×1080)", value: "1920x1080", aspect: "16 / 9" },
  { label: "Story (1080×1920)", value: "1080x1920", aspect: "9 / 16" },
];

const FREE_TIER_LIMIT = 10;

const DesignStudio = () => {
  const { brand } = useBrand();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
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
  const [canvasSize, setCanvasSize] = useState("1080x1080");
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [mobileTab, setMobileTab] = useState<"chat" | "preview">("chat");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedAudienceId, setSelectedAudienceId] = useState<string | "none">("none");
  const [selectedTrend, setSelectedTrend] = useState<string>("none");
  const [trendIntensity, setTrendIntensity] = useState(40);
  const [trendRecommendation, setTrendRecommendation] = useState<{ trend_id: string; reason: string } | null>(null);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [renderQuality, setRenderQuality] = useState<"fast" | "hd">("fast");
  const recommendationFetched = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const currentAspect = CANVAS_SIZES.find((s) => s.value === canvasSize)?.aspect || "1 / 1";

  // Credit counter
  const { data: profile, refetch: refetchProfile } = useQuery({
    queryKey: ["profile-studio", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("generations_count, generations_reset_at, bonus_credits").eq("user_id", user!.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
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
    if (!profile) return FREE_TIER_LIMIT;
    const resetAt = new Date(profile.generations_reset_at);
    const now = new Date();
    if (now.getMonth() !== resetAt.getMonth() || now.getFullYear() !== resetAt.getFullYear()) {
      return FREE_TIER_LIMIT;
    }
    const bonus = (profile as any).bonus_credits ?? 0;
    return Math.max(0, FREE_TIER_LIMIT + bonus - profile.generations_count);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  const checkGenerationLimit = async (): Promise<boolean> => {
    if (!user) return false;
    const { data } = await supabase
      .from("profiles")
      .select("generations_count, generations_reset_at")
      .eq("user_id", user.id)
      .single();
    if (!data) return true;
    const resetAt = new Date(data.generations_reset_at);
    const now = new Date();
    if (now.getMonth() !== resetAt.getMonth() || now.getFullYear() !== resetAt.getFullYear()) {
      return true;
    }
    const creditCost = renderQuality === "hd" ? 2 : 1;
    const bonus = (data as any).bonus_credits ?? 0;
    if (data.generations_count + creditCost > FREE_TIER_LIMIT + bonus) {
      setShowLimitModal(true);
      // Send out-of-credits email (fire-and-forget)
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
    if (!trimmed || loading) return;

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
    // Only reset design ID for genuinely new generations, not edits
    if (!isEdit) {
      setCurrentDesignId(null);
    }
    setVote(0);

    try {
      const brandPayload = brand
        ? {
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
          }
        : null;

      const { data, error } = await supabase.functions.invoke("design-studio", {
        body: {
          action: isEdit ? "edit" : "generate",
          canvas_size: canvasSize,
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          brand: brandPayload,
          ...(selectedAudienceId && selectedAudienceId !== "none" && { audience_id: selectedAudienceId }),
          ...(selectedTrend !== "none" && { trend: selectedTrend, trend_intensity: trendIntensity }),
          ...(userMsg.attachedImageUrl && { user_image_url: userMsg.attachedImageUrl }),
          render_quality: renderQuality,
          ...(isEdit && {
            previous_prompt: currentPrompt,
            previous_image_url: currentImage,
          }),
        },
      });

      if (error) {
        const errMsg = error.message || "";
        if (errMsg.includes("429") || errMsg.toLowerCase().includes("limit") || errMsg.toLowerCase().includes("rate")) {
          setShowLimitModal(true);
          setMessages((prev) => [...prev, { role: "assistant", content: "You've reached your generation limit for this month. Upgrade your plan for more credits." }]);
        } else if (errMsg.includes("402") || errMsg.toLowerCase().includes("payment")) {
          toast({ title: "AI credits exhausted", description: "Please try again later or upgrade your plan.", variant: "destructive" });
          setMessages((prev) => [...prev, { role: "assistant", content: "AI credits are temporarily exhausted. Please try again later." }]);
        } else {
          throw error;
        }
      } else if (data?.error) {
        // Check if the edge function returned a soft error in the body
        const bodyErr = (data.error || "").toLowerCase();
        if (bodyErr.includes("limit") || bodyErr.includes("429")) {
          setShowLimitModal(true);
        } else {
          toast({ title: "Error", description: data.error, variant: "destructive" });
        }
        setMessages((prev) => [...prev, { role: "assistant", content: data.error }]);
      } else {
        const freeLabel = data.free_edit ? " (free edit — no credit used)" : "";
        const assistantMsg: Message = {
          role: "assistant",
          content: (data.explanation || "Here's your design.") + freeLabel,
          imageUrl: data.image_url,
        };
        const updatedMessages = [...newMessages, assistantMsg];
        setMessages(updatedMessages);
        setCurrentImage(data.image_url);
        setCurrentPrompt(data.design_prompt || trimmed);
        setCurrentGenome(data.genome || null);
        setCurrentCaption(data.caption || null);
        setGenomeScores(data.genome_scores || null);
        setWasRefined(data.refined === true);
        setShowScores(false);

        // --- AUTO-SAVE: persist design + genome immediately so RAG learning loop always has data ---
        if (data.image_url && user && brand) {
          try {
            if (isEdit && currentDesignId) {
              // Update existing design record
              const { error: updateErr } = await supabase.from("designs").update({
                title: trimmed.slice(0, 100) || "Untitled",
                prompt: data.design_prompt || trimmed,
                image_url: data.image_url,
                canvas_size: canvasSize,
                ...(selectedTrend !== "none" && { trend_used: selectedTrend, trend_intensity: trendIntensity }),
                ...(data.genome && { genome: data.genome }),
                ...(data.caption && { caption: data.caption }),
              } as any).eq("id", currentDesignId);
              if (!updateErr) {
                setSaved(true);
                // Append new messages to chat history
                const newChatRows = [userMsg, assistantMsg].map((m) => ({
                  design_id: currentDesignId,
                  user_id: user.id,
                  role: m.role,
                  content: m.content,
                  image_url: m.imageUrl || null,
                  attached_image_url: m.attachedImageUrl || null,
                }));
                await supabase.from("design_messages").insert(newChatRows);
              }
            } else {
              // Insert new design record
              const { data: designData, error: saveErr } = await supabase.from("designs").insert({
                user_id: user.id,
                brand_id: brand.id,
                title: trimmed.slice(0, 100) || "Untitled",
                prompt: data.design_prompt || trimmed,
                image_url: data.image_url,
                canvas_size: canvasSize,
                vote: 0,
                ...(selectedTrend !== "none" && { trend_used: selectedTrend, trend_intensity: trendIntensity }),
                ...(data.genome && { genome: data.genome }),
                ...(data.caption && { caption: data.caption }),
              } as any).select("id").single();

              if (!saveErr && designData?.id) {
                setSaved(true);
                setCurrentDesignId(designData.id);
                // Persist chat history
                const chatRows = updatedMessages.map((m) => ({
                  design_id: designData.id,
                  user_id: user.id,
                  role: m.role,
                  content: m.content,
                  image_url: m.imageUrl || null,
                  attached_image_url: m.attachedImageUrl || null,
                }));
                await supabase.from("design_messages").insert(chatRows);
              }
            }
          } catch (autoSaveErr) {
            console.error("Auto-save failed:", autoSaveErr);
          }
        }
      }

      // Refresh credit counter
      refetchProfile();
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Generation failed",
        description: err.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

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

      if (format === "png") {
        const img = new Image();
        img.crossOrigin = "anonymous";
        const objectUrl = URL.createObjectURL(blob);
        img.src = objectUrl;
        await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; });
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        addWatermark(ctx, canvas.width, canvas.height);
        canvas.toBlob((pngBlob) => {
          if (!pngBlob) return;
          const url = URL.createObjectURL(pngBlob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `brandie-design-${Date.now()}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, "image/png");
        URL.revokeObjectURL(objectUrl);
      } else {
        const img = new Image();
        img.crossOrigin = "anonymous";
        const objectUrl = URL.createObjectURL(blob);
        img.src = objectUrl;
        await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; });
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        addWatermark(ctx, canvas.width, canvas.height);
        canvas.toBlob((jpgBlob) => {
          if (!jpgBlob) return;
          const url = URL.createObjectURL(jpgBlob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `brandie-design-${Date.now()}.jpg`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, "image/jpeg", 0.92);
        URL.revokeObjectURL(objectUrl);
      }
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top bar */}
      <header className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-base sm:text-lg font-serif tracking-tight">Studio</h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-secondary text-xs sm:text-sm">
            <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary" />
            <span className="font-medium">{getCreditsRemaining()}</span>
            <span className="text-muted-foreground hidden sm:inline">left</span>
          </div>
          <Select value={canvasSize} onValueChange={setCanvasSize}>
            <SelectTrigger className="w-[120px] sm:w-[180px] h-8 sm:h-9 rounded-xl text-xs sm:text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CANVAS_SIZES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Quality toggle */}
          <div className="flex items-center h-8 sm:h-9 rounded-xl border border-input bg-background overflow-hidden">
            <button
              onClick={() => setRenderQuality("fast")}
              className={`px-2.5 sm:px-3 h-full text-xs font-medium transition-colors ${
                renderQuality === "fast"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Fast
            </button>
            <button
              onClick={() => setRenderQuality("hd")}
              className={`px-2.5 sm:px-3 h-full text-xs font-medium transition-colors flex items-center gap-1 ${
                renderQuality === "hd"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sparkles className="h-3 w-3" />
              HD
            </button>
          </div>
          {/* Audience selector removed from header — now in chat input area */}
          <span className="text-xs sm:text-sm text-muted-foreground px-2 sm:px-3 py-1 rounded-lg bg-secondary hidden sm:inline">
            {brand?.name || "Brand"}
          </span>
        </div>
      </header>

      {/* Single-column chat layout */}
      <div className="flex flex-col flex-1 min-h-0 max-w-2xl mx-auto w-full">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-4">
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
              />
            </div>
          )}
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[85%] ${msg.role === "user" ? "" : ""}`}>
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

                {/* Inline image with action icons beneath */}
                {msg.imageUrl && (
                  <div className="mt-3 space-y-2">
                    <img
                      src={msg.imageUrl}
                      alt="Generated design"
                      className="w-full rounded-2xl border border-border cursor-pointer hover:opacity-95 transition-opacity"
                      style={{ aspectRatio: currentAspect }}
                      onClick={() => setPreviewImage(msg.imageUrl!)}
                    />
                    <div className="flex items-center gap-1 px-1">
                      <button
                        onClick={() => handleVote(1)}
                        className={`h-8 w-8 flex items-center justify-center rounded-lg transition-colors ${
                          vote === 1 ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        }`}
                      >
                        <ThumbsUp className="h-[18px] w-[18px]" />
                      </button>
                      <button
                        onClick={() => handleVote(-1)}
                        className={`h-8 w-8 flex items-center justify-center rounded-lg transition-colors ${
                          vote === -1 ? "text-destructive bg-destructive/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
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
          ))}
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="bg-secondary rounded-2xl px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Designing…
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
              />
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input — unified card */}
        <div className="px-3 sm:px-4 py-3 sm:py-4">
          <div className="rounded-2xl border border-border bg-card shadow-sm p-3 sm:p-4 space-y-3">
            {/* Attached image preview */}
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

            {/* Text input */}
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={currentImage ? "Edit your design…" : "Describe your design"}
              className="w-full bg-transparent text-sm sm:text-base placeholder:text-muted-foreground/50 focus:outline-none"
              disabled={loading}
              maxLength={2000}
            />

            {/* Bottom row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleImageUpload}
                />
                <button
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading || uploadingImage}
                >
                  {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="h-8 flex items-center gap-1 px-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                      <Users className="h-4 w-4" />
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
                {(() => {
                  const activeAudience = audiences.find((a: any) => a.id === selectedAudienceId);
                  return activeAudience ? (
                    <span className="text-xs text-primary font-medium truncate max-w-[140px]">
                      {activeAudience.label}
                    </span>
                  ) : null;
                })()}
              </div>
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    {(() => {
                      const activeTrend = getTrendById(selectedTrend);
                      return (
                        <button
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                            activeTrend
                              ? "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
                              : "border-border text-muted-foreground hover:border-muted-foreground/40 hover:bg-muted/50"
                          }`}
                        >
                          <span>{activeTrend?.name || "Trend"}</span>
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
                <button
                  className="h-9 w-9 rounded-full border border-border flex items-center justify-center text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                  onClick={sendMessage}
                  disabled={loading || !input.trim()}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen image preview overlay */}
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

      {/* Limit reached modal */}
      <Dialog open={showLimitModal} onOpenChange={setShowLimitModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Generation limit reached</DialogTitle>
            <DialogDescription>
              You've used all 10 free generations this month. Upgrade your plan to keep creating.
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
