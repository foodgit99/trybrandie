// "Use product images" selector — lets the user decide exactly which product
// photos Brandie may reference for a graphic (or turn product photos off).
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, ImageIcon, ImageOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type ProductImageMode = "auto" | "selected" | "off";

export interface ProductImageSelection {
  mode: ProductImageMode;
  productIds: string[];
}

export const defaultProductImageSelection: ProductImageSelection = {
  mode: "auto",
  productIds: [],
};

/** Build the request fields for the design pipeline from a selection. */
export function productImagePayload(sel: ProductImageSelection) {
  if (sel.mode === "auto") return {};
  if (sel.mode === "off") return { product_image_mode: "off" as const };
  if (sel.productIds.length === 0) return {};
  return { product_image_mode: "selected" as const, product_ids: sel.productIds };
}

interface Props {
  brandId?: string | null;
  value: ProductImageSelection;
  onChange: (next: ProductImageSelection) => void;
  className?: string;
  align?: "start" | "end";
}

type ProductRow = {
  id: string;
  label: string | null;
  product_type: string | null;
  image_url: string | null;
  gallery_images: string[] | null;
  is_featured: boolean | null;
};

export function ProductImagePicker({ brandId, value, onChange, className, align = "start" }: Props) {
  const { data: products = [] } = useQuery({
    queryKey: ["brand_products_picker", brandId],
    enabled: !!brandId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brand_products")
        .select("id, label, product_type, image_url, gallery_images, is_featured")
        .eq("brand_id", brandId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProductRow[];
    },
  });

  const withPhotos = products.filter(
    (p) => !!p.image_url || (p.gallery_images && p.gallery_images.length > 0),
  );

  const selectedCount = value.mode === "selected" ? value.productIds.length : 0;
  const label =
    value.mode === "off"
      ? "No product photos"
      : value.mode === "selected" && selectedCount > 0
        ? `${selectedCount} product${selectedCount > 1 ? "s" : ""}`
        : "Product photos";
  const active = value.mode === "off" || selectedCount > 0;

  const toggle = (id: string) => {
    const has = value.productIds.includes(id);
    const productIds = has ? value.productIds.filter((p) => p !== id) : [...value.productIds, id];
    onChange({ mode: productIds.length > 0 ? "selected" : "auto", productIds });
  };

  if (!brandId) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Choose which product photos Brandie should use"
          className={`h-8 flex items-center gap-1 px-2.5 rounded-full text-xs font-medium border transition-all ${
            active
              ? "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
              : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
          } ${className || ""}`}
        >
          {value.mode === "off" ? <ImageOff className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline max-w-[110px] truncate">{label}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-[260px] max-h-[60vh] overflow-y-auto">
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground/80">
          Use product images
        </DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => onChange({ mode: "auto", productIds: [] })}
          className={value.mode === "auto" ? "bg-accent" : ""}
        >
          <span className="flex-1">Let Brandie decide</span>
          {value.mode === "auto" && <Check className="h-3.5 w-3.5" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onChange({ mode: "off", productIds: [] })}
          className={value.mode === "off" ? "bg-accent" : ""}
        >
          <span className="flex-1">Don't use product photos</span>
          {value.mode === "off" && <Check className="h-3.5 w-3.5" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground/80">
          Pick specific products
        </DropdownMenuLabel>
        {withPhotos.length === 0 ? (
          <p className="px-2 py-2 text-xs text-muted-foreground">
            No product photos yet. Add product images in Brand Centre and they'll show up here.
          </p>
        ) : (
          withPhotos.map((p) => {
            const thumb = p.image_url || p.gallery_images?.[0] || "";
            const checked = value.mode === "selected" && value.productIds.includes(p.id);
            const shots = [p.image_url, ...(p.gallery_images || [])].filter(Boolean).length;
            return (
              <DropdownMenuItem
                key={p.id}
                onSelect={(e) => {
                  e.preventDefault();
                  toggle(p.id);
                }}
                className={`gap-2 ${checked ? "bg-accent" : ""}`}
              >
                {thumb ? (
                  <img
                    src={thumb}
                    alt={p.label ? `${p.label} product photo` : "Product photo"}
                    className="h-8 w-8 rounded-md object-cover border border-border shrink-0"
                    loading="lazy"
                  />
                ) : null}
                <span className="flex-1 min-w-0">
                  <span className="block truncate text-xs">
                    {p.is_featured ? "⭐ " : ""}
                    {p.label || "Untitled"}
                  </span>
                  <span className="block text-[10px] text-muted-foreground">
                    {shots} photo{shots > 1 ? "s" : ""}
                  </span>
                </span>
                {checked && <Check className="h-3.5 w-3.5 shrink-0" />}
              </DropdownMenuItem>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ProductImagePicker;
