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
  // For auto-save
  user_id: string;
  brand_id: string;
  title: string;
  current_design_id?: string | null;
  selected_trend?: string;
  user_email?: string;
  // Full messages for chat persistence
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
  startGeneration: (params: GenerationParams) => void;
  clearResult: () => void;
  consumeResult: () => GenerationResult | null;
}

const DesignGenerationContext = createContext<DesignGenerationContextValue | null>(null);

export function DesignGenerationProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const consumedRef = useRef(false);

  const clearResult = useCallback(() => {
    setStatus("idle");
    setResult(null);
    setError(null);
    consumedRef.current = false;
  }, []);

  const consumeResult = useCallback(() => {
    if (result && !consumedRef.current) {
      consumedRef.current = true;
      return result;
    }
    return null;
  }, [result]);

  const startGeneration = useCallback((params: GenerationParams) => {
    if (status === "generating") return; // one at a time

    setStatus("generating");
    setResult(null);
    setError(null);
    consumedRef.current = false;

    // Build edge function body (strip our internal fields)
    const {
      user_id, brand_id, title, current_design_id, selected_trend,
      user_email, full_messages, ...edgeFnBody
    } = params;

    (async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke("design-studio", {
          body: edgeFnBody,
        });

        if (fnError) {
          const errMsg = fnError.message || "Generation failed";
          setError(errMsg);
          setStatus("error");
          return;
        }

        if (data?.error) {
          setError(data.error);
          setStatus("error");
          return;
        }

        // Auto-save the design
        let designId = current_design_id || null;
        const isEdit = params.action === "edit";

        if (data.image_url && user_id && brand_id) {
          try {
            const userMsg = full_messages[full_messages.length - 2]; // last user msg
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

              // Append new messages
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
                // Persist full chat history
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
              }
            }
          } catch (autoSaveErr) {
            console.error("Auto-save failed:", autoSaveErr);
          }
        }

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
        console.error("Generation error:", err);
        setError(err.message || "Something went wrong");
        setStatus("error");
      }
    })();
  }, [status]);

  return (
    <DesignGenerationContext.Provider value={{ status, result, error, startGeneration, clearResult, consumeResult }}>
      {children}
    </DesignGenerationContext.Provider>
  );
}

export function useDesignGeneration() {
  const ctx = useContext(DesignGenerationContext);
  if (!ctx) throw new Error("useDesignGeneration must be used within DesignGenerationProvider");
  return ctx;
}
