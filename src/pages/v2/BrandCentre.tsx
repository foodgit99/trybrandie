import { useEffect, useState } from "react";
import { useScrollRestoration, readGroupOpen, writeGroupOpen } from "@/hooks/useScrollRestoration";
import { useBrandParamSync, brandHref } from "@/hooks/useBrandParamSync";
import { Link, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBrand } from "@/hooks/useBrand";
import { Button } from "@/components/ui/button";
import { ArrowRight, ChevronDown, Loader2, Pencil } from "lucide-react";

import SEO from "@/components/SEO";
import NewAppHeader from "@/components/v2/NewAppHeader";
import TeamMembersPanel from "@/components/team/TeamMembersPanel";
import BrandUsagePanel from "@/components/brands/BrandUsagePanel";
import BrandGalleryPanel from "@/components/brands/BrandGalleryPanel";
import GuidedTour from "@/components/v2/GuidedTour";
import { useFirstRunTour } from "@/hooks/useFirstRunTour";

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

const Block: React.FC<{ label: string; children: React.ReactNode; href?: string; id?: string }> = ({
  label,
  children,
  href,
  id,
}) => (
  <section className="space-y-3" id={id}>
    <div className="flex items-center justify-between">
      <h3 className="text-xs tracking-[0.22em] uppercase text-muted-foreground">{label}</h3>
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

const Group: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({
  title,
  hint,
  children,
}) => {
  const storageKey = `brandcentre:group:${title}`;
  const [open, setOpen] = useState(() => readGroupOpen(storageKey));

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      writeGroupOpen(storageKey, next);
      return next;
    });
  };

  // The guided walkthrough expands the group it is about to highlight.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent).detail as { title?: string } | undefined;
      if (detail?.title === title) {
        setOpen(true);
        writeGroupOpen(storageKey, true);
      }
    };
    window.addEventListener("brandie-tour:open-group", onOpen);
    return () => window.removeEventListener("brandie-tour:open-group", onOpen);
  }, [title, storageKey]);


  return (
    <section className="space-y-6">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="w-full flex items-baseline gap-4 text-left group/gh"
      >
        <h2 className="font-serif text-2xl tracking-tight leading-none shrink-0 group-hover/gh:text-primary transition-colors">{title}</h2>
        <span className="h-px flex-1 bg-border" />
        <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>
      {hint && open && <p className="text-sm text-muted-foreground -mt-3">{hint}</p>}
      {open && <div className="space-y-6">{children}</div>}
    </section>
  );
};

const EmptyState = ({
  title,
  body,
  cta = "Add it now",
  href = "/brand/editor",
}: {
  title: string;
  body: string;
  cta?: string;
  href?: string;
}) => (
  <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-5 text-center space-y-2">
    <p className="text-sm font-medium">{title}</p>
    <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">{body}</p>
    <Link
      to={href}
      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline pt-1"
    >
      {cta} <ArrowRight className="h-3 w-3" />
    </Link>
  </div>
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

  useBrandParamSync();

  const { data: galleryCount = 0 } = useQuery({
    queryKey: ["v2-brand-gallery-count", brand?.id],
    queryFn: async () => {
      if (!brand?.id) return 0;
      const { count } = await supabase
        .from("brand_inspiration")
        .select("id", { count: "exact", head: true })
        .eq("brand_id", brand.id);
      return count ?? 0;
    },
    enabled: !!brand?.id,
  });

  useScrollRestoration("brand-centre", !authLoading && !brandLoading && !!brand);

  const paletteCount = [
    ...((brand as any)?.primary_colors ?? []),
    ...((brand as any)?.secondary_colors ?? []),
    ...((brand as any)?.accent_colors ?? []),
  ].filter(Boolean).length;

  const tour = useFirstRunTour(
    brand?.id,
    {
      hasDescription: !!brand?.description,
      hasPalette: paletteCount > 0,
      hasTypography: !!(brand as any)?.typography_display || !!(brand as any)?.typography_primary,
      hasAudience: !!audience,
      hasProducts: products.length > 0,
      hasGallery: galleryCount > 0,
    },
    {
      editor: brandHref("/brand/editor", brand?.id),
      audience: brandHref("/brand/editor#audience-intelligence", brand?.id),
      gallery: brandHref("/brand#tour-gallery", brand?.id),
    },
    !authLoading && !brandLoading && !!brand,
  );

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


      <main className="max-w-3xl mx-auto px-5 sm:px-8 pt-10 sm:pt-16 space-y-14">
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
            {tour.remaining > 0 && !tour.showWelcome && !tour.active && (
              <button
                type="button"
                onClick={tour.replay}
                className="text-xs text-primary hover:underline"
              >
                Replay setup tour
              </button>
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

        {(() => {
          const todo = [
            !brand.description && { label: "Add a brand description", href: brandHref("/brand/editor", brand.id) },
            palette.length === 0 && { label: "Set your brand colours", href: brandHref("/brand/editor", brand.id) },
            !brand.typography_display && !brand.typography_primary && {
              label: "Choose your fonts",
              href: brandHref("/brand/editor", brand.id),
            },
            !audience && {
              label: "Build your audience profile",
              href: brandHref("/brand/editor#audience-intelligence", brand.id),
            },
            products.length === 0 && {
              label: "Add a product or service",
              href: brandHref("/brand/editor", brand.id),
            },
          ].filter(Boolean) as { label: string; href: string }[];
          if (todo.length === 0) return null;
          return (
            <div className="section-accent-rail rounded-2xl border border-border bg-card p-5 pl-6 space-y-3 shadow-flat">
              <div>
                <p className="text-sm font-medium">Finish setting up {brand.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {todo.length} {todo.length === 1 ? "thing" : "things"} left. Each one makes
                  Brandie's output sharper and more on-brand.
                </p>
              </div>
              <ul className="space-y-1.5">
                {todo.map((t) => (
                  <li key={t.label}>
                    <Link
                      to={t.href}
                      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                    >
                      {t.label} <ArrowRight className="h-3 w-3" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })()}

        {tour.showWelcome && (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 flex flex-wrap items-center gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                Let's finish your brand memory, {tour.remaining} quick{" "}
                {tour.remaining === 1 ? "step" : "steps"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                I'll walk you through each empty section and show the next best action.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" className="rounded-full" onClick={tour.start}>
                Start tour
              </Button>
              <Button size="sm" variant="ghost" className="rounded-full" onClick={tour.dismiss}>
                Not now
              </Button>
            </div>
          </div>
        )}



        <Group title="Identity" hint="How your brand looks and sounds in every generated asset.">
        <Block id="tour-basics" label="Basics" href={brandHref("/brand/editor", brand.id)}>
          {!brand.description && !brand.tone_of_voice ? (
            <EmptyState
              title="Brandie doesn't know what you do yet"
              body="Add a one-paragraph description and your tone of voice. Every caption and design is written from these two lines."
              cta="Describe your brand"
            />
          ) : (
          <div className="grid sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <p className="text-[11px] tracking-wider uppercase text-muted-foreground">
                Description
              </p>
              <p className="text-sm leading-relaxed">
                {brand.description || (
                  <span className="text-muted-foreground">
                    Missing, add it so copy sounds like your business.
                  </span>
                )}
              </p>
            </div>
            <div className="space-y-1.5">
              <p className="text-[11px] tracking-wider uppercase text-muted-foreground">
                Voice
              </p>
              <p className="text-sm leading-relaxed">
                {brand.tone_of_voice || (
                  <span className="text-muted-foreground">
                    Missing, captions will default to a neutral tone.
                  </span>
                )}
              </p>
            </div>
          </div>
          )}
        </Block>

        <Block id="tour-palette" label="Palette" href={brandHref("/brand/editor", brand.id)}>
          {palette.length === 0 ? (
            <EmptyState
              title="No brand colours yet"
              body="Add 2 to 4 hex codes. Without them Brandie picks its own palette and your posts won't look consistent."
              cta="Set your colours"
            />
          ) : (
            <div className="flex flex-wrap gap-5">
              {palette.map((hex) => (
                <Swatch key={hex} hex={hex} />
              ))}
            </div>
          )}
        </Block>

        <Block id="tour-typography" label="Typography" href={brandHref("/brand/editor", brand.id)}>
          {!brand.typography_display && !brand.typography_primary ? (
            <EmptyState
              title="No fonts chosen"
              body="Pick a display font for headlines and a body font for supporting copy so every design uses the same type system."
              cta="Choose fonts"
            />
          ) : (
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <p className="text-[11px] tracking-wider uppercase text-muted-foreground mb-1">
                Display
              </p>
              <p
                className="text-2xl"
                style={{ fontFamily: brand.typography_display || undefined }}
              >
                {brand.typography_display || (
                  <span className="text-sm text-muted-foreground">Not set</span>
                )}
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
                {brand.typography_primary || (
                  <span className="text-sm text-muted-foreground">Not set</span>
                )}
              </p>
            </div>
          </div>
          )}
        </Block>

        </Group>

        <Group title="Strategy" hint="Who you are talking to and what you are selling.">
        <Block id="tour-audience" label="Audience (JTBD)" href={brandHref("/brand/editor", brand.id)}>

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
              return (
                <EmptyState
                  title="No audience profile yet"
                  body="Answer the JTBD questions, who they are, what they struggle with, and what makes them buy. This is what turns generic posts into content that converts."
                  cta="Build the profile"
                  href={brandHref("/brand/editor#audience-intelligence", brand.id)}
                />
              );
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

        <Block id="tour-offer" label="Offer" href={brandHref("/brand/editor", brand.id)}>
          {products.length === 0 ? (
            <EmptyState
              title="Nothing to sell yet"
              body="Add your products or services with photos and prices. Promotional posts and carousels are built directly from this list."
              cta="Add a product or service"
            />
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
        </Group>

        <Group title="Assets" hint="Real photos Brandie prioritises over generated imagery.">
          <Block id="tour-gallery" label="Gallery">
            <p className="text-xs text-muted-foreground -mt-1 mb-3 leading-relaxed">
              Upload real photos, products, team, premises, screenshots, and label them.
              Brandie uses these exact images before it generates anything, so designs match reality.
            </p>

            <BrandGalleryPanel
              brandId={brand.id}
              userId={user.id}
              preferGalleryFirst={(brand as any).prefer_gallery_first ?? true}
            />
          </Block>
        </Group>

        <Group title="Workspace" hint="People and activity on this brand.">
          <div className="space-y-3">
            <h3 className="text-xs tracking-[0.22em] uppercase text-muted-foreground">Team</h3>
            <TeamMembersPanel />
          </div>


          {(brand as any).__role !== "member" && (
            <div className="space-y-3">
              <h3 className="text-xs tracking-[0.22em] uppercase text-muted-foreground">Usage</h3>
              <BrandUsagePanel
                brandId={brand.id}
                ownerUserId={user.id}
                ownerName={(user.user_metadata as any)?.full_name || user.email || "Owner"}
                isOwner={(brand as any).__role !== "member"}
              />
            </div>
          )}
        </Group>





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
            <Link to={brandHref("/brand/editor", brand.id)}>
              Open editor <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {tour.justFinished && (
          <div className="rounded-2xl border border-border bg-card p-5 flex flex-wrap items-center gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Your brand memory is ready</p>
              <p className="text-xs text-muted-foreground mt-1">
                Brandie now has enough to plan and design your week.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button asChild size="sm" className="rounded-full gap-1.5">
                <Link to={brandHref("/blueprint", brand.id)}>
                  Open Blueprint <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
              <Button size="sm" variant="ghost" className="rounded-full" onClick={tour.clearFinished}>
                Dismiss
              </Button>
            </div>
          </div>
        )}

        {tour.active && (
          <GuidedTour
            steps={tour.steps}
            index={tour.index}
            onNext={tour.next}
            onSkipStep={tour.next}
            onClose={tour.close}
            onAction={tour.pauseForAction}
            justCompletedLabel={tour.justCompleted}
          />
        )}
      </main>
    </div>
  );
};

export default BrandCentre;
