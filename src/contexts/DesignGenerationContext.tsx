import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export type GenerationStatus = "idle" | "generating" | "complete" | "error";

export interface GenerationResult {
  image_url: string;
  design_id: string | null;
  explanation: string;
  design_prompt: string;
  genome: any;
  caption: string | null;
  genome_scores: Record<string, number> | null;
  refined: boolean;
  free_edit: boolean;
}

export interface GenerationParams {
  action: "generate" | "edit";
  canvas_size: string;
  messages: { role: string; content: string }[];
  brand: any;
  audience_id?: string;
  trend?: string;
  trend_intensity?: number;
  user_image_url?: string;
  render_quality: "fast" | "hd";
  previous_prompt?: string;
  previous_image_url?: string;
  user_id: string;
  brand_id: string;
  title: string;
  current_design_id?: string | null;
  selected_trend?: string;
  user_email?: string;
  full_messages: Array<{
    role: string;
    content: string;
    imageUrl?: string;
    attachedImageUrl?: string;
  }>;
}

interface DesignGenerationContextValue {
  status: GenerationStatus;
  result: GenerationResult | null;
  error: string | null;
  progress: number;
  currentDesignId: string | null;
  startGeneration: (params: GenerationParams) => void;
  stopGeneration: () => void;
  clearResult: () => void;
  consumeResult: () => GenerationResult | null;
}

const DesignGenerationContext = createContext<DesignGenerationContextValue | null>(null);

const ESTIMATED_MS = 50000;
const TICK_MS = 300;

export function DesignGenerationProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentDesignId, setCurrentDesignId] = useState<string | null>(null);
  const consumedRef = useRef(false);
  const progressTimer = useRef<ReturnType<typeof setInterval>>();
  const abortRef = useRef<AbortController | null>(null);

  const stopProgressTimer = useCallback((final: number) => {
    if (progressTimer.current) clearInterval(progressTimer.current);
    setProgress(final);
  }, []);

  const startProgressTimer = useCallback(() => {
    setProgress(0);
    const startTime = Date.now();
    progressTimer.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const raw = (elapsed / ESTIMATED_MS) * 100;
      // Ease-out curve approaching 95%
      const eased = 95 * (1 - Math.exp(-2.5 * raw / 100));
      setProgress(Math.min(Math.round(eased), 95));
    }, TICK_MS);
  }, []);

  const stopGeneration = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    stopProgressTimer(0);
    setStatus("idle");
    setResult(null);
    setError(null);
    setProgress(0);
    setCurrentDesignId(null);
    consumedRef.current = false;
  }, [stopProgressTimer]);

  const clearResult = useCallback(() => {
    setStatus("idle");
    setResult(null);
    setError(null);
    setProgress(0);
    stopProgressTimer(0);
    consumedRef.current = false;
  }, [stopProgressTimer]);

  const consumeResult = useCallback(() => {
    if (result && !consumedRef.current) {
      consumedRef.current = true;
      return result;
    }
    return null;
  }, [result]);

  const startGeneration = useCallback((params: GenerationParams) => {
    if (status === "generating") return;

    const abortController = new AbortController();
    abortRef.current = abortController;

    setStatus("generating");
    setResult(null);
    setError(null);
    setCurrentDesignId(params.current_design_id || null);
    consumedRef.current = false;
    startProgressTimer();

    const {
      user_id, brand_id, title, current_design_id, selected_trend,
      user_email, full_messages, ...edgeFnBody
    } = params;

    (async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke("design-studio", {
          body: edgeFnBody,
        });

        if (abortController.signal.aborted) return;

        if (fnError) {
          setError(fnError.message || "Generation failed");
          setStatus("error");
          stopProgressTimer(0);
          return;
        }

        if (data?.error) {
          setError(data.error);
          setStatus("error");
          stopProgressTimer(0);
          return;
        }

        // Auto-save the design
        let designId = current_design_id || null;
        const isEdit = params.action === "edit";

        if (data.image_url && user_id && brand_id) {
          try {
            const userMsg = full_messages[full_messages.length - 2];
            const assistantMsg = {
              role: "assistant",
              content: (data.explanation || "Here's your design.") + (data.free_edit ? " (free edit — no credit used)" : ""),
              imageUrl: data.image_url,
            };

            if (isEdit && designId) {
              await supabase.from("designs").update({
                title: title.slice(0, 100) || "Untitled",
                prompt: data.design_prompt || title,
                image_url: data.image_url,
                canvas_size: params.canvas_size,
                ...(selected_trend && selected_trend !== "none" && { trend_used: selected_trend, trend_intensity: params.trend_intensity }),
                ...(data.genome && { genome: data.genome }),
                ...(data.caption && { caption: data.caption }),
              } as any).eq("id", designId);

              const newChatRows = [userMsg, assistantMsg].filter(Boolean).map((m: any) => ({
                design_id: designId!,
                user_id,
                role: m.role,
                content: m.content,
                image_url: m.imageUrl || null,
                attached_image_url: m.attachedImageUrl || null,
              }));
              await supabase.from("design_messages").insert(newChatRows);
            } else {
              const { data: designData, error: saveErr } = await supabase.from("designs").insert({
                user_id,
                brand_id,
                title: title.slice(0, 100) || "Untitled",
                prompt: data.design_prompt || title,
                image_url: data.image_url,
                canvas_size: params.canvas_size,
                vote: 0,
                ...(selected_trend && selected_trend !== "none" && { trend_used: selected_trend, trend_intensity: params.trend_intensity }),
                ...(data.genome && { genome: data.genome }),
                ...(data.caption && { caption: data.caption }),
              } as any).select("id").single();

              if (!saveErr && designData?.id) {
                designId = designData.id;
                const allMsgs = [...full_messages.slice(0, -1), {
                  role: "assistant",
                  content: assistantMsg.content,
                  imageUrl: data.image_url,
                }];
                const chatRows = allMsgs.map((m: any) => ({
                  design_id: designData.id,
                  user_id,
                  role: m.role,
                  content: m.content,
                  image_url: m.imageUrl || null,
                  attached_image_url: m.attachedImageUrl || null,
                }));
                await supabase.from("design_messages").insert(chatRows);

                // Process referral reward on first design (fire-and-forget, idempotent)
                try {
                  const { data: refResult } = await supabase.rpc("process_referral", { p_user_id: user_id });
                  const ref = refResult as any;
                  if (ref?.success && ref?.referrer_email) {
                    supabase.functions.invoke("send-email", {
                      body: { type: "referral_reward", to: ref.referrer_email, data: { credits: ref.credits_awarded || 5 } },
                    }).catch(() => {});
                  }
                } catch {}
              }
            }
          } catch (autoSaveErr) {
            console.error("Auto-save failed:", autoSaveErr);
          }
        }

        stopProgressTimer(100);
        setResult({
          image_url: data.image_url,
          design_id: designId,
          explanation: data.explanation || "Here's your design.",
          design_prompt: data.design_prompt || title,
          genome: data.genome || null,
          caption: data.caption || null,
          genome_scores: data.genome_scores || null,
          refined: data.refined === true,
          free_edit: data.free_edit === true,
        });
        setStatus("complete");
      } catch (err: any) {
        if (abortController.signal.aborted) return;
        console.error("Generation error:", err);
        setError(err.message || "Something went wrong");
        setStatus("error");
        stopProgressTimer(0);
      }
    })();
  }, [status, startProgressTimer, stopProgressTimer]);

  return (
    <DesignGenerationContext.Provider value={{ status, result, error, progress, startGeneration, stopGeneration, clearResult, consumeResult }}>
      {children}
    </DesignGenerationContext.Provider>
  );
}

export function useDesignGeneration() {
  const ctx = useContext(DesignGenerationContext);
  if (!ctx) throw new Error("useDesignGeneration must be used within DesignGenerationProvider");
  return ctx;
}
