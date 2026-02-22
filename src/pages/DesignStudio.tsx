import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
} from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState<string | null>(null);
  const [vote, setVote] = useState<-1 | 0 | 1>(0);
  const [saved, setSaved] = useState(false);
  const [canvasSize, setCanvasSize] = useState("1080x1080");
  const [showLimitModal, setShowLimitModal] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const currentAspect = CANVAS_SIZES.find((s) => s.value === canvasSize)?.aspect || "1 / 1";

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const checkGenerationLimit = async (): Promise<boolean> => {
    if (!user) return false;
    const { data } = await supabase
      .from("profiles")
      .select("generations_count, generations_reset_at")
      .eq("user_id", user.id)
      .single();
    if (!data) return true;
    // Reset monthly counter if needed
    const resetAt = new Date(data.generations_reset_at);
    const now = new Date();
    if (now.getMonth() !== resetAt.getMonth() || now.getFullYear() !== resetAt.getFullYear()) {
      return true; // will be reset server-side
    }
    if (data.generations_count >= FREE_TIER_LIMIT) {
      setShowLimitModal(true);
      return false;
    }
    return true;
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const canGenerate = await checkGenerationLimit();
    if (!canGenerate) return;

    const userMsg: Message = { role: "user", content: trimmed };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setSaved(false);
    setVote(0);

    try {
      const { data, error } = await supabase.functions.invoke("design-studio", {
        body: {
          action: "generate",
          canvas_size: canvasSize,
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          brand: brand
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
              }
            : null,
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
        const assistantMsg: Message = {
          role: "assistant",
          content: data.explanation || "Here's your design.",
          imageUrl: data.image_url,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setCurrentImage(data.image_url);
        setCurrentPrompt(data.design_prompt || trimmed);
      }
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
    const { error } = await supabase.from("designs").insert({
      user_id: user.id,
      brand_id: brand.id,
      title: messages.find((m) => m.role === "user")?.content?.slice(0, 100) || "Untitled",
      prompt: currentPrompt || "",
      image_url: currentImage,
      canvas_size: canvasSize,
      vote,
    });
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
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

  const downloadAs = async (format: "png" | "jpg") => {
    if (!currentImage) return;
    try {
      const response = await fetch(currentImage);
      const blob = await response.blob();

      if (format === "png") {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `brandie-design-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // Convert to JPG via canvas
        const img = new Image();
        img.crossOrigin = "anonymous";
        const objectUrl = URL.createObjectURL(blob);
        img.src = objectUrl;
        await new Promise<void>((res, rej) => {
          img.onload = () => res();
          img.onerror = rej;
        });
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        // Add watermark for free tier
        addWatermark(ctx, canvas.width, canvas.height);
        canvas.toBlob(
          (jpgBlob) => {
            if (!jpgBlob) return;
            const url = URL.createObjectURL(jpgBlob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `brandie-design-${Date.now()}.jpg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          },
          "image/jpeg",
          0.92
        );
        URL.revokeObjectURL(objectUrl);
      }
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    }
  };

  const addWatermark = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    // Free tier watermark — always applied for now (paid tiers will skip this)
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = "#ffffff";
    const fontSize = Math.max(14, Math.round(w / 50));
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    // Shadow for readability
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 4;
    ctx.fillText("Made with Brandie", w - 16, h - 12);
    ctx.restore();
  };

  const handleDownloadPng = async () => {
    if (!currentImage) return;
    try {
      const response = await fetch(currentImage);
      const blob = await response.blob();
      // Re-draw on canvas to add watermark
      const img = new Image();
      img.crossOrigin = "anonymous";
      const objectUrl = URL.createObjectURL(blob);
      img.src = objectUrl;
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = rej;
      });
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      addWatermark(ctx, canvas.width, canvas.height);
      canvas.toBlob(
        (pngBlob) => {
          if (!pngBlob) return;
          const url = URL.createObjectURL(pngBlob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `brandie-design-${Date.now()}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        },
        "image/png"
      );
      URL.revokeObjectURL(objectUrl);
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
      <header className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-serif tracking-tight">Design Studio</h1>
        </div>
        <div className="flex items-center gap-3">
          <Select value={canvasSize} onValueChange={setCanvasSize}>
            <SelectTrigger className="w-[180px] h-9 rounded-xl text-sm">
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
          <span className="text-sm text-muted-foreground px-3 py-1 rounded-lg bg-secondary">
            {brand?.name || "Brand"}
          </span>
        </div>
      </header>

      {/* Two-panel layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left — Chat */}
        <div className="w-full md:w-[420px] flex flex-col border-r border-border">
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
          <div className="px-4 py-4 border-t border-border">
            <div className="flex items-center gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe your design…"
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
        <div className="hidden md:flex flex-1 flex-col">
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
              className="flex items-center justify-center gap-2 px-6 py-4 border-t border-border"
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
                  <DropdownMenuItem onClick={handleDownloadPng}>PNG</DropdownMenuItem>
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
