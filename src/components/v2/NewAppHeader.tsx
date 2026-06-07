import { useAuth } from "@/hooks/useAuth";
import { useAdminRole } from "@/hooks/useAdminRole";
import brandieLogo from "@/assets/brandie-logo.png";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import BrandSwitcher from "@/components/BrandSwitcher";
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
  Gauge,
  Calendar,
  Palette,
  BarChart3,
  Settings,
  CreditCard,
  LogOut,
  Shield,
  Cpu,
  Wand2,
} from "lucide-react";

const FREE_MONTHLY = 5;

const NewAppHeader = () => {
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdminRole();
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("generations_count, generations_reset_at, bonus_credits, subscription_tier, paid_credits")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: rewardCredits } = useQuery({
    queryKey: ["reward-credits", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_rewards")
        .select("remaining")
        .eq("user_id", user!.id)
        .gt("remaining", 0)
        .gt("expires_at", new Date().toISOString());
      if (error) return 0;
      return (data || []).reduce((sum, r) => sum + r.remaining, 0);
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const getCreditsRemaining = () => {
    if (!profile) return FREE_MONTHLY;
    const resetAt = new Date(profile.generations_reset_at);
    const now = new Date();
    const isCurrentMonth = now.getMonth() === resetAt.getMonth() && now.getFullYear() === resetAt.getFullYear();
    const monthlyUsed = isCurrentMonth ? profile.generations_count : 0;
    const freeRemaining = Math.max(0, FREE_MONTHLY, monthlyUsed);
    const bonus = (profile as any)?.bonus_credits ?? 0;
    const paid = (profile as any)?.paid_credits ?? 0;
    return freeRemaining + bonus + (rewardCredits ?? 0) + paid;
  };

  const creditsRemaining = getCreditsRemaining();

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-4 sm:px-8 py-4 sm:py-6 border-b border-border bg-background/95 backdrop-blur-sm lg:pl-24">
      <div
        className="flex items-center gap-2 cursor-pointer"
        onClick={() => navigate("/cockpit")}
      >
        <img src={brandieLogo} alt="Brandie" className="h-8 w-8 sm:h-9 sm:w-9" />
        <span className="text-xl sm:text-2xl font-serif tracking-tight">Brandie</span>
      </div>

      <div className="hidden sm:flex items-center mx-2">
        <BrandSwitcher />
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-secondary text-xs sm:text-sm">
          <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary" />
          <span className="font-medium">{creditsRemaining}</span>
          <span className="text-muted-foreground hidden sm:inline">credits</span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-xl">
              <Menu className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 rounded-xl p-1">
            <DropdownMenuItem className="gap-2 rounded-lg cursor-pointer" onClick={() => navigate("/cockpit")}>
              <Gauge className="h-4 w-4" />
              Cockpit
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 rounded-lg cursor-pointer" onClick={() => navigate("/hub")}>
              <Calendar className="h-4 w-4" />
              Content Hub
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 rounded-lg cursor-pointer" onClick={() => navigate("/engine")}>
              <Cpu className="h-4 w-4" />
              Engine
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 rounded-lg cursor-pointer" onClick={() => navigate("/studio")}>
              <Wand2 className="h-4 w-4" />
              Studio (Manual)
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 rounded-lg cursor-pointer" onClick={() => navigate("/brand/editor")}>
              <Palette className="h-4 w-4" />
              Brand Centre
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 rounded-lg cursor-pointer" onClick={() => navigate("/report")}>
              <BarChart3 className="h-4 w-4" />
              Report
            </DropdownMenuItem>
            {isAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 rounded-lg cursor-pointer" onClick={() => navigate("/admin")}>
                  <Shield className="h-4 w-4" />
                  Admin Panel
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 rounded-lg cursor-pointer" onClick={() => navigate("/plans")}>
              <CreditCard className="h-4 w-4" />
              Buy Credits
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 rounded-lg cursor-pointer" onClick={() => navigate("/settings")}>
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

export default NewAppHeader;
