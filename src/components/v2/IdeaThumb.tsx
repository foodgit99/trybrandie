import { cn } from "@/lib/utils";

export type IdeaDesign = {
  image_url?: string | null;
  caption?: string | null;
} | null | undefined;

interface IdeaThumbProps {
  design: IdeaDesign;
  emoji?: string;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Small square thumbnail of an idea's generated design, with an emoji
 * fallback when the idea hasn't been rendered yet. Used across v2 idea lists
 * (Hub, Content Hub, Blueprint, Cockpit).
 */
const IdeaThumb = ({ design, emoji, size = "sm", className }: IdeaThumbProps) => {
  const dim = size === "md" ? "h-12 w-12" : "h-10 w-10";
  const url = design?.image_url ?? undefined;

  if (url) {
    return (
      <img
        src={url}
        alt=""
        loading="lazy"
        className={cn(
          dim,
          "rounded-lg object-cover border border-border bg-muted shrink-0",
          className,
        )}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        dim,
        "rounded-lg border border-dashed border-border bg-secondary/40 grid place-items-center text-base shrink-0",
        className,
      )}
    >
      {emoji ?? "•"}
    </span>
  );
};

export default IdeaThumb;
