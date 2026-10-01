import { useAuth } from "@/hooks/useAuth";
import { useAdminRole } from "@/hooks/useAdminRole";
import { usePartnerRole } from "@/hooks/usePartnerRole";
import { useAffiliateRole } from "@/hooks/useAffiliateRole";
import brandieLogo from "@/assets/brandie-logo.png";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import BrandSwitcher from "@/components/BrandSwitcher";
import { useBrand } from "@/hooks/useBrand";
import { brandHref } from "@/hooks/useBrandParamSync";
import CreditsBadge from "@/components/CreditsBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Menu,
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
  History,
  LifeBuoy,
  User,
  Map,
  Sun,
  Moon,
  Handshake,
  FileDown,
  Network,
} from "lucide-react";
import { useCreatorNetwork } from "@/features/creator-network/hooks/useCreatorNetwork";



const NewAppHeader = () => {
  const { signOut } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdminRole();
  const { isPartner } = usePartnerRole();
  const { isAffiliate } = useAffiliateRole();
  const { canAccess: showCreatorNetwork } = useCreatorNetwork();

  const navigate = useNavigate();
  const { activeBrandId } = useBrand();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-4 sm:px-8 py-4 sm:py-6 border-b border-border bg-background/95 backdrop-blur-sm lg:pl-24 after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-gradient-spectrum after:opacity-25">
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
        <CreditsBadge />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-xl">
              <Menu className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 rounded-xl p-1 max-h-[80vh] overflow-y-auto">
            <DropdownMenuItem className="gap-2 rounded-lg cursor-pointer" onClick={() => navigate("/cockpit")}>
              <Gauge className="h-4 w-4" />
              Cockpit
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 rounded-lg cursor-pointer" onClick={() => navigate("/hub")}>
              <Calendar className="h-4 w-4" />
              Content Hub
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 rounded-lg cursor-pointer" onClick={() => navigate("/blueprint")}>
              <Map className="h-4 w-4" />
              Blueprint
            </DropdownMenuItem>

            <DropdownMenuItem className="gap-2 rounded-lg cursor-pointer" onClick={() => navigate("/engine")}>
              <Cpu className="h-4 w-4" />
              Engine
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 rounded-lg cursor-pointer" onClick={() => navigate(brandHref("/brand/editor", activeBrandId))}>
              <Palette className="h-4 w-4" />
              Brand Centre
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 rounded-lg cursor-pointer" onClick={() => navigate("/history")}>
              <History className="h-4 w-4" />
              History
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 rounded-lg cursor-pointer" onClick={() => navigate("/report")}>
              <BarChart3 className="h-4 w-4" />
              Report
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 rounded-lg cursor-pointer" onClick={() => navigate("/studio")}>
              <Wand2 className="h-4 w-4" />
              Studio (Manual)
            </DropdownMenuItem>

            {showCreatorNetwork && (
              <DropdownMenuItem className="gap-2 rounded-lg cursor-pointer" onClick={() => navigate("/creator-network")}>
                <Network className="h-4 w-4" />
                Creator Network
              </DropdownMenuItem>
            )}

            {isAffiliate && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 rounded-lg cursor-pointer" onClick={() => navigate("/affiliate")}>
                  <Handshake className="h-4 w-4" />
                  Affiliate Dashboard
                </DropdownMenuItem>
              </>
            )}


            {isPartner && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 rounded-lg cursor-pointer" onClick={() => navigate("/partner")}>
                  <Handshake className="h-4 w-4" />
                  Partner Dashboard
                </DropdownMenuItem>
              </>
            )}


            {isAdmin && !adminLoading && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 rounded-lg cursor-pointer" onClick={() => navigate("/admin")}>
                  <Shield className="h-4 w-4" />
                  Admin Panel
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2 rounded-lg cursor-pointer"
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = "/reports/brandie-creator-network-integration-readiness.md";
                    a.download = "brandie-creator-network-integration-readiness.md";
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                  }}
                >
                  <FileDown className="h-4 w-4" />
                  Creator Network Report
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 rounded-lg cursor-pointer" onClick={() => navigate("/plans")}>
              <CreditCard className="h-4 w-4" />
              Buy Credits
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 rounded-lg cursor-pointer" onClick={() => navigate("/profile")}>
              <User className="h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 rounded-lg cursor-pointer" onClick={() => navigate("/support")}>
              <LifeBuoy className="h-4 w-4" />
              Support
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 rounded-lg cursor-pointer" onClick={() => navigate("/settings")}>
              <Settings className="h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 rounded-lg cursor-pointer"
              onSelect={(e) => {
                e.preventDefault();
                setTheme(isDark ? "light" : "dark");
              }}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {isDark ? "Light mode" : "Dark mode"}
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
