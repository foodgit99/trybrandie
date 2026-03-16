import { Plus } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const FloatingCreateButton = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // Hide on studio, landing, auth, and onboarding pages
  const hiddenRoutes = ["/studio", "/auth", "/onboarding", "/reset-password"];
  if (!user || hiddenRoutes.some((r) => location.pathname.startsWith(r))) return null;

  return (
    <button
      onClick={() => navigate("/studio")}
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-foreground text-background shadow-lg transition-transform duration-200 hover:scale-110 active:scale-95"
      style={{
        boxShadow:
          "0 0 20px hsl(var(--foreground) / 0.25), 0 0 40px hsl(var(--foreground) / 0.1)",
      }}
      aria-label="Create new design"
    >
      <Plus className="h-6 w-6" strokeWidth={2.5} />
    </button>
  );
};

export default FloatingCreateButton;
