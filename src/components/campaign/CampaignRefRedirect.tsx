import { useLocation, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * A partner has one link: their referral link. When a campaign page is live,
 * `/?ref=<partner>` lands the visitor on that campaign page with the referral
 * intact. Without a referral (or with no campaign live) the default landing
 * page renders as usual.
 */
const CampaignRefRedirect = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const ref = new URLSearchParams(location.search).get("ref") ||
    new URLSearchParams(location.search).get("partner");

  const { data, isLoading } = useQuery({
    queryKey: ["active-campaign-page"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_active_campaign_page" as any);
      if (error) return null;
      const row = Array.isArray(data) ? data[0] : data;
      return (row as { slug?: string } | null) ?? null;
    },
    enabled: !!ref,
    staleTime: 5 * 60_000,
  });

  // Don't flash the default page while we decide where a referral should land.
  if (ref && isLoading) return null;

  if (ref && data?.slug) {
    return <Navigate to={`/c/${data.slug}?ref=${encodeURIComponent(ref.toLowerCase().trim())}`} replace />;
  }

  return <>{children}</>;
};

export default CampaignRefRedirect;
