import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useBrand } from "@/hooks/useBrand";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, ChevronDown, FolderPlus, Lock, Settings2, Users } from "lucide-react";

const BrandSwitcher = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { brand, brands, setActiveBrand } = useBrand();
  const { data: sub } = useSubscription();

  const foldersEnabled = !!sub?.features?.client_folders;

  const { data: folders = [] } = useQuery({
    queryKey: ["client-folders", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("client_folders" as any)
        .select("id, name, color")
        .eq("owner_user_id", user.id);
      return data ?? [];
    },
    enabled: !!user && foldersEnabled,
  });

  const visibleBrands = brands.filter((b: any) => !b.is_archived);
  const canMultiBrand = sub?.brandLimit === null || (sub?.brandLimit ?? 1) > 1;

  if (!brand) return null;
  if (visibleBrands.length <= 1 && !canMultiBrand) return null;

  // Group by folder when enabled
  const folderById: Record<string, any> = {};
  for (const f of folders as any[]) folderById[f.id] = f;

  const grouped: { label: string; color?: string; brands: any[] }[] = [];
  if (foldersEnabled && (folders as any[]).length > 0) {
    const buckets: Record<string, any[]> = { __unfiled: [] };
    for (const b of visibleBrands as any[]) {
      const fid = b.client_folder_id;
      if (fid && folderById[fid]) {
        if (!buckets[fid]) buckets[fid] = [];
        buckets[fid].push(b);
      } else {
        buckets.__unfiled.push(b);
      }
    }
    for (const f of folders as any[]) {
      if (buckets[f.id]?.length) grouped.push({ label: f.name, color: f.color, brands: buckets[f.id] });
    }
    if (buckets.__unfiled.length) grouped.push({ label: "Unfiled", brands: buckets.__unfiled });
  } else {
    grouped.push({ label: "Switch brand", brands: visibleBrands });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-xl gap-1.5 max-w-[160px] sm:max-w-[220px]"
        >
          <span className="truncate text-sm font-medium">{brand.name}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 rounded-xl p-1 max-h-[70vh] overflow-y-auto">
        {grouped.map((group, gi) => (
          <div key={`${group.label}-${gi}`}>
            <DropdownMenuLabel className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground flex items-center gap-1.5">
              {group.color && (
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: group.color }} />
              )}
              {group.label}
            </DropdownMenuLabel>
            {group.brands.map((b: any) => {
              const active = b.id === brand.id;
              const isMember = b.__role === "member";
              return (
                <DropdownMenuItem
                  key={b.id}
                  className="gap-2 rounded-lg cursor-pointer"
                  onClick={() => setActiveBrand(b.id)}
                >
                  <span className="flex-1 truncate">{b.name}</span>
                  {isMember && (
                    <Users className="h-3 w-3 text-muted-foreground" aria-label="Member" />
                  )}
                  {active && <Check className="h-4 w-4 text-primary" />}
                </DropdownMenuItem>
              );
            })}
            {gi < grouped.length - 1 && <DropdownMenuSeparator />}
          </div>
        ))}
        <DropdownMenuSeparator />
        {canMultiBrand ? (
          <DropdownMenuItem
            className="gap-2 rounded-lg cursor-pointer"
            onClick={() => navigate("/brands")}
          >
            <FolderPlus className="h-4 w-4" />
            Add or manage brands
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            className="gap-2 rounded-lg cursor-pointer"
            onClick={() => navigate("/pricing")}
          >
            <Lock className="h-4 w-4" />
            Unlock multi-brand
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          className="gap-2 rounded-lg cursor-pointer"
          onClick={() => navigate("/brand/editor")}
        >
          <Settings2 className="h-4 w-4" />
          Edit current brand
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default BrandSwitcher;
