export interface NormalizedProduct {
  source: "brand_product" | "prospect_product";
  id: string;
  ownerId: string; // brand_id or prospect_id
  name: string;
  description: string | null;
  category: string | null;
  price: number | null;
  currency: string | null;
  imageUrl: string | null;
}

export function fromBrandProduct(p: Record<string, any>): NormalizedProduct {
  const images = Array.isArray(p.images) ? p.images : Array.isArray(p.image_urls) ? p.image_urls : [];
  return {
    source: "brand_product",
    id: p.id,
    ownerId: p.brand_id,
    name: p.name ?? p.title ?? "Untitled product",
    description: p.description ?? null,
    category: p.category ?? null,
    price: typeof p.price === "number" ? p.price : p.price ? Number(p.price) : null,
    currency: p.currency ?? "NGN",
    imageUrl: p.image_url ?? (typeof images[0] === "string" ? images[0] : images[0]?.url) ?? null,
  };
}

export function fromProspectProduct(p: Record<string, any>): NormalizedProduct {
  return {
    source: "prospect_product",
    id: p.id,
    ownerId: p.prospect_id,
    name: p.name,
    description: p.description ?? null,
    category: p.category ?? null,
    price: p.price ?? null,
    currency: p.currency ?? "NGN",
    imageUrl: p.image_url ?? null,
  };
}
