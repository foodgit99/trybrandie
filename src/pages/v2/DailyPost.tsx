import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBrand } from "@/hooks/useBrand";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  Loader2,
  MessageCircle,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import SEO from "@/components/SEO";
import { getCategoryMeta, parseCategoryIds } from "@/lib/contentCategories";

type Idea = {
  id: string;
  title: string;
  prompt: string;
  content_category: string | null;
  scheduled_for: string | null;
  status: string;
  approval_status: string;
  design_id: string | null;
  whatsapp_dm: string | null;
  brand_id: string;
};

type Design = {
  id: string;
  image_url: string;
  caption: string | null;
  title: string | null;
};

const DailyPost = () => {
  const { dayId } = useParams<{ dayId: string }>();
  const { user, loading: authLoading } = useAuth();
  const { brand, isLoading: brandLoading } = useBrand(user);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [voting, setVoting] = useState(false);
  const [marking, setMarking] = useState(false);
  const [captionDraft, setCaptionDraft] = useState("");

  const { data: idea, isLoading: ideaLoading, refetch: refetchIdea } = useQuery({
    queryKey: ["v2-daily-idea", dayId],
    queryFn: async (): Promise<Idea | null> => {
      if (!dayId) return null;
      const { data, error } = await supabase
        .from("content_ideas")
        .select(
          "id, title, prompt, content_category, scheduled_for, status, approval_status, design_id, whatsapp_dm, brand_id",
        )
        .eq("id", dayId)
        .maybeSingle();
      if (error) throw error;
      return data as Idea | null;
    },
    enabled: !!dayId,
  });

  const { data: design, refetch: refetchDesign } = useQuery({
    queryKey: ["v2-daily-design", idea?.design_id],
    queryFn: async (): Promise<Design | null> => {
      if (!idea?.design_id) return null;
      const { data, error } = await supabase
        .from("designs")
        .select("id, image_url, caption, title")
        .eq("id", idea.design_id)
        .maybeSingle();
      if (error) throw error;
      return data as Design | null;
    },
    enabled: !!idea?.design_id,
  });

  // Seed caption draft from design caption or whatsapp_dm
  useEffect(() => {
    const initial = design?.caption ?? idea?.whatsapp_dm ?? "";
    if (initial && !captionDraft) setCaptionDraft(initial);
  }, [design?.caption, idea?.whatsapp_dm]); // eslint-disable-line

  // Soft poll while a generation is in-flight (no design yet but approved)
  useEffect(() => {
    if (!idea) return;
    const needsDesign = !idea.design_id;
    if (!needsDesign) return;
    const t = setInterval(() => {
      refetchIdea();
    }, 6000);
    return () => clearInterval(t);
  }, [idea?.id, idea?.design_id]); // eslint-disable-line

  const dayLabel = useMemo(() => {
    if (!idea?.scheduled_for) return "Today";
    return new Date(idea.scheduled_for).toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }, [idea?.scheduled_for]);

  const catMeta = useMemo(() => {
    const id = parseCategoryIds(idea?.content_category ?? null)[0];
    return id ? getCategoryMeta(id) : undefined;
  }, [idea?.content_category]);

  const handleGenerate = async () => {
    if (!idea || !brand) return;
    setGenerating(true);
    try {
      const { error } = await supabase.functions.invoke("design-enqueue", {
        body: {
          action: "generate",
          brand: { id: brand.id },
          prompt: idea.prompt || idea.title,
          title: idea.title,
          content_category: idea.content_category,
          idea_id: idea.id,
        },
      });
      if (error) throw error;
      toast({
        title: "On it.",
        description: "Brandie is rendering your post. It usually takes about a minute.",
      });
      // Mark approved/scheduled so background pipeline will pick it up too
      await supabase
        .from("content_ideas")
        .update({ approval_status: "approved", status: "scheduled" })
        .eq("id", idea.id);
      refetchIdea();
    } catch (err: any) {
      toast({
        title: "Couldn't start rendering",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyCaption = async () => {
    if (!captionDraft) return;
    await navigator.clipboard.writeText(captionDraft);
    toast({ title: "Caption copied." });
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(captionDraft || idea?.title || "");
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener");
  };

  const handleDownload = async () => {
    if (!design?.image_url) return;
    try {
      const res = await fetch(design.image_url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(idea?.title || "post").slice(0, 40).replace(/\s+/g, "-")}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.open(design.image_url, "_blank", "noopener");
    }
  };

  const handleVote = async (vote: 1 | -1) => {
    if (!design?.id) return;
    setVoting(true);
    try {
      const { error: rpcErr } = await supabase.rpc("record_preset_feedback", {
        p_design_id: design.id,
        p_vote: vote,
      });
      if (rpcErr) throw rpcErr;
      await supabase.from("designs").update({ vote }).eq("id", design.id);
      queryClient.invalidateQueries({ queryKey: ["v2-daily-design"] });
      toast({
        title: vote === 1 ? "Trained: more like this." : "Trained: less like this.",
        description: "Brandie will favour this signal next week.",
      });
    } catch (err: any) {
      toast({ title: "Couldn't record", description: err.message, variant: "destructive" });
    } finally {
      setVoting(false);
    }
  };

  const handleMarkPosted = async () => {
    if (!idea) return;
    setMarking(true);
    try {
      const { error } = await supabase
        .from("content_ideas")
        .update({ status: "posted", approval_status: "approved" })
        .eq("id", idea.id);
      if (error) throw error;
      toast({ title: "Marked as posted. ✓" });
      refetchIdea();
    } catch (err: any) {
      toast({ title: "Couldn't mark", description: err.message, variant: "destructive" });
    } finally {
      setMarking(false);
    }
  };

  if (authLoading || brandLoading || ideaLoading) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth?next=/v2/cockpit" replace />;
  if (!brand || !brand.onboarding_complete) return <Navigate to="/v2/onboarding" replace />;
  if (!idea) {
    return (
      <div className="min-h-screen bg-background lg:pl-20 grid place-items-center px-6">
        <div className="text-center space-y-3 max-w-sm">
          <p className="text-muted-foreground">We couldn't find that post.</p>
          <Link to="/v2/blueprint" className="underline text-sm">
            Back to the Blueprint
          </Link>
        </div>
      </div>
    );
  }

  const isPosted = idea.status === "posted";

  return (
    <div className="min-h-screen bg-background lg:pl-20 pb-24">
      <SEO title="Today's post — Brandie" description="Execute the day." path={`/v2/post/${dayId}`} noindex />

      <main className="max-w-2xl mx-auto px-5 sm:px-8 pt-10 sm:pt-14 space-y-8">
        <header className="space-y-3">
          <Link
            to="/v2/blueprint"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Blueprint
          </Link>
          <div className="flex items-center gap-2 text-[11px] tracking-[0.22em] uppercase text-muted-foreground">
            <span>{dayLabel}</span>
            {catMeta && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${catMeta.dotClass}`} />
                  {catMeta.short}
                </span>
              </>
            )}
            {isPosted && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1 text-foreground">
                  <Check className="h-3 w-3" /> Posted
                </span>
              </>
            )}
          </div>
          <h1 className="font-serif text-3xl sm:text-5xl tracking-tight leading-[1.05]">
            {idea.title}
          </h1>
        </header>

        {/* DESIGN */}
        <section className="space-y-3">
          {design?.image_url ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl overflow-hidden border border-border bg-card"
            >
              <img
                src={design.image_url}
                alt={idea.title}
                className="w-full aspect-square object-cover"
              />
            </motion.div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card aspect-square grid place-items-center p-8 text-center">
              {generating ? (
                <div className="space-y-3 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                  <p className="text-sm">Rendering your post…</p>
                </div>
              ) : (
                <div className="space-y-4 max-w-xs">
                  <Sparkles className="h-5 w-5 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No render yet. Tap below and Brandie will draft this post now.
                  </p>
                  <Button onClick={handleGenerate} className="rounded-full" size="sm">
                    Generate now
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* TRAIN BRANDIE */}
          {design && (
            <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-2.5">
              <span className="text-xs tracking-wider uppercase text-muted-foreground">
                Train Brandie
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full h-8 px-3 gap-1.5"
                  onClick={() => handleVote(1)}
                  disabled={voting}
                >
                  <ThumbsUp className="h-3.5 w-3.5" /> More like this
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full h-8 px-3 gap-1.5 text-muted-foreground"
                  onClick={() => handleVote(-1)}
                  disabled={voting}
                >
                  <ThumbsDown className="h-3.5 w-3.5" /> Less
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* CAPTION */}
        <section className="space-y-3">
          <h2 className="text-xs tracking-[0.22em] uppercase text-muted-foreground">
            Caption
          </h2>
          <Textarea
            value={captionDraft}
            onChange={(e) => setCaptionDraft(e.target.value)}
            placeholder="Brandie will draft your caption here."
            className="min-h-[120px] text-[15px] leading-relaxed bg-card"
          />
          <p className="text-[11px] text-muted-foreground">
            Tweak in place — what you send is what you copy.
          </p>
        </section>

        {/* HANDOFF */}
        <section className="rounded-3xl border border-border bg-foreground text-background p-6 sm:p-8 space-y-5">
          <div className="space-y-1">
            <h3 className="font-serif text-2xl tracking-tight">Ship it.</h3>
            <p className="text-background/70 text-sm max-w-md">
              Hand the post to WhatsApp or save the image, then mark it posted so
              Brandie's report stays accurate.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-2.5">
            <Button
              onClick={handleWhatsApp}
              variant="secondary"
              size="lg"
              className="rounded-full h-12 gap-2"
            >
              <MessageCircle className="h-4 w-4" /> Send to WhatsApp
            </Button>
            <Button
              onClick={handleDownload}
              disabled={!design?.image_url}
              variant="secondary"
              size="lg"
              className="rounded-full h-12 gap-2"
            >
              <Download className="h-4 w-4" /> Download image
            </Button>
            <Button
              onClick={handleCopyCaption}
              disabled={!captionDraft}
              variant="ghost"
              size="lg"
              className="rounded-full h-12 gap-2 text-background hover:bg-background/10 hover:text-background"
            >
              <Copy className="h-4 w-4" /> Copy caption
            </Button>
            <Button
              onClick={handleMarkPosted}
              disabled={marking || isPosted}
              variant="ghost"
              size="lg"
              className="rounded-full h-12 gap-2 text-background hover:bg-background/10 hover:text-background"
            >
              {marking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {isPosted ? "Posted" : "Mark posted"}
            </Button>
          </div>
        </section>

        {/* BRIEF */}
        <section className="space-y-2">
          <h2 className="text-xs tracking-[0.22em] uppercase text-muted-foreground">
            The brief
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{idea.prompt}</p>
        </section>
      </main>
    </div>
  );
};

export default DailyPost;
