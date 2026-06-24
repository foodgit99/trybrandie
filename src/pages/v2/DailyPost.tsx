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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  RefreshCw,
  Info,
  Loader2,
  MessageCircle,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import SEO from "@/components/SEO";
import NewAppHeader from "@/components/v2/NewAppHeader";
import GenerationLoader from "@/components/GenerationLoader";
import { useDesignGeneration } from "@/contexts/DesignGenerationContext";
import { getCategoryMeta, parseCategoryIds } from "@/lib/contentCategories";
import { Carousel, CarouselApi, CarouselContent, CarouselItem } from "@/components/ui/carousel";

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
  content_format: string | null;
  slide_count: number | null;
};

type Design = {
  id: string;
  image_url: string;
  caption: string | null;
  title: string | null;
  genome: any | null;
  carousel_id?: string | null;
  slide_index?: number | null;
};

const DailyPost = () => {
  const { dayId } = useParams<{ dayId: string }>();
  const { user, loading: authLoading } = useAuth();
  const { brand, isLoading: brandLoading } = useBrand(user);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const generation = useDesignGeneration();
  const [voting, setVoting] = useState(false);
  const [marking, setMarking] = useState(false);
  const [captionDraft, setCaptionDraft] = useState("");
  const [briefDraft, setBriefDraft] = useState("");
  const [briefSaving, setBriefSaving] = useState(false);
  const [briefSavedAt, setBriefSavedAt] = useState<number | null>(null);
  const linkedJobRef = useState<{ current: string | null }>({ current: null })[0];
  const generating = generation.status === "generating";

  const { data: idea, isLoading: ideaLoading, refetch: refetchIdea } = useQuery({
    queryKey: ["v2-daily-idea", dayId],
    queryFn: async (): Promise<Idea | null> => {
      if (!dayId) return null;
      const { data, error } = await supabase
        .from("content_ideas")
        .select(
          "id, title, prompt, content_category, scheduled_for, status, approval_status, design_id, whatsapp_dm, brand_id, content_format, slide_count",
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
        .select("id, image_url, caption, title, genome, carousel_id, slide_index")
        .eq("id", idea.design_id)
        .maybeSingle();
      if (error) throw error;
      return data as Design | null;
    },
    enabled: !!idea?.design_id,
  });

  // If this design is part of a carousel, fetch all sibling slides ordered.
  const { data: slides } = useQuery({
    queryKey: ["v2-daily-slides", design?.carousel_id, design?.id],
    queryFn: async (): Promise<Design[]> => {
      if (!design) return [];
      if (!design.carousel_id) return [design];
      const { data, error } = await supabase
        .from("designs")
        .select("id, image_url, caption, title, genome, carousel_id, slide_index")
        .eq("carousel_id", design.carousel_id)
        .order("slide_index", { ascending: true });
      if (error) throw error;
      const rows = (data as Design[] | null) ?? [];
      return rows.length > 0 ? rows : [design];
    },
    enabled: !!design,
  });

  const allSlides = slides ?? (design ? [design] : []);
  const isCarousel = allSlides.length > 1;
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  useEffect(() => {
    if (!carouselApi) return;
    const onSelect = () => setActiveIdx(carouselApi.selectedScrollSnap());
    onSelect();
    carouselApi.on("select", onSelect);
    carouselApi.on("reInit", onSelect);
    return () => {
      carouselApi.off("select", onSelect);
      carouselApi.off("reInit", onSelect);
    };
  }, [carouselApi]);
  const activeSlide = allSlides[activeIdx] ?? design ?? null;

  // Seed caption draft from design caption, any sibling slide caption, or whatsapp_dm
  useEffect(() => {
    const siblingCaption = (slides ?? []).find((s) => s.caption)?.caption ?? null;
    const initial = design?.caption ?? siblingCaption ?? idea?.whatsapp_dm ?? "";
    if (initial && !captionDraft) setCaptionDraft(initial);
  }, [design?.caption, slides, idea?.whatsapp_dm]); // eslint-disable-line

  // Seed brief draft from idea prompt
  useEffect(() => {
    if (idea?.prompt != null) setBriefDraft(idea.prompt);
  }, [idea?.id]); // eslint-disable-line

  const saveBrief = async () => {
    if (!idea) return;
    const next = briefDraft.trim();
    if (next === (idea.prompt ?? "").trim()) return;
    setBriefSaving(true);
    try {
      const { error } = await supabase
        .from("content_ideas")
        .update({ prompt: next })
        .eq("id", idea.id);
      if (error) throw error;
      setBriefSavedAt(Date.now());
      refetchIdea();
    } catch (err: any) {
      toast({ title: "Couldn't save brief", description: err.message, variant: "destructive" });
    } finally {
      setBriefSaving(false);
    }
  };

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

  // Detect carousel intent robustly: explicit content_format, slide_count >= 2,
  // or natural-language clues in the title/prompt ("N-slide", "carousel").
  const detectCarouselIntent = (i: Idea | null | undefined): { isCarousel: boolean; slides: number } => {
    if (!i) return { isCarousel: false, slides: 1 };
    const blob = `${i.title || ""} ${i.prompt || ""}`.toLowerCase();
    const nSlideMatch = blob.match(/(\d+)\s*[-\s]*slide/);
    const inferredSlides = nSlideMatch ? Math.min(10, Math.max(2, parseInt(nSlideMatch[1], 10))) : null;
    const mentionsCarousel = /carousel/.test(blob);
    const declared = i.content_format === "carousel";
    const fromCount = (i.slide_count ?? 0) >= 2;
    const isCarousel = declared || fromCount || mentionsCarousel || !!inferredSlides;
    if (!isCarousel) return { isCarousel: false, slides: 1 };
    const slides = Math.min(10, Math.max(2, i.slide_count || inferredSlides || 5));
    return { isCarousel: true, slides };
  };

  const handleGenerate = (forceCarousel = false) => {
    if (!idea || !brand || !user) return;
    const msg = { role: "user", content: idea.prompt || idea.title };
    const detected = detectCarouselIntent(idea);
    const isCarouselGen = forceCarousel || detected.isCarousel;
    const slides = isCarouselGen ? detected.slides : undefined;
    generation.startGeneration({
      action: isCarouselGen ? "generate_carousel" : "generate",
      canvas_size: "1080x1080",
      ...(isCarouselGen ? { slide_count: slides } : {}),
      messages: [msg],
      full_messages: [msg],
      brand,
      user_id: user.id,
      brand_id: brand.id,
      title: idea.title,
      content_idea_id: idea.id,
      user_email: user.email || undefined,
    });
    toast({
      title: "On it.",
      description: isCarouselGen
        ? `Brandie is rendering ${slides} carousel slides. This takes a couple of minutes.`
        : "Brandie is rendering your post. It usually takes about a minute.",
    });
  };

  // When the shared generation pipeline finishes, link the new design back to
  // this content idea (same write the worker used to do for the bespoke /post flow).
  useEffect(() => {
    if (generation.status !== "complete" || !idea) return;
    const result = generation.result;
    if (!result?.design_id) return;
    if (linkedJobRef.current === result.design_id) return;
    linkedJobRef.current = result.design_id;
    (async () => {
      try {
        await supabase
          .from("content_ideas")
          .update({
            design_id: result.design_id,
            status: "scheduled",
            approval_status: "approved",
          })
          .eq("id", idea.id);
        await refetchIdea();
      } finally {
        generation.clearResult();
      }
    })();
  }, [generation.status, generation.result, idea?.id]); // eslint-disable-line

  // Surface generation errors to the user.
  useEffect(() => {
    if (generation.status === "error" && generation.error) {
      toast({
        title: "Render failed",
        description: generation.error,
        variant: "destructive",
      });
      generation.clearResult();
    }
  }, [generation.status, generation.error]); // eslint-disable-line




  const handleCopyCaption = async () => {
    if (!captionDraft) return;
    await navigator.clipboard.writeText(captionDraft);
    toast({ title: "Caption copied." });
  };

  const handleWhatsApp = async () => {
    const caption = captionDraft || idea?.title || "";
    const slidesToShare = isCarousel
      ? allSlides.filter((s) => s?.image_url)
      : activeSlide?.image_url
      ? [activeSlide]
      : [];

    // Try native share with image(s) + caption, opens the OS share sheet
    // (WhatsApp shows up there on iOS/Android) so the post and the caption
    // travel together in a single share.
    if (slidesToShare.length > 0 && typeof navigator !== "undefined" && (navigator as any).canShare) {
      try {
        const files: File[] = [];
        for (let i = 0; i < slidesToShare.length; i++) {
          const s = slidesToShare[i];
          const res = await fetch(s.image_url);
          const blob = await res.blob();
          files.push(
            new File([blob], `${baseName}${isCarousel ? `-slide-${i + 1}` : ""}.png`, {
              type: blob.type || "image/png",
            }),
          );
        }
        const sharePayload: ShareData = { text: caption, files };
        if ((navigator as any).canShare(sharePayload)) {
          await (navigator as any).share(sharePayload);
          // Caption is shared along with the image, also drop it on the
          // clipboard so the user can paste it again if needed.
          try {
            await navigator.clipboard.writeText(caption);
          } catch {
            /* clipboard optional */
          }
          return;
        }
      } catch (err: any) {
        if (err?.name === "AbortError") return; // user cancelled
        // fall through to wa.me fallback
      }
    }

    // Fallback: copy caption + open WhatsApp with the caption prefilled.
    // (wa.me cannot attach images; user pastes the downloaded image.)
    try {
      if (caption) await navigator.clipboard.writeText(caption);
    } catch {
      /* clipboard optional */
    }
    if (slidesToShare[0]?.image_url) {
      await downloadOne(
        slidesToShare[0].image_url,
        `${baseName}${isCarousel ? "-slide-1" : ""}.png`,
      );
    }
    toast({
      title: "Caption copied",
      description: "Image saved. Attach it in WhatsApp and paste the caption.",
    });
    window.open(
      `https://wa.me/?text=${encodeURIComponent(caption)}`,
      "_blank",
      "noopener",
    );
  };


  const downloadOne = async (url: string, filename: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
    } catch {
      window.open(url, "_blank", "noopener");
    }
  };

  const baseName = (idea?.title || "post").slice(0, 40).replace(/\s+/g, "-");

  const handleDownload = async () => {
    if (!activeSlide?.image_url) return;
    const suffix = isCarousel ? `-slide-${activeIdx + 1}` : "";
    await downloadOne(activeSlide.image_url, `${baseName}${suffix}.png`);
  };

  const handleDownloadAll = async () => {
    for (let i = 0; i < allSlides.length; i++) {
      const s = allSlides[i];
      if (!s?.image_url) continue;
      // Small delay so browsers don't block consecutive downloads.
      // eslint-disable-next-line no-await-in-loop
      await downloadOne(s.image_url, `${baseName}-slide-${i + 1}.png`);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 250));
    }
  };

  const handleVote = async (vote: 1 | -1) => {
    if (!activeSlide?.id) return;
    setVoting(true);
    try {
      const { error: rpcErr } = await supabase.rpc("record_preset_feedback", {
        p_design_id: activeSlide.id,
        p_vote: vote,
      });
      if (rpcErr) throw rpcErr;
      await supabase.from("designs").update({ vote }).eq("id", activeSlide.id);
      queryClient.invalidateQueries({ queryKey: ["v2-daily-design"] });
      queryClient.invalidateQueries({ queryKey: ["v2-daily-slides"] });
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
      <div className="min-h-dvh grid place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth?next=/cockpit" replace />;
  if (!brand || !brand.onboarding_complete) return <Navigate to="/onboarding" replace />;
  if (!idea) {
    return (
      <div className="min-h-dvh bg-background lg:pl-20 grid place-items-center px-6">
        <div className="text-center space-y-3 max-w-sm">
          <p className="text-muted-foreground">We couldn't find that post.</p>
          <Link to="/blueprint" className="underline text-sm">
            Back to the Blueprint
          </Link>
        </div>
      </div>
    );
  }

  const isPosted = idea.status === "posted";

  return (
    <div className="min-h-dvh bg-background lg:pl-20 pb-24">
      <SEO title="Today's post, Brandie" description="Execute the day." path={`/post/${dayId}`} noindex />
      <NewAppHeader />


      <main className="max-w-2xl mx-auto px-5 sm:px-8 pt-10 sm:pt-14 space-y-8">
        <header className="space-y-3">
          <Link
            to="/blueprint"
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
              className="relative"
            >
              {isCarousel ? (
                <>
                  <Carousel
                    setApi={setCarouselApi}
                    opts={{ loop: false, align: "start" }}
                    className="rounded-2xl overflow-hidden border border-border bg-card"
                  >
                    <CarouselContent className="ml-0">
                      {allSlides.map((s, i) => (
                        <CarouselItem key={s.id} className="pl-0 basis-full">
                          <img
                            src={s.image_url}
                            alt={`${idea.title}, slide ${i + 1}`}
                            className="w-full aspect-square object-cover"
                          />
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                  </Carousel>

                  {/* Counter pill */}
                  <div className="absolute top-3 right-3 rounded-full bg-foreground/80 text-background text-[11px] tracking-wider px-2.5 py-1 backdrop-blur">
                    {activeIdx + 1} / {allSlides.length}
                  </div>

                  {/* Nav buttons */}
                  <button
                    type="button"
                    onClick={() => carouselApi?.scrollPrev()}
                    disabled={activeIdx === 0}
                    aria-label="Previous slide"
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-background/85 border border-border grid place-items-center backdrop-blur disabled:opacity-40 disabled:cursor-not-allowed hover:bg-background"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => carouselApi?.scrollNext()}
                    disabled={activeIdx >= allSlides.length - 1}
                    aria-label="Next slide"
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-background/85 border border-border grid place-items-center backdrop-blur disabled:opacity-40 disabled:cursor-not-allowed hover:bg-background"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>

                  {/* Dots */}
                  <div className="mt-3 flex items-center justify-center gap-1.5">
                    {allSlides.map((s, i) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => carouselApi?.scrollTo(i)}
                        aria-label={`Go to slide ${i + 1}`}
                        className={`h-1.5 rounded-full transition-all ${
                          i === activeIdx
                            ? "w-6 bg-foreground"
                            : "w-1.5 bg-muted-foreground/40 hover:bg-muted-foreground/70"
                        }`}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="rounded-2xl overflow-hidden border border-border bg-card">
                  <img
                    src={design.image_url}
                    alt={idea.title}
                    className="w-full aspect-square object-cover"
                  />
                </div>
              )}
            </motion.div>
          ) : generating ? (
            <GenerationLoader />
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card aspect-square grid place-items-center p-8 text-center">
              <div className="space-y-4 max-w-xs">
                <Sparkles className="h-5 w-5 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No render yet. Tap below and Brandie will draft this post now.
                </p>
                <Button onClick={() => handleGenerate()} className="rounded-full" size="sm">
                  Generate now
                </Button>
              </div>
            </div>
          )}

          {/* Regenerate */}
          {design && !generating && (
            <div className="flex items-center justify-end">
              <Button
                onClick={() => handleGenerate(detectCarouselIntent(idea).isCarousel)}
                variant="outline"
                size="sm"
                className="rounded-full gap-2"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Regenerate
              </Button>
            </div>
          )}



          {/* Recovery: idea is a carousel but the rendered design is a single image. */}
          {design && !isCarousel && detectCarouselIntent(idea).isCarousel && !generating && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 px-4 py-3 flex items-center justify-between gap-3">
              <p className="text-xs text-foreground/80">
                This post was meant to be a {detectCarouselIntent(idea).slides}-slide carousel, but a single image was generated.
              </p>
              <Button
                onClick={() => handleGenerate(true)}
                variant="outline"
                size="sm"
                className="rounded-full shrink-0"
              >
                Regenerate as carousel
              </Button>
            </div>
          )}

          {/* TRAIN BRANDIE */}
          {design && (
            <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs tracking-wider uppercase text-muted-foreground">
                  {isCarousel ? `Train Brandie · slide ${activeIdx + 1}` : "Train Brandie"}
                </span>
                {activeSlide?.genome && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Why this design?"
                      >
                        <Info className="h-3.5 w-3.5" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-72 text-xs space-y-2">
                      <p className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground">
                        Why this design
                      </p>
                      <GenomeSummary genome={activeSlide.genome} />
                    </PopoverContent>
                  </Popover>
                )}
              </div>
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

        {/* BRIEF, hidden after design is generated */}
        {!design?.image_url && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs tracking-[0.22em] uppercase text-muted-foreground">
                The brief
              </h2>
              <span className="text-[11px] text-muted-foreground">
                {briefSaving ? "Saving…" : briefSavedAt ? "Saved" : "Edits save on blur"}
              </span>
            </div>
            <Textarea
              value={briefDraft}
              onChange={(e) => setBriefDraft(e.target.value)}
              onBlur={saveBrief}
              placeholder="What should this post say or do?"
              className="min-h-[120px] text-[15px] leading-relaxed bg-card"
            />
            <p className="text-[11px] text-muted-foreground">
              Edit the brief now, then generate or save it, the autonomous engine will render it when scheduled.
            </p>
          </section>
        )}


        {/* CAPTION, only after a render exists */}
        {design?.image_url && (
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
              Tweak in place, what you send is what you copy.
            </p>
          </section>
        )}

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
              disabled={!activeSlide?.image_url}
              variant="secondary"
              size="lg"
              className="rounded-full h-12 gap-2"
            >
              <Download className="h-4 w-4" />
              {isCarousel ? `Download slide ${activeIdx + 1}` : "Download image"}
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
          {isCarousel && (
            <button
              type="button"
              onClick={handleDownloadAll}
              className="text-xs text-background/70 hover:text-background underline underline-offset-4"
            >
              Download all {allSlides.length} slides
            </button>
          )}
        </section>

      </main>
    </div>
  );
};

export default DailyPost;

function prettifyToken(v: any): string {
  if (v == null) return "";
  return String(v).replace(/[_-]/g, " ");
}

function GenomeSummary({ genome }: { genome: any }) {
  const rows: Array<{ label: string; value: string }> = [];
  const preset = genome?.preset_id ? prettifyToken(genome.preset_id) : null;
  const emotion = genome?.emotion ? prettifyToken(genome.emotion) : null;
  if (genome?.color) {
    const c = genome.color;
    const parts = [c.contrast && `${prettifyToken(c.contrast)} contrast`, c.saturation && `${prettifyToken(c.saturation)} saturation`, c.temperature && prettifyToken(c.temperature)].filter(Boolean);
    if (parts.length) rows.push({ label: "Colour", value: parts.join(" · ") });
  }
  if (genome?.typography) {
    const t = genome.typography;
    const parts = [t.font_personality && prettifyToken(t.font_personality), t.weight_system && prettifyToken(t.weight_system)].filter(Boolean);
    if (parts.length) rows.push({ label: "Type", value: parts.join(" · ") });
  }
  if (genome?.layout) {
    const l = genome.layout;
    const parts = [l.grid_type && prettifyToken(l.grid_type), l.spacing_density && `${prettifyToken(l.spacing_density)} spacing`, l.balance && prettifyToken(l.balance)].filter(Boolean);
    if (parts.length) rows.push({ label: "Layout", value: parts.join(" · ") });
  }
  if (genome?.texture?.texture_type && genome.texture.texture_type !== "none") {
    rows.push({ label: "Texture", value: `${prettifyToken(genome.texture.texture_type)}${genome.texture.intensity ? ` · ${prettifyToken(genome.texture.intensity)}` : ""}` });
  }
  if (genome?.image_style) {
    const i = genome.image_style;
    const parts = [i.lighting && `${prettifyToken(i.lighting)} light`, i.color_grading && prettifyToken(i.color_grading)].filter(Boolean);
    if (parts.length) rows.push({ label: "Imagery", value: parts.join(" · ") });
  }
  return (
    <div className="space-y-2">
      {(preset || emotion) && (
        <p className="text-foreground">
          {preset && <span className="capitalize">{preset}</span>}
          {preset && emotion && <span className="text-muted-foreground"> · </span>}
          {emotion && <span className="text-muted-foreground capitalize">{emotion}</span>}
        </p>
      )}
      {rows.length === 0 ? (
        <p className="text-muted-foreground">No genome metadata for this render.</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((r) => (
            <li key={r.label} className="flex gap-2">
              <span className="text-muted-foreground w-16 shrink-0 capitalize">{r.label}</span>
              <span className="capitalize">{r.value}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="pt-1 text-[10px] text-muted-foreground">
        Brandie picks these genes from your brand vibe, the week's trend, and how you've voted before.
      </p>
    </div>
  );
}
