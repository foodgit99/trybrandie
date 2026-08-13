// Interactive preview of a Brandie Design Schema document.
//
// Renders the schema with DOM/CSS at a scaled size so the user can select,
// drag and resize elements. The server renderer (schema -> SVG -> PNG) stays
// the source of truth for the exported pixels, so treat this as a faithful
// working preview rather than the final artwork.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  type ButtonElement,
  type DesignElement,
  type DesignSchema,
  type ImageElement,
  fontStack,
  resolveAsset,
  type ShapeElement,
  type TextElement,
} from "@/lib/designSchema";
import { cn } from "@/lib/utils";

const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=DM+Serif+Display&family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap";

function useDesignFonts() {
  useEffect(() => {
    if (document.querySelector(`link[data-bds-fonts]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = FONT_HREF;
    link.setAttribute("data-bds-fonts", "true");
    document.head.appendChild(link);
  }, []);
}

interface DesignCanvasProps {
  schema: DesignSchema;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  /** Committed move/resize — fires once on pointer release. */
  onChange?: (id: string, props: { x: number; y: number; w: number; h: number }) => void;
  interactive?: boolean;
  className?: string;
  showSafeArea?: boolean;
}

type Drag = {
  id: string;
  mode: "move" | "resize";
  startX: number;
  startY: number;
  box: { x: number; y: number; w: number; h: number };
};

export default function DesignCanvas({
  schema,
  selectedId,
  onSelect,
  onChange,
  interactive = true,
  className,
  showSafeArea = false,
}: DesignCanvasProps) {
  useDesignFonts();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [ghost, setGhost] = useState<{ id: string; x: number; y: number; w: number; h: number } | null>(null);

  const { width, height } = schema.canvas;

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setScale(Math.max(0.05, el.clientWidth / width));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  const beginDrag = useCallback(
    (e: React.PointerEvent, el: DesignElement, mode: "move" | "resize") => {
      if (!interactive || el.locked) return;
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      onSelect?.(el.id);
      setDrag({
        id: el.id,
        mode,
        startX: e.clientX,
        startY: e.clientY,
        box: { x: el.x, y: el.y, w: el.w, h: el.h },
      });
      setGhost({ id: el.id, x: el.x, y: el.y, w: el.w, h: el.h });
    },
    [interactive, onSelect],
  );

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const dx = (e.clientX - drag.startX) / scale;
      const dy = (e.clientY - drag.startY) / scale;
      if (drag.mode === "move") {
        setGhost({
          id: drag.id,
          x: Math.round(drag.box.x + dx),
          y: Math.round(drag.box.y + dy),
          w: drag.box.w,
          h: drag.box.h,
        });
      } else {
        setGhost({
          id: drag.id,
          x: drag.box.x,
          y: drag.box.y,
          w: Math.max(16, Math.round(drag.box.w + dx)),
          h: Math.max(16, Math.round(drag.box.h + dy)),
        });
      }
    };
    const up = () => {
      setGhost((g) => {
        if (g) onChange?.(g.id, { x: g.x, y: g.y, w: g.w, h: g.h });
        return null;
      });
      setDrag(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [drag, scale, onChange]);

  const bg = schema.background;
  const bgUrl = bg.type === "image" ? resolveAsset(schema, bg.source) : null;
  const backgroundStyle: React.CSSProperties =
    bg.type === "gradient"
      ? { backgroundImage: `linear-gradient(${bg.angle ?? 180}deg, ${bg.color}, ${bg.color2})` }
      : bg.type === "image" && bgUrl
        ? { backgroundImage: `url(${bgUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
        : { backgroundColor: bg.color || "#FFFFFF" };

  const margin = Math.round(width * 0.07);

  return (
    <div ref={wrapRef} className={cn("w-full select-none", className)}>
      <div
        className="relative overflow-hidden rounded-xl border border-border shadow-raised"
        style={{ width: width * scale, height: height * scale, ...backgroundStyle }}
        onPointerDown={() => interactive && onSelect?.(null)}
      >
        {bg.overlay && (
          <div
            className="absolute inset-0"
            style={{ backgroundColor: bg.overlay.color, opacity: bg.overlay.opacity }}
          />
        )}

        {showSafeArea && (
          <div
            className="pointer-events-none absolute border border-dashed border-primary/40"
            style={{
              left: margin * scale,
              top: margin * scale,
              width: (width - margin * 2) * scale,
              height: (height - margin * 2) * scale,
            }}
          />
        )}

        {schema.elements.map((el) => {
          const live = ghost && ghost.id === el.id ? ghost : el;
          const selected = selectedId === el.id;
          const style: React.CSSProperties = {
            position: "absolute",
            left: live.x * scale,
            top: live.y * scale,
            width: live.w * scale,
            height: live.h * scale,
            opacity: el.opacity ?? 1,
            transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
            zIndex: el.z ?? 1,
            cursor: interactive && !el.locked ? "move" : "default",
          };

          return (
            <div
              key={el.id}
              style={style}
              onPointerDown={(e) => beginDrag(e, el, "move")}
              className={cn(selected && "outline outline-2 outline-primary")}
            >
              <ElementBody el={el} schema={schema} scale={scale} />
              {selected && interactive && !el.locked && (
                <span
                  role="presentation"
                  onPointerDown={(e) => beginDrag(e, el, "resize")}
                  className="absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-nwse-resize rounded-sm border border-background bg-primary"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ElementBody({
  el,
  schema,
  scale,
}: {
  el: DesignElement;
  schema: DesignSchema;
  scale: number;
}) {
  if (el.type === "text") {
    const t = el as TextElement;
    const family = fontStack(t.font === "body" ? schema.fonts?.body : schema.fonts?.heading);
    return (
      <div
        className="flex h-full w-full overflow-hidden"
        style={{
          alignItems: "flex-start",
          justifyContent:
            t.align === "center" ? "center" : t.align === "right" ? "flex-end" : "flex-start",
        }}
      >
        <span
          style={{
            fontFamily: family,
            fontSize: t.fontSize * scale,
            fontWeight: t.weight ?? 700,
            color: t.color,
            lineHeight: t.lineHeight ?? 1.15,
            letterSpacing: (t.letterSpacing ?? 0) * scale,
            textAlign: t.align ?? "left",
            textTransform: t.uppercase ? "uppercase" : undefined,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {t.content}
        </span>
      </div>
    );
  }

  if (el.type === "image" || el.type === "logo") {
    const im = el as ImageElement;
    const url = resolveAsset(schema, im.source);
    if (!url) {
      return (
        <div className="flex h-full w-full items-center justify-center rounded bg-muted text-[10px] text-muted-foreground">
          {im.source}
        </div>
      );
    }
    return (
      <img
        src={url}
        alt={im.role}
        draggable={false}
        className="h-full w-full"
        style={{ objectFit: im.fit === "contain" ? "contain" : "cover", borderRadius: (im.radius ?? 0) * scale }}
      />
    );
  }

  if (el.type === "shape") {
    const s = el as ShapeElement;
    return (
      <div
        className="h-full w-full"
        style={{
          backgroundColor: s.fill === "none" ? "transparent" : s.fill,
          borderRadius: s.shape === "ellipse" ? "50%" : (s.radius ?? 0) * scale,
          border:
            s.stroke && s.stroke !== "none"
              ? `${Math.max(1, (s.strokeWidth ?? 1) * scale)}px solid ${s.stroke}`
              : undefined,
        }}
      />
    );
  }

  const b = el as ButtonElement;
  return (
    <div
      className="flex h-full w-full items-center justify-center overflow-hidden text-center"
      style={{
        backgroundColor: b.fill,
        borderRadius: Math.min((b.radius ?? 999) * scale, (b.h * scale) / 2),
      }}
    >
      <span
        style={{
          fontFamily: fontStack(schema.fonts?.body),
          fontSize: b.fontSize * scale,
          fontWeight: b.weight ?? 700,
          color: b.textColor,
        }}
      >
        {b.content}
      </span>
    </div>
  );
}
