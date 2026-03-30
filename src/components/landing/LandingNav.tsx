import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import brandieLogo from "@/assets/brandie-logo.png";

const LandingNav = () => {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-4 sm:px-8 py-4 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <img src={brandieLogo} alt="Brandie" className="h-8 w-8" />
        <span className="text-xl font-serif tracking-tight">Brandie</span>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => navigate("/auth")}>
          Sign in
        </Button>
        <Button size="sm" className="rounded-xl" onClick={() => navigate("/auth?mode=signup")}>
          Get started
        </Button>
      </div>
    </header>
  );
};

export default LandingNav;
