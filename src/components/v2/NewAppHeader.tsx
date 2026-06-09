import { useAuth } from "@/hooks/useAuth";
import { useAdminRole } from "@/hooks/useAdminRole";
import brandieLogo from "@/assets/brandie-logo.png";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import BrandSwitcher from "@/components/BrandSwitcher";
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
} from "lucide-react";


const NewAppHeader = () => {
  const { signOut } = useAuth();
  const { isAdmin } = useAdminRole();
  const navigate = useNavigate();

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
        <CreditsBadge />

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
            <DropdownMenuItem className="gap-2 rounded-lg cursor-pointer" onClick={() => navigate("/brands")}>
              <Palette className="h-4 w-4" />
              Manage brands
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
