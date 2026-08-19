import { useEffect, useMemo } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LoadingState } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import SEO from "@/components/SEO";
import CampaignLanding from "@/components/campaign/CampaignLanding";
import { captureCampaignRef, trackCampaignEvent } from "@/lib/campaignTrack";
import { getPartnerRef } from "@/lib/partnerRef";
import { normaliseSections, type CampaignCopy, type CampaignSectionKey } from "@/lib/campaignSections";

type PublicCampaign = {
  id: string;
  name: string;
  slug: string;
  goal: string | null;
  offer_text: string | null;
  sections: unknown;
  copy: CampaignCopy | null;
  status: string;
  ends_at: string | null;
};

/**
 * Public campaign landing page at /c/:slug.
 * Reads through a security-definer function so anonymous visitors only ever see
 * the live campaign, then records section-level engagement.
 */
const CampaignPage = () => {
  const { slug = "" } = useParams();
  const [params] = useSearchParams();
  const isPreview = params.get("preview") === "1";

  const { data, isLoading } = useQuery({
    queryKey: ["campaign-page", slug],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_campaign_page" as any, { _slug: slug });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row as PublicCampaign) ?? null;
    },
    enabled: !!slug,
    staleTime: 60_000,
  });

  const sections = useMemo<CampaignSectionKey[]>(() => normaliseSections(data?.sections), [data?.sections]);

  // Remember the campaign for signup attribution and count the visit once.
  useEffect(() => {
    if (!data || isPreview) return;
    captureCampaignRef(data.slug);
    trackCampaignEvent("view", data.slug);
  }, [data, isPreview]);

  if (isLoading) return <LoadingState label="Loading campaign" />;

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <SEO title="Campaign not available, Brandie" description="This Brandie campaign is no longer running." path={`/c/${slug}`} noindex />
        <div className="max-w-sm text-center space-y-4">
          <h1 className="text-2xl font-serif">This campaign has ended.</h1>
          <p className="text-sm text-muted-foreground">
            The offer you followed is no longer running, but Brandie is still here, and still free to start.
          </p>
          <Button asChild className="rounded-xl">
            <Link to="/">Go to Brandie</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Keep the partner referral on the signup link: one link, attribution intact.
  const partnerRef = getPartnerRef();
  const signupHref = `/auth?mode=signup&campaign=${encodeURIComponent(data.slug)}${
    partnerRef ? `&ref=${encodeURIComponent(partnerRef)}` : ""
  }`;

  return (
    <>
      <SEO
        title={`${data.copy?.hero?.headline?.slice(0, 55) || data.name}, Brandie`}
        description={
          data.copy?.hero?.subheadline?.slice(0, 155) ||
          data.goal?.slice(0, 155) ||
          "Pick a playbook, hit start, and a full week of on-brand social posts is generated for you."
        }
        path={`/c/${data.slug}`}
      />
      <CampaignLanding
        copy={data.copy || {}}
        sections={sections}
        signupHref={signupHref}
        onSectionView={isPreview ? undefined : (key) => trackCampaignEvent("section_view", data.slug, key)}
        onCtaClick={isPreview ? undefined : (key) => trackCampaignEvent("cta_click", data.slug, key)}
      />
    </>
  );
};

export default CampaignPage;
