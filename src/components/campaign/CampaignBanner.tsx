import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Thin strip on Brandie's own landing page pointing visitors at the live
 * campaign, if one is running. Reads through a security-definer function, so it
 * works for anonymous visitors and returns nothing when no campaign is live.
 */
const CampaignBanner = () => {
  const { data } = useQuery({
    queryKey: ["active-campaign-page"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_active_campaign_page" as any);
      if (error) return null;
      const row = Array.isArray(data) ? data[0] : data;
      return (row as { slug: string; name: string; copy?: { hero?: { headline?: string } } }) ?? null;
    },
    staleTime: 5 * 60_000,
  });

  if (!data?.slug) return null;

  const label = data.copy?.hero?.headline || data.name;

  return (
    <Link
      to={`/c/${data.slug}`}
      className="group block border-b border-border bg-primary/10 hover:bg-primary/15 transition-colors"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-2.5 flex items-center justify-center gap-2 text-center">
        <Megaphone className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="text-xs sm:text-sm text-foreground/90 line-clamp-1">{label}</span>
        <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </Link>
  );
};

export default CampaignBanner;
