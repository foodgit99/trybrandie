import { useAuth } from "@/hooks/useAuth";
import brandieLogo from "@/assets/brandie-logo.png";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Menu,
  Sparkles,
  Plus,
  Palette,
  Clock,
  Settings,
  CreditCard,
  LogOut,
} from "lucide-react";

const FREE_TIER_LIMIT = 10;

const AppHeader = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("generations_count, generations_reset_at, bonus_credits")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const getCreditsUsed = () => {
    if (!profile) return 0;
    const resetAt = new Date(profile.generations_reset_at);
    const now = new Date();
    if (now.getMonth() !== resetAt.getMonth() || now.getFullYear() !== resetAt.getFullYear()) {
      return 0;
    }
    return profile.generations_count;
  };

  const creditsUsed = getCreditsUsed();
  const bonusCredits = (profile as any)?.bonus_credits ?? 0;
  const creditsRemaining = FREE_TIER_LIMIT + bonusCredits - creditsUsed;

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-4 sm:px-8 py-4 sm:py-6 border-b border-border bg-background/95 backdrop-blur-sm">
      <div
        className="flex items-center gap-2 cursor-pointer"
        onClick={() => navigate("/dashboard")}
      >
        <img src={brandieLogo} alt="Brandie" className="h-8 w-8 sm:h-9 sm:w-9" />
        <span className="text-xl sm:text-2xl font-serif tracking-tight">Brandie</span>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Credit badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-secondary text-xs sm:text-sm">
          <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary" />
          <span className="font-medium">{creditsRemaining}</span>
          <span className="text-muted-foreground hidden sm:inline">/ {FREE_TIER_LIMIT}</span>
        </div>

        {/* Hamburger menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-xl">
              <Menu className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 rounded-xl p-1">
            <DropdownMenuItem
              className="gap-2 rounded-lg cursor-pointer"
              onClick={() => navigate("/studio")}
            >
              <Plus className="h-4 w-4" />
              New Design
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 rounded-lg cursor-pointer"
              onClick={() => navigate("/brand")}
            >
              <Palette className="h-4 w-4" />
              Brand Centre
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 rounded-lg cursor-pointer"
              onClick={() => navigate("/history")}
            >
              <Clock className="h-4 w-4" />
              Design History
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 rounded-lg cursor-pointer"
              onClick={() => navigate("/plans")}
            >
              <CreditCard className="h-4 w-4" />
              Plans
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 rounded-lg cursor-pointer"
              onClick={() => navigate("/settings")}
            >
              <Settings className="h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 rounded-lg cursor-pointer text-destructive focus:text-destructive"
              onClick={signOut}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default AppHeader;
