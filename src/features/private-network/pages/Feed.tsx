import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Heart, Bookmark, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "sonner";
import { PNLayout, ErrorBox, StatusPill } from "../components/PNShell";
import PublishSheet, { type PublishTarget } from "../components/PublishSheet";
import { pnFrom, pnError, rpc, signedMedia } from "../api";
import { usePrivateNetwork } from "../hooks/usePrivateNetwork";
import type { FeedItem } from "../types";
import { PLACEMENT_STATUS_LABEL, platformLabel } from "../types";
import { formatNgn } from "../services/profile";

const PAGE = 8;
type Page = { items: (FeedItem & { mediaUrl: string | null })[]; next: number | null };

export default function Feed({ savedOnly = false }: { savedOnly?: boolean }) {
  const pn = usePrivateNetwork();
  const qc = useQueryClient();
  const [target, setTarget] = useState<PublishTarget | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  const q = useInfiniteQuery<Page>({
    queryKey: ["pn", "feed", savedOnly],
    enabled: pn.isApprovedPublisher,
    initialPageParam: 0,
    getNextPageParam: (last) => last.next,
    queryFn: async ({ pageParam }) => {
      const offset = pageParam as number;
      const rows = await rpc<FeedItem[]>("feed", { _limit: PAGE, _offset: offset, _saved_only: savedOnly });
      const media = await signedMedia(rows.map((r) => r.creative_id));
      return {
        items: rows.map((r) => ({ ...r, mediaUrl: media[r.creative_id]?.url ?? null })),
        next: rows.length === PAGE ? offset + PAGE : null,
      };
    },
  });

  // de-duplicate across pages defensively
  const items = useMemo(() => {
    const seen = new Set<string>();
    return (q.data?.pages ?? []).flatMap((p) => p.items).filter((i) => (seen.has(i.creative_id) ? false : (seen.add(i.creative_id), true)));
  }, [q.data]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => {
      if (e[0].isIntersecting && q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage();
    }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [q.hasNextPage, q.isFetchingNextPage, q.fetchNextPage]);

  const toggle = async (kind: "likes" | "saves", item: FeedItem, on: boolean) => {
    if (!pn.publisher) return;
    const patch = (v: boolean) =>
      qc.setQueryData<any>(["pn", "feed", savedOnly], (old: any) =>
        old && { ...old, pages: old.pages.map((p: Page) => ({ ...p, items: p.items.map((i) => (i.creative_id === item.creative_id ? { ...i, [kind === "likes" ? "liked" : "saved"]: v } : i)) })) });
    patch(on);
    const t = pnFrom(kind);
    const { error } = on
      ? await t.insert({ publisher_id: pn.publisher.id, creative_id: item.creative_id })
      : await t.delete().eq("publisher_id", pn.publisher.id).eq("creative_id", item.creative_id);
    if (error && !/duplicate/.test(error.message)) { patch(!on); toast.error(pnError(error)); }
    if (kind === "saves") qc.invalidateQueries({ queryKey: ["pn", "feed", true] });
  };

  const title = savedOnly ? "Saved" : "Feed";
  if (!pn.publisher || pn.publisher.status === "deleted")
    return (
      <PNLayout title={title}>
        <EmptyState title="Become a Brandie publisher" description="Share brand campaigns with your people on WhatsApp and social, and earn per verified post. Start with a short private profile.">
          <Button asChild><Link to="/private-network/profile">Create my profile</Link></Button>
        </EmptyState>
      </PNLayout>
    );
  if (!pn.isApprovedPublisher)
    return (
      <PNLayout title={title}>
        <EmptyState
          title={pn.publisher.status === "pending" ? "Your profile is in review" : `Profile ${pn.publisher.status}`}
          description={pn.publisher.status === "pending" ? "A Brandie reviewer will approve it soon. You can keep improving your profile meanwhile." : pn.publisher.status_reason ?? "Contact Brandie support for help."}
        >
          <Button asChild variant="outline"><Link to="/private-network/profile">Open profile</Link></Button>
        </EmptyState>
      </PNLayout>
    );

  return (
    <PNLayout title={title}>
      {q.isLoading && (
        <div className="space-y-4" aria-busy="true" aria-label="Loading campaigns">
          {[0, 1].map((i) => <Skeleton key={i} className="aspect-square w-full rounded-2xl" />)}
        </div>
      )}
      {q.isError && <ErrorBox message={pnError(q.error)} onRetry={() => q.refetch()} />}
      {!q.isLoading && !q.isError && items.length === 0 && (
        <EmptyState
          title={savedOnly ? "Nothing saved yet" : "No campaigns for you right now"}
          description={savedOnly ? "Tap the bookmark on a campaign to keep it here." : "New campaigns that fit your profile will appear here. A fuller profile gets more matches."}
        />
      )}
      <ul className="space-y-6">
        {items.map((it) => (
          <li key={it.creative_id}>
            <article className="overflow-hidden rounded-2xl border bg-card" aria-label={`${it.brand_name} campaign`}>
              <header className="flex items-center gap-2 p-3">
                {it.brand_logo ? <img src={it.brand_logo} alt="" className="h-8 w-8 rounded-full object-cover" /> : <div className="h-8 w-8 rounded-full bg-muted" aria-hidden />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{it.brand_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{it.campaign_name}</p>
                </div>
                {it.my_placement_status && <StatusPill tone="info">{PLACEMENT_STATUS_LABEL[it.my_placement_status as keyof typeof PLACEMENT_STATUS_LABEL] ?? it.my_placement_status}</StatusPill>}
              </header>
              <div className="bg-muted">
                {!it.mediaUrl ? (
                  <div className="flex aspect-square items-center justify-center text-sm text-muted-foreground">Media unavailable</div>
                ) : it.media_type === "video" ? (
                  <video src={it.mediaUrl} controls playsInline preload="metadata" className="aspect-square w-full object-contain" />
                ) : (
                  <img src={it.mediaUrl} alt={it.caption ?? `${it.brand_name} campaign`} loading="lazy" className="aspect-square w-full object-cover" />
                )}
              </div>
              <div className="space-y-2 p-3">
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" aria-pressed={it.liked} aria-label={it.liked ? "Unlike" : "Like"} onClick={() => toggle("likes", it, !it.liked)}>
                    <Heart className={`h-5 w-5 ${it.liked ? "fill-current text-destructive" : ""}`} />
                  </Button>
                  <Button variant="ghost" size="icon" aria-pressed={it.saved} aria-label={it.saved ? "Unsave" : "Save"} onClick={() => toggle("saves", it, !it.saved)}>
                    <Bookmark className={`h-5 w-5 ${it.saved ? "fill-current" : ""}`} />
                  </Button>
                  <div className="ml-auto">
                    <Button
                      disabled={!it.mediaUrl}
                      onClick={() => setTarget({ ...it, mediaUrl: it.mediaUrl })}
                    >
                      {it.my_placement_status ? "Share again" : "Publish"}
                    </Button>
                  </div>
                </div>
                <p className="text-sm font-semibold">
                  {formatNgn(it.base_fee_ngn)} per verified post
                  {it.action_bonus_ngn > 0 && <span className="font-normal text-muted-foreground"> · +{formatNgn(it.action_bonus_ngn)} per qualified lead</span>}
                  {it.commission_pct > 0 && <span className="font-normal text-muted-foreground"> · {it.commission_pct}% of sales</span>}
                </p>
                {it.caption && <p className="whitespace-pre-line text-sm">{it.caption}</p>}
                {it.description && <p className="text-xs text-muted-foreground">{it.description}</p>}
                <p className="text-xs text-muted-foreground">
                  {it.platforms.map(platformLabel).join(" · ")}
                  {it.ends_at && ` · ends ${new Date(it.ends_at).toLocaleDateString()}`}
                </p>
                <details className="text-xs text-muted-foreground">
                  <summary className="inline-flex cursor-pointer items-center gap-1"><Info className="h-3 w-3" aria-hidden />Why you see this · match {it.score}/100</summary>
                  <ul className="mt-1 list-disc pl-5">{it.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
                  <p className="mt-1">Score version {it.score_version}. Based on your self-reported profile.</p>
                </details>
              </div>
            </article>
          </li>
        ))}
      </ul>
      <div ref={sentinel} aria-hidden className="h-4" />
      {q.isFetchingNextPage && <p className="text-center text-sm text-muted-foreground" role="status">Loading more…</p>}
      {q.hasNextPage && !q.isFetchingNextPage && <Button variant="outline" className="w-full" onClick={() => q.fetchNextPage()}>Load more</Button>}
      {!q.hasNextPage && items.length > 0 && <p className="text-center text-xs text-muted-foreground">You're all caught up</p>}
      <PublishSheet target={target} open={!!target} onOpenChange={(o) => !o && setTarget(null)} />
    </PNLayout>
  );
}
