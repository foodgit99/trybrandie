import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type UsageRange = 7 | 30 | 90;

export interface MemberStat {
  user_id: string;
  name: string;
  role: "Owner" | "Editor" | "Viewer";
  designs: number;
  lastActive: string | null;
}

export interface UsageData {
  designs: number;
  credits: number | null;
  autopilotPosts: number;
  activeMembers: number;
  dailyDesigns: { date: string; count: number }[];
  members: MemberStat[];
  byCategory: { key: string; count: number }[];
  byFormat: { key: string; count: number }[];
  activity: {
    id: string;
    kind: "design" | "idea" | "autopilot" | "member";
    actorName: string;
    title: string;
    at: string;
    designId?: string;
  }[];
}

export function useBrandUsage(
  brandId: string | undefined,
  ownerUserId: string | undefined,
  ownerName: string,
  isOwner: boolean,
  range: UsageRange,
) {
  return useQuery({
    queryKey: ["brand-usage", brandId, range],
    enabled: !!brandId && isOwner,
    staleTime: 60_000,
    queryFn: async (): Promise<UsageData> => {
      const since = new Date(Date.now() - range * 24 * 60 * 60 * 1000).toISOString();

      const [designsRes, ideasRes, membersRes] = await Promise.all([
        supabase
          .from("designs")
          .select("id, user_id, created_at, title")
          .eq("brand_id", brandId!)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(5000),
        supabase
          .from("content_ideas")
          .select("id, user_id, created_at, title, content_category, content_format, autopilot, autopilot_status")
          .eq("brand_id", brandId!)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(5000),
        supabase
          .from("brand_team_members")
          .select("user_id, email, role, status, accepted_at")
          .eq("brand_id", brandId!),
      ]);

      const designs = designsRes.data ?? [];
      const ideas = ideasRes.data ?? [];
      const members = membersRes.data ?? [];

      // Member name map
      const nameByUser = new Map<string, { name: string; role: "Owner" | "Editor" | "Viewer" }>();
      if (ownerUserId) nameByUser.set(ownerUserId, { name: ownerName || "Owner", role: "Owner" });
      for (const m of members) {
        if (m.status === "active" && m.user_id) {
          nameByUser.set(m.user_id, {
            name: m.email || "Member",
            role: m.role === "viewer" ? "Viewer" : "Editor",
          });
        }
      }

      // Daily designs
      const dayMap = new Map<string, number>();
      for (let i = range - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        dayMap.set(d, 0);
      }
      for (const d of designs) {
        const k = d.created_at.slice(0, 10);
        if (dayMap.has(k)) dayMap.set(k, (dayMap.get(k) ?? 0) + 1);
      }
      const dailyDesigns = Array.from(dayMap.entries()).map(([date, count]) => ({ date, count }));

      // Member stats
      const designsByUser = new Map<string, { count: number; last: string }>();
      for (const d of designs) {
        const cur = designsByUser.get(d.user_id) ?? { count: 0, last: d.created_at };
        cur.count += 1;
        if (d.created_at > cur.last) cur.last = d.created_at;
        designsByUser.set(d.user_id, cur);
      }
      const memberStats: MemberStat[] = Array.from(nameByUser.entries())
        .map(([user_id, info]) => {
          const s = designsByUser.get(user_id);
          return {
            user_id,
            name: info.name,
            role: info.role,
            designs: s?.count ?? 0,
            lastActive: s?.last ?? null,
          };
        })
        .sort((a, b) => {
          if (a.role === "Owner") return -1;
          if (b.role === "Owner") return 1;
          return b.designs - a.designs;
        });

      // Active members
      const activeIds = new Set<string>();
      designs.forEach((d) => d.user_id && activeIds.add(d.user_id));
      ideas.forEach((i) => i.user_id && activeIds.add(i.user_id));

      // By category & format
      const catMap = new Map<string, number>();
      const fmtMap = new Map<string, number>();
      for (const i of ideas) {
        const c = i.content_category || "uncategorised";
        catMap.set(c, (catMap.get(c) ?? 0) + 1);
        const f = i.content_format || "graphic";
        fmtMap.set(f, (fmtMap.get(f) ?? 0) + 1);
      }
      const byCategory = Array.from(catMap.entries())
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count);
      const byFormat = Array.from(fmtMap.entries())
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count);

      // Autopilot posts
      const autopilotPosts = ideas.filter(
        (i) => i.autopilot && i.autopilot_status === "completed",
      ).length;

      // Activity feed (latest 20 across designs + autopilot completions + member joins)
      const feed: UsageData["activity"] = [];
      for (const d of designs.slice(0, 30)) {
        feed.push({
          id: `d-${d.id}`,
          kind: "design",
          actorName: nameByUser.get(d.user_id)?.name ?? "Someone",
          title: d.title || "New design",
          at: d.created_at,
          designId: d.id,
        });
      }
      for (const i of ideas.slice(0, 30)) {
        if (i.autopilot && i.autopilot_status === "completed") {
          feed.push({
            id: `a-${i.id}`,
            kind: "autopilot",
            actorName: "Autopilot",
            title: i.title || "Autopilot post",
            at: i.created_at,
          });
        }
      }
      for (const m of members) {
        if (m.status === "active" && m.accepted_at && m.accepted_at >= since) {
          feed.push({
            id: `m-${m.user_id}`,
            kind: "member",
            actorName: m.email || "Member",
            title: "Joined the brand",
            at: m.accepted_at,
          });
        }
      }
      feed.sort((a, b) => (a.at < b.at ? 1 : -1));

      return {
        designs: designs.length,
        credits: null,
        autopilotPosts,
        activeMembers: activeIds.size,
        dailyDesigns,
        members: memberStats,
        byCategory,
        byFormat,
        activity: feed.slice(0, 20),
      };
    },
  });
}
