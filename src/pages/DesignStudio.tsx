import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
} from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  attachedImageUrl?: string;
};

const CANVAS_SIZES = [
  { label: "Square (1080×1080)", value: "1080x1080", aspect: "1 / 1" },
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
  const [canvasSize, setCanvasSize] = useState("1080x1080");
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [mobileTab, setMobileTab] = useState<"chat" | "preview">("chat");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const currentAspect = CANVAS_SIZES.find((s) => s.value === canvasSize)?.aspect || "1 / 1";

  // Credit counter
  const { data: profile, refetch: refetchProfile } = useQuery({
    queryKey: ["profile-studio", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("generations_count, generations_reset_at")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const getCreditsRemaining = () => {
    if (!profile) return FREE_TIER_LIMIT;
    const resetAt = new Date(profile.generations_reset_at);
    const now = new Date();
    if (now.getMonth() !== resetAt.getMonth() || now.getFullYear() !== resetAt.getFullYear()) {
      return FREE_TIER_LIMIT;
    }
    return Math.max(0, FREE_TIER_LIMIT - profile.generations_count);
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
      setCanvasSize(data.canvas_size || "1080x1080");
      setVote((data.vote as -1 | 0 | 1) || 0);
      setSaved(true);

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
    if (data.generations_count >= FREE_TIER_LIMIT) {
      setShowLimitModal(true);
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
          ...(userMsg.attachedImageUrl && { user_image_url: userMsg.attachedImageUrl }),
          ...(isEdit && {
            previous_prompt: currentPrompt,
            previous_image_url: currentImage,
          }),
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast({ title: "Error", description: data.error, variant: "destructive" });
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.error },
        ]);
      } else {
        const freeLabel = data.free_edit ? " (free edit — no credit used)" : "";
        const assistantMsg: Message = {
          role: "assistant",
          content: (data.explanation || "Here's your design.") + freeLabel,
          imageUrl: data.image_url,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setCurrentImage(data.image_url);
        setCurrentPrompt(data.design_prompt || trimmed);
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
    if (!currentImage || !user || !brand || saved) return;
    const { data: designData, error } = await supabase.from("designs").insert({
      user_id: user.id,
      brand_id: brand.id,
      title: messages.find((m) => m.role === "user")?.content?.slice(0, 100) || "Untitled",
      prompt: currentPrompt || "",
      image_url: currentImage,
      canvas_size: canvasSize,
      vote,
    }).select("id").single();
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      // Persist full chat history
      if (designData?.id && messages.length > 0) {
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
    if (saved && currentImage) {
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
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
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
          <span className="text-xs sm:text-sm text-muted-foreground px-2 sm:px-3 py-1 rounded-lg bg-secondary hidden sm:inline">
            {brand?.name || "Brand"}
          </span>
        </div>
      </header>

      {/* Mobile tab switcher */}
      {currentImage && (
        <div className="flex md:hidden border-b border-border">
          <button
            onClick={() => setMobileTab("chat")}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              mobileTab === "chat"
                ? "text-foreground border-b-2 border-primary"
                : "text-muted-foreground"
            }`}
          >
            Chat
          </button>
          <button
            onClick={() => setMobileTab("preview")}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              mobileTab === "preview"
                ? "text-foreground border-b-2 border-primary"
                : "text-muted-foreground"
            }`}
          >
            Preview
          </button>
        </div>
      )}

      {/* Two-panel layout */}
      <div className="flex flex-col md:flex-row flex-1 min-h-0">
        {/* Left — Chat */}
        <div className={`w-full md:w-[420px] flex flex-col md:border-r border-border min-h-0 flex-1 md:flex-initial ${
          currentImage && mobileTab === "preview" ? "hidden md:flex" : "flex"
        }`}>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center">
                  <span className="text-xl">✨</span>
                </div>
                <h3 className="text-lg font-serif">What would you like to design?</h3>
                <p className="text-sm text-muted-foreground max-w-[260px]">
                  Describe your social media post and I'll bring it to life — always on brand.
                </p>
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
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
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
                  {msg.imageUrl && (
                    <img
                      src={msg.imageUrl}
                      alt="Generated design"
                      className="mt-3 rounded-xl border border-border w-full md:hidden"
                    />
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
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 sm:px-4 py-3 sm:py-4 border-t border-border">
            {/* Attached image preview */}
            <AnimatePresence>
              {attachedImage && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-2"
                >
                  <div className="relative inline-block">
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
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleImageUpload}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 rounded-xl shrink-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || uploadingImage}
              >
                {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
              </Button>
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={currentImage ? "Edit your design…" : "Describe your design…"}
                className="rounded-xl h-11"
                disabled={loading}
                maxLength={2000}
              />
              <Button
                size="icon"
                className="h-11 w-11 rounded-xl shrink-0"
                onClick={sendMessage}
                disabled={loading || !input.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Right — Canvas */}
        <div className={`flex-1 flex-col ${
          currentImage && mobileTab === "preview" ? "flex" : "hidden md:flex"
        }`}>
          <div className="flex-1 flex items-center justify-center p-8 bg-muted/30">
            <AnimatePresence mode="wait">
              {currentImage ? (
                <motion.div
                  key={currentImage}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="relative"
                >
                  <img
                    src={currentImage}
                    alt="Design preview"
                    className="max-h-[70vh] rounded-2xl shadow-lg border border-border"
                    style={{ aspectRatio: currentAspect }}
                  />
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center space-y-3"
                >
                  <div
                    className="w-64 rounded-2xl border-2 border-dashed border-border flex items-center justify-center mx-auto"
                    style={{ aspectRatio: currentAspect }}
                  >
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Your design will appear here</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Bottom toolbar */}
          {currentImage && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-3 sm:py-4 border-t border-border flex-wrap"
            >
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl gap-1.5"
                onClick={handleSave}
                disabled={saved}
              >
                <Save className="h-3.5 w-3.5" />
                {saved ? "Saved" : "Save"}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="rounded-xl gap-1.5">
                    <Download className="h-3.5 w-3.5" />
                    Download
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center">
                  <DropdownMenuItem onClick={() => downloadAs("png")}>PNG</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => downloadAs("jpg")}>JPG</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant={vote === 1 ? "default" : "outline"}
                size="sm"
                className="rounded-xl gap-1.5"
                onClick={() => handleVote(1)}
              >
                <ThumbsUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={vote === -1 ? "default" : "outline"}
                size="sm"
                className="rounded-xl gap-1.5"
                onClick={() => handleVote(-1)}
              >
                <ThumbsDown className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl gap-1.5"
                onClick={() => {
                  navigator.clipboard.writeText(currentImage);
                  toast({ title: "Image URL copied" });
                }}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </motion.div>
          )}
        </div>
      </div>

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
