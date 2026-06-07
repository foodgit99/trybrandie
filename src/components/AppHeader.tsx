import { useAuth } from "@/hooks/useAuth";
import { useAdminRole } from "@/hooks/useAdminRole";
import brandieLogo from "@/assets/brandie-logo.png";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
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
  Plus,
  Palette,
  Clock,
  Settings,
  CreditCard,
  LogOut,
  Shield,
  Layers,
} from "lucide-react";

const AppHeader = () => {
  const { signOut } = useAuth();
  const { isAdmin } = useAdminRole();
  const navigate = useNavigate();

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
          <span className="text-muted-foreground hidden sm:inline">credits</span>
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
              onClick={() => navigate("/content")}
            >
              <Layers className="h-4 w-4" />
              Content Hub
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 rounded-lg cursor-pointer"
              onClick={() => navigate("/history")}
            >
              <Clock className="h-4 w-4" />
              Design History
            </DropdownMenuItem>
            {isAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2 rounded-lg cursor-pointer"
                  onClick={() => navigate("/admin")}
                >
                  <Shield className="h-4 w-4" />
                  Admin Panel
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 rounded-lg cursor-pointer"
              onClick={() => navigate("/plans")}
            >
              <CreditCard className="h-4 w-4" />
              Buy Credits
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
