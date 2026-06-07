import { Link, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBrand } from "@/hooks/useBrand";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2, Pencil } from "lucide-react";
import SEO from "@/components/SEO";
import NewAppHeader from "@/components/v2/NewAppHeader";
import TeamMembersPanel from "@/components/team/TeamMembersPanel";

const Swatch = ({ hex }: { hex: string }) => (
  <div className="flex flex-col items-center gap-1.5">
    <div
      className="h-12 w-12 rounded-full border border-border"
      style={{ backgroundColor: hex }}
      aria-label={hex}
    />
    <span className="text-[10px] tracking-wider uppercase text-muted-foreground">
      {hex.replace("#", "")}
    </span>
  </div>
);

const Block: React.FC<{ label: string; children: React.ReactNode; href?: string }> = ({
  label,
  children,
  href,
}) => (
  <section className="space-y-3">
    <div className="flex items-center justify-between">
      <h2 className="text-xs tracking-[0.22em] uppercase text-muted-foreground">{label}</h2>
      {href && (
        <Link
          to={href}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <Pencil className="h-3 w-3" /> Edit
        </Link>
      )}
    </div>
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">{children}</div>
  </section>
);

const BrandCentre = () => {
  const { user, loading: authLoading } = useAuth();
  const { brand, isLoading: brandLoading } = useBrand(user);

  const { data: audience } = useQuery({
    queryKey: ["v2-brand-audience", brand?.id],
    queryFn: async () => {
      if (!brand?.id) return null;
      const { data } = await supabase
        .from("target_audiences")
        .select("*")
        .eq("brand_id", brand.id)
        .maybeSingle();
      return data;
    },
    enabled: !!brand?.id,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["v2-brand-products", brand?.id],
    queryFn: async () => {
      if (!brand?.id) return [];
      const { data } = await supabase
        .from("brand_products")
        .select("id, label, description, price, image_url")
        .eq("brand_id", brand.id)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
    enabled: !!brand?.id,
  });

  if (authLoading || brandLoading) {
    return (
      <div className="min-h-dvh grid place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth?next=/brand" replace />;
  if (!brand || !brand.onboarding_complete) return <Navigate to="/onboarding" replace />;

  const palette = [
    ...(brand.primary_colors ?? []),
    ...(brand.secondary_colors ?? []),
    ...(brand.accent_colors ?? []),
  ].filter(Boolean).slice(0, 8);

  return (
    <div className="min-h-dvh bg-background lg:pl-20 pb-24">
      <SEO title="Brand Centre, Brandie" description="Your brand memory." path="/brand" noindex />
      <NewAppHeader />


      <main className="max-w-3xl mx-auto px-5 sm:px-8 pt-10 sm:pt-16 space-y-10">
        <header className="flex items-start justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <p className="text-xs tracking-[0.22em] uppercase text-muted-foreground">
              Brand Centre
            </p>
            <h1 className="font-serif text-4xl sm:text-5xl tracking-tight leading-[1]">
              {brand.name}
            </h1>
            {brand.tagline && (
              <p className="text-muted-foreground max-w-xl">{brand.tagline}</p>
            )}
          </div>
          {brand.logo_url && (
            <img
              src={brand.logo_url}
              alt={`${brand.name} logo`}
              className="h-20 w-20 rounded-2xl object-contain border border-border bg-card p-2 shrink-0"
            />
          )}
        </header>

        <Block label="Identity" href="/brand/editor">
          <div className="grid sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <p className="text-[11px] tracking-wider uppercase text-muted-foreground">
                Description
              </p>
              <p className="text-sm leading-relaxed">
                {brand.description || "-"}
              </p>
            </div>
            <div className="space-y-1.5">
              <p className="text-[11px] tracking-wider uppercase text-muted-foreground">
                Voice
              </p>
              <p className="text-sm leading-relaxed">
                {brand.tone_of_voice || "-"}
              </p>
            </div>
          </div>
        </Block>

        <Block label="Palette" href="/brand/editor">
          {palette.length === 0 ? (
            <p className="text-sm text-muted-foreground">No colors set.</p>
          ) : (
            <div className="flex flex-wrap gap-5">
              {palette.map((hex) => (
                <Swatch key={hex} hex={hex} />
              ))}
            </div>
          )}
        </Block>

        <Block label="Typography" href="/brand/editor">
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <p className="text-[11px] tracking-wider uppercase text-muted-foreground mb-1">
                Display
              </p>
              <p
                className="text-2xl"
                style={{ fontFamily: brand.typography_display || undefined }}
              >
                {brand.typography_display || "-"}
              </p>
            </div>
            <div>
              <p className="text-[11px] tracking-wider uppercase text-muted-foreground mb-1">
                Body
              </p>
              <p
                className="text-base"
                style={{ fontFamily: brand.typography_primary || undefined }}
              >
                {brand.typography_primary || "-"}
              </p>
            </div>
          </div>
        </Block>

        <Block label="Audience (JTBD)" href="/brand/editor">
          {(() => {
            const raw = ((audience as any)?.raw_inputs ?? {}) as Record<string, any>;
            const jtbd = ((audience as any)?.jtbd_profile ?? {}) as Record<string, any>;
            const pick = (...keys: string[]) => {
              for (const k of keys) {
                const v = raw[k] ?? jtbd[k];
                if (typeof v === "string" && v.trim()) return v;
              }
              return null;
            };
            const rows = [
              ["Who", pick("who", "persona", "audience")],
              ["Struggle", pick("struggle", "pain", "problem")],
              ["Outcome", pick("desired_outcome", "outcome", "goal")],
              ["Trigger", pick("buying_trigger", "trigger", "moment")],
            ];
            if (!audience || rows.every(([, v]) => !v)) {
              return <p className="text-sm text-muted-foreground">No audience profile yet.</p>;
            }
            return (
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                {rows.map(([label, value]) => (
                  <div key={label as string}>
                    <p className="text-[11px] tracking-wider uppercase text-muted-foreground mb-1">
                      {label}
                    </p>
                    <p className="leading-relaxed">{(value as string) || "-"}</p>
                  </div>
                ))}
              </div>
            );
          })()}
        </Block>

        <Block label="Offer" href="/brand/editor">
          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground">No products or services yet.</p>
          ) : (
            <ul className="divide-y divide-border -my-2">
              {products.map((p: any) => (
                <li key={p.id} className="py-3 flex items-center gap-3">
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.label}
                      className="h-12 w-12 rounded-lg object-cover border border-border"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-secondary" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{p.label || "Untitled"}</p>
                    {p.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {p.description}
                      </p>
                    )}
                  </div>
                  {p.price && (
                    <span className="text-xs text-muted-foreground shrink-0">{p.price}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Block>

        <Block label="Team">
          <TeamMembersPanel />
        </Block>



        <div className="rounded-3xl border border-border bg-foreground text-background p-6 sm:p-8 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="font-serif text-xl sm:text-2xl tracking-tight">
              Edit anything, anytime.
            </h3>
            <p className="text-background/70 text-sm mt-1">
              Deep edits live in the full Brand Centre.
            </p>
          </div>
          <Button asChild variant="secondary" size="lg" className="rounded-full h-12 gap-2 shrink-0">
            <Link to="/brand/editor">
              Open editor <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
};

export default BrandCentre;
