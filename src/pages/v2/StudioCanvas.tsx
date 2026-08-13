// Structured Design pilot — the canvas editor.
//
// A design here is a document (Brandie Design Schema), not a flat image:
//   • Generate  — Creative Director writes the layout, art assets are rendered
//                 without text, the server composes the final PNG.
//   • Ask       — conversational edits patch only the elements mentioned.
//   • Edit      — direct manipulation (drag, resize, inspector) re-renders for free.
// Scoped to /studio/canvas; the Cockpit and Autopilot pipelines are untouched.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBrand } from "@/hooks/useBrand";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";
import NewAppHeader from "@/components/v2/NewAppHeader";
import NewFloatingNav from "@/components/v2/NewFloatingNav";
import DesignCanvas from "@/components/studio/DesignCanvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  Copy,
  Download,
  History,
  Layers,
  Loader2,
  RotateCcw,
  Sparkles,
  Trash2,
  Undo2,
  Wand2,
} from "lucide-react";
import {
  applyPatch,
  CANVAS_SIZES,
  type DesignSchema,
  type ButtonElement,
  type TextElement,
  normaliseSchema,
  overlapReport,
  sizeOf,
} from "@/lib/designSchema";

type Revision = {
  id: string;
  label: string | null;
  image_url: string | null;
  created_at: string;
  schema: unknown;
};

export default function StudioCanvas() {
  const { user } = useAuth();
  const { activeBrand } = useBrand();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();

  const [prompt, setPrompt] = useState("");
  const [canvasSize, setCanvasSize] = useState("1080x1080");
  const [useGallery, setUseGallery] = useState(true);
  const [schema, setSchema] = useState<DesignSchema | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [designId, setDesignId] = useState<string | null>(params.get("design") || null);
  const [caption, setCaption] = useState<string | null>(null);
  const [rationale, setRationale] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState<null | "generate" | "ask" | "render">(null);
  const [dirty, setDirty] = useState(false);
  const [history, setHistory] = useState<DesignSchema[]>([]);
  const [revisions, setRevisions] = useState<Revision[]>([]);

  const brandId = activeBrand?.id ?? null;
  const selected = useMemo(
    () => schema?.elements.find((e) => e.id === selectedId) || null,
    [schema, selectedId],
  );
  const warnings = useMemo(() => (schema ? overlapReport(schema) : []), [schema]);

  // Gallery images offered to the Creative Director as real, on-brand assets.
  const { data: gallery = [] } = useQuery({
    queryKey: ["studio-canvas-gallery", brandId],
    enabled: !!brandId,
    queryFn: async () => {
      const { data } = await supabase
        .from("brand_inspiration")
        .select("image_url, label, position")
        .eq("brand_id", brandId!)
        .order("position", { ascending: true, nullsFirst: false })
        .limit(6);
      return (data ?? []) as { image_url: string; label: string | null }[];
    },
  });

  const loadRevisions = useCallback(
    async (id: string) => {
      const { data, error } = await supabase.functions.invoke("design-structured", {
        body: { action: "revisions", design_id: id },
      });
      if (!error && data?.revisions) setRevisions(data.revisions as Revision[]);
    },
    [],
  );

  // Resume an existing structured design via ?design=<id>
  useEffect(() => {
    const id = params.get("design");
    if (!id || schema) return;
    (async () => {
      const { data } = await supabase
        .from("designs")
        .select("id, title, prompt, image_url, caption, canvas_size, design_schema")
        .eq("id", id)
        .maybeSingle();
      if (!data?.design_schema) return;
      setSchema(normaliseSchema(data.design_schema));
      setImageUrl(data.image_url);
      setDesignId(data.id);
      setCaption(data.caption);
      setPrompt(data.prompt || data.title || "");
      if (data.canvas_size) setCanvasSize(data.canvas_size);
      loadRevisions(data.id);
    })();
  }, [params, schema, loadRevisions]);

  const pushHistory = (s: DesignSchema) => setHistory((h) => [...h.slice(-19), s]);

  const applyLocal = (next: DesignSchema) => {
    if (schema) pushHistory(schema);
    setSchema(next);
    setDirty(true);
  };

  const failure = (message: string) => {
    toast({ title: "Design engine", description: message, variant: "destructive" });
  };

  const handleError = (error: unknown, data: unknown) => {
    const msg =
      (data as { error?: string })?.error ||
      (error as { message?: string })?.message ||
      "Something went wrong.";
    failure(msg);
  };

  const generate = async () => {
    if (!prompt.trim()) return failure("Describe the design you want first.");
    if (!brandId) return failure("Pick a brand before generating.");
    setBusy("generate");
    setSelectedId(null);
    try {
      const { data, error } = await supabase.functions.invoke("design-structured", {
        body: {
          action: "generate",
          prompt,
          canvas_size: canvasSize,
          brand: activeBrand,
          brand_id: brandId,
          gallery: useGallery ? gallery.map((g) => ({ url: g.image_url, label: g.label })) : [],
        },
      });
      if (error || data?.error) return handleError(error, data);
      setSchema(normaliseSchema(data.schema));
      setImageUrl(data.image_url);
      setDesignId(data.design_id);
      setCaption(data.caption ?? null);
      setRationale(data.rationale ?? null);
      setHistory([]);
      setDirty(false);
      if (data.design_id) {
        setParams((p) => {
          const next = new URLSearchParams(p);
          next.set("design", data.design_id);
          return next;
        });
        loadRevisions(data.design_id);
      }
      toast({ title: "Design ready", description: "2 credits used. Edits are free." });
    } finally {
      setBusy(null);
    }
  };

  const ask = async () => {
    if (!schema) return;
    if (!instruction.trim()) return;
    setBusy("ask");
    try {
      const { data, error } = await supabase.functions.invoke("design-structured", {
        body: {
          action: "edit",
          instruction,
          schema,
          design_id: designId,
          brand_id: brandId,
          canvas_size: canvasSize,
          title: prompt,
        },
      });
      if (error || data?.error) return handleError(error, data);
      pushHistory(schema);
      setSchema(normaliseSchema(data.schema));
      setImageUrl(data.image_url);
      setDesignId(data.design_id ?? designId);
      setInstruction("");
      setDirty(false);
      if (data.design_id) loadRevisions(data.design_id);
      toast({ title: "Updated", description: data.summary || "Applied your edit." });
    } finally {
      setBusy(null);
    }
  };

  const rerender = async () => {
    if (!schema) return;
    setBusy("render");
    try {
      const { data, error } = await supabase.functions.invoke("design-structured", {
        body: {
          action: "rerender",
          schema,
          design_id: designId,
          brand_id: brandId,
          canvas_size: canvasSize,
          title: prompt,
          label: "Manual edit",
        },
      });
      if (error || data?.error) return handleError(error, data);
      setSchema(normaliseSchema(data.schema));
      setImageUrl(data.image_url);
      setDesignId(data.design_id ?? designId);
      setDirty(false);
      if (data.design_id) loadRevisions(data.design_id);
      toast({ title: "Saved", description: "Re-rendered at full resolution — no credit used." });
    } finally {
      setBusy(null);
    }
  };

  const undo = () => {
    setHistory((h) => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      setSchema(prev);
      setDirty(true);
      return h.slice(0, -1);
    });
  };

  const moveElement = (id: string, box: { x: number; y: number; w: number; h: number }) => {
    if (!schema) return;
    applyLocal(applyPatch(schema, [{ op: "set", id, props: box }]));
  };

  const setProps = (props: Record<string, unknown>) => {
    if (!schema || !selectedId) return;
    applyLocal(applyPatch(schema, [{ op: "set", id: selectedId, props }]));
  };

  const elementAction = (op: "delete" | "duplicate") => {
    if (!schema || !selectedId) return;
    applyLocal(applyPatch(schema, [{ op, id: selectedId }]));
    if (op === "delete") setSelectedId(null);
  };

  const download = async () => {
    if (!imageUrl) return;
    const res = await fetch(imageUrl);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `brandie-${designId || "design"}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const restore = (rev: Revision) => {
    if (!rev.schema) return;
    if (schema) pushHistory(schema);
    setSchema(normaliseSchema(rev.schema));
    setImageUrl(rev.image_url);
    setDirty(true);
    toast({ title: "Revision loaded", description: "Save to re-render this version." });
  };

  const dims = sizeOf(canvasSize);

  return (
    <div className="min-h-screen bg-background pb-28 md:pl-20">
      <SEO
        title="Structured Design Canvas | Brandie"
        description="Generate editable, layered designs where every headline, logo and product shot stays yours to change."
      />
      <NewAppHeader />

      <main className="mx-auto max-w-7xl px-4 py-6 md:px-8">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex-1">
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Layers className="h-5 w-5 text-primary" />
              Design Canvas
            </h1>
            <p className="text-sm text-muted-foreground">
              Layered, editable designs. Change any element without regenerating the artwork.
            </p>
          </div>
          <Badge variant="secondary">Pilot</Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* ------------------------------------------------ canvas column */}
          <div className="space-y-4">
            <Card className="p-4">
              <Label htmlFor="bds-prompt" className="text-xs uppercase tracking-wide text-muted-foreground">
                What should this design say?
              </Label>
              <Textarea
                id="bds-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Announce our weekend restock — bold, high-contrast, product-led"
                rows={2}
                className="mt-2 resize-none"
              />
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Select value={canvasSize} onValueChange={setCanvasSize}>
                  <SelectTrigger className="w-[170px]">
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

                <div className="flex items-center gap-2">
                  <Switch id="use-gallery" checked={useGallery} onCheckedChange={setUseGallery} />
                  <Label htmlFor="use-gallery" className="text-sm text-muted-foreground">
                    Use gallery images ({gallery.length})
                  </Label>
                </div>

                <Button onClick={generate} disabled={busy !== null} className="ml-auto">
                  {busy === "generate" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Generate · 2 credits
                </Button>
              </div>
            </Card>

            <Card className="p-4">
              {schema ? (
                <>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {dims.w}×{dims.h}
                    </span>
                    {dirty && <Badge variant="outline">Unsaved edits</Badge>}
                    <div className="ml-auto flex gap-2">
                      <Button variant="ghost" size="sm" onClick={undo} disabled={!history.length}>
                        <Undo2 className="mr-1.5 h-4 w-4" />
                        Undo
                      </Button>
                      <Button variant="outline" size="sm" onClick={rerender} disabled={busy !== null || !dirty}>
                        {busy === "render" ? (
                          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                        ) : (
                          <RotateCcw className="mr-1.5 h-4 w-4" />
                        )}
                        Save &amp; re-render
                      </Button>
                      <Button variant="outline" size="sm" onClick={download} disabled={!imageUrl}>
                        <Download className="mr-1.5 h-4 w-4" />
                        PNG
                      </Button>
                    </div>
                  </div>

                  <DesignCanvas
                    schema={schema}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    onChange={moveElement}
                    showSafeArea
                  />

                  {warnings.length > 0 && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>Layout check: {warnings.join(", ")}.</span>
                    </div>
                  )}

                  {rationale && <p className="mt-3 text-sm text-muted-foreground">{rationale}</p>}

                  {caption && (
                    <div className="mt-3 rounded-lg border border-border p-3">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">Caption</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(caption);
                            toast({ title: "Caption copied" });
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <p className="text-sm">{caption}</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                  <Layers className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium">No design yet</p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Describe the post above. Brandie writes the copy, art-directs the layout, generates the
                    artwork without baked-in text, then hands you every layer to edit.
                  </p>
                </div>
              )}
            </Card>
          </div>

          {/* ------------------------------------------------- side column */}
          <div className="space-y-4">
            <Card className="p-4">
              <Label htmlFor="bds-ask" className="text-xs uppercase tracking-wide text-muted-foreground">
                Ask for a change
              </Label>
              <Textarea
                id="bds-ask"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="Make the headline bigger and move the CTA to the bottom"
                rows={3}
                className="mt-2 resize-none"
                disabled={!schema}
              />
              <Button
                className="mt-3 w-full"
                variant="secondary"
                onClick={ask}
                disabled={!schema || busy !== null || !instruction.trim()}
              >
                {busy === "ask" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="mr-2 h-4 w-4" />
                )}
                Apply edit · free
              </Button>
            </Card>

            <Card className="p-0">
              <Tabs defaultValue="inspector">
                <TabsList className="w-full rounded-b-none">
                  <TabsTrigger value="inspector" className="flex-1">
                    Inspector
                  </TabsTrigger>
                  <TabsTrigger value="layers" className="flex-1">
                    Layers
                  </TabsTrigger>
                  <TabsTrigger value="revisions" className="flex-1">
                    <History className="mr-1.5 h-3.5 w-3.5" />
                    History
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="inspector" className="m-0 space-y-4 p-4">
                  {!selected ? (
                    <p className="text-sm text-muted-foreground">
                      Select an element on the canvas to edit it directly.
                    </p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium capitalize">{selected.role}</p>
                          <p className="text-xs text-muted-foreground">{selected.id}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => elementAction("duplicate")}>
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => elementAction("delete")}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {(selected.type === "text" || selected.type === "button") && (
                        <div className="space-y-3">
                          <div>
                            <Label className="text-xs">Copy</Label>
                            <Textarea
                              value={(selected as TextElement | ButtonElement).content}
                              onChange={(e) => setProps({ content: e.target.value })}
                              rows={2}
                              className="mt-1 resize-none"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">
                              Font size · {(selected as TextElement).fontSize}px
                            </Label>
                            <Slider
                              className="mt-2"
                              min={12}
                              max={Math.round(dims.h * 0.3)}
                              step={2}
                              value={[(selected as TextElement).fontSize]}
                              onValueChange={([v]) => setProps({ fontSize: v })}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">Colour</Label>
                              <Input
                                type="color"
                                className="mt-1 h-9 p-1"
                                value={
                                  selected.type === "text"
                                    ? (selected as TextElement).color
                                    : (selected as ButtonElement).textColor
                                }
                                onChange={(e) =>
                                  setProps(
                                    selected.type === "text"
                                      ? { color: e.target.value }
                                      : { textColor: e.target.value },
                                  )
                                }
                              />
                            </div>
                            <div>
                              <Label className="text-xs">
                                {selected.type === "text" ? "Alignment" : "Button fill"}
                              </Label>
                              {selected.type === "text" ? (
                                <Select
                                  value={(selected as TextElement).align || "left"}
                                  onValueChange={(v) => setProps({ align: v })}
                                >
                                  <SelectTrigger className="mt-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="left">Left</SelectItem>
                                    <SelectItem value="center">Center</SelectItem>
                                    <SelectItem value="right">Right</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Input
                                  type="color"
                                  className="mt-1 h-9 p-1"
                                  value={(selected as ButtonElement).fill}
                                  onChange={(e) => setProps({ fill: e.target.value })}
                                />
                              )}
                            </div>
                          </div>
                          {selected.type === "text" && (
                            <div className="flex items-center justify-between">
                              <Label htmlFor="uppercase" className="text-xs">
                                Uppercase
                              </Label>
                              <Switch
                                id="uppercase"
                                checked={!!(selected as TextElement).uppercase}
                                onCheckedChange={(v) => setProps({ uppercase: v })}
                              />
                            </div>
                          )}
                        </div>
                      )}

                      <Separator />
                      <div className="grid grid-cols-2 gap-3">
                        {(["x", "y", "w", "h"] as const).map((k) => (
                          <div key={k}>
                            <Label className="text-xs uppercase">{k}</Label>
                            <Input
                              type="number"
                              className="mt-1"
                              value={Math.round(selected[k])}
                              onChange={(e) => setProps({ [k]: Number(e.target.value) })}
                            />
                          </div>
                        ))}
                      </div>
                      <div>
                        <Label className="text-xs">Opacity</Label>
                        <Slider
                          className="mt-2"
                          min={0}
                          max={1}
                          step={0.05}
                          value={[selected.opacity ?? 1]}
                          onValueChange={([v]) => setProps({ opacity: v })}
                        />
                      </div>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="layers" className="m-0 p-4">
                  {schema?.elements.length ? (
                    <ul className="space-y-1">
                      {[...schema.elements].reverse().map((el) => (
                        <li key={el.id}>
                          <button
                            onClick={() => setSelectedId(el.id)}
                            className={`flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted ${
                              selectedId === el.id ? "bg-muted" : ""
                            }`}
                          >
                            <span className="truncate capitalize">{el.role}</span>
                            <span className="ml-2 shrink-0 text-xs text-muted-foreground">{el.type}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No layers yet.</p>
                  )}
                </TabsContent>

                <TabsContent value="revisions" className="m-0 p-4">
                  {revisions.length ? (
                    <ul className="space-y-2">
                      {revisions.map((rev) => (
                        <li key={rev.id} className="flex items-center gap-3">
                          {rev.image_url && (
                            <img
                              src={rev.image_url}
                              alt={rev.label || "Revision"}
                              className="h-12 w-12 rounded-md border border-border object-cover"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm">{rev.label || "Revision"}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(rev.created_at).toLocaleString()}
                            </p>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => restore(rev)}>
                            Restore
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Every generation and edit is versioned here.
                    </p>
                  )}
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        </div>
      </main>

      <NewFloatingNav />
    </div>
  );
}
