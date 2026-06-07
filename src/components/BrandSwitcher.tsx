import { useNavigate } from "react-router-dom";
import { useBrand } from "@/hooks/useBrand";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, ChevronDown, FolderPlus, Lock, Settings2 } from "lucide-react";

const BrandSwitcher = () => {
  const navigate = useNavigate();
  const { brand, brands, setActiveBrand } = useBrand();
  const { data: sub } = useSubscription();

  // Only render when there's something meaningful to switch.
  const visibleBrands = brands.filter((b: any) => !b.is_archived);
  const canMultiBrand =
    sub?.brandLimit === null || (sub?.brandLimit ?? 1) > 1;

  if (!brand) return null;
  // Hide entirely for single-brand users with only one brand — keeps header clean.
  if (visibleBrands.length <= 1 && !canMultiBrand) return null;

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
      <DropdownMenuContent align="start" className="w-64 rounded-xl p-1">
        <DropdownMenuLabel className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground">
          Switch brand
        </DropdownMenuLabel>
        {visibleBrands.map((b: any) => {
          const active = b.id === brand.id;
          return (
            <DropdownMenuItem
              key={b.id}
              className="gap-2 rounded-lg cursor-pointer"
              onClick={() => setActiveBrand(b.id)}
            >
              <span className="flex-1 truncate">{b.name}</span>
              {active && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
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
