import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ThemeProvider } from "next-themes";
import { DesignGenerationProvider } from "@/contexts/DesignGenerationContext";
import FloatingDesignStatus from "@/components/FloatingDesignStatus";
import ScrollToTop from "@/components/ScrollToTop";
import FloatingNavBar from "@/components/FloatingNavBar";
import LowCreditsBanner from "@/components/LowCreditsBanner";
import AudiencePromptManager from "@/components/audience/AudiencePromptManager";
import NewFloatingNav from "@/components/v2/NewFloatingNav";
import { useAuth } from "@/hooks/useAuth";
import { useBrand } from "@/hooks/useBrand";
import { useAdminRole } from "@/hooks/useAdminRole";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";
import Landing from "./pages/Landing";
import Index from "./pages/Index";
import BrandCentre from "./pages/BrandCentre";
import DesignStudio from "./pages/DesignStudio";
import DesignHistory from "./pages/DesignHistory";
import Settings from "./pages/Settings";
import Plans from "./pages/Plans";
import AffiliateSignup from "./pages/AffiliateSignup";
import AffiliateDashboard from "./pages/AffiliateDashboard";
import AffiliateMarketing from "./pages/AffiliateMarketing";
import Admin from "./pages/Admin";
import ContentHub from "./pages/ContentHub";
import Cockpit from "./pages/Cockpit";
import NotFound from "./pages/NotFound";

// v2 scaffolds
import V2Landing from "./pages/v2/Landing";
import V2Onboarding from "./pages/v2/Onboarding";
import V2Cockpit from "./pages/v2/Cockpit";
import V2Blueprint from "./pages/v2/Blueprint";
import V2DailyPost from "./pages/v2/DailyPost";
import V2Report from "./pages/v2/Report";
import V2BrandCentre from "./pages/v2/BrandCentre";
import V2Settings from "./pages/v2/Settings";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { brand, isLoading: brandLoading } = useBrand(user);

  if (loading || brandLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!brand || !brand.onboarding_complete) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function OnboardingRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { brand, isLoading: brandLoading } = useBrand(user);

  if (loading || brandLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (brand?.onboarding_complete) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}
function LandingOrDashboard() {
  const { user, loading } = useAuth();
  const { brand, isLoading: brandLoading } = useBrand(user);
  const [v2Enabled, setV2Enabled] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) { setV2Enabled(false); return; }
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("v2_enabled")
        .eq("user_id", user.id)
        .maybeSingle();
      if (alive) setV2Enabled(!!(data as any)?.v2_enabled);
    })();
    return () => { alive = false; };
  }, [user?.id]);

  if (loading || brandLoading || (user && v2Enabled === null)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }
  if (!user) return <Landing />;
  if (v2Enabled) return <Navigate to="/v2/cockpit" replace />;
  if (!brand || !brand.onboarding_complete) return <Navigate to="/onboarding" replace />;
  return <Index />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdminRole();

  if (authLoading || adminLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <DesignGenerationProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          {/* ============ LEGACY (current) — kept fully intact ============ */}
          <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/onboarding" element={<OnboardingRoute><Onboarding /></OnboardingRoute>} />
          <Route path="/" element={<LandingOrDashboard />} />
          <Route path="/dashboard" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          <Route path="/brand" element={<ProtectedRoute><BrandCentre /></ProtectedRoute>} />
          <Route path="/studio" element={<ProtectedRoute><DesignStudio /></ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute><DesignHistory /></ProtectedRoute>} />
          <Route path="/content" element={<ProtectedRoute><ContentHub /></ProtectedRoute>} />
          <Route path="/cockpit" element={<ProtectedRoute><Cockpit /></ProtectedRoute>} />
          <Route path="/briefing" element={<Navigate to="/cockpit#week-blueprint" replace />} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/plans" element={<ProtectedRoute><Plans /></ProtectedRoute>} />
          <Route path="/affiliates" element={<AffiliateMarketing />} />
          <Route path="/affiliate/signup" element={<AffiliateSignup />} />
          <Route path="/affiliate" element={<ProtectedRoute><AffiliateDashboard /></ProtectedRoute>} />
          <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />

          {/* ============ LEGACY mirror under /legacy/* (same components) ============ */}
          <Route path="/legacy" element={<LandingOrDashboard />} />
          <Route path="/legacy/dashboard" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          <Route path="/legacy/brand" element={<ProtectedRoute><BrandCentre /></ProtectedRoute>} />
          <Route path="/legacy/studio" element={<ProtectedRoute><DesignStudio /></ProtectedRoute>} />
          <Route path="/legacy/history" element={<ProtectedRoute><DesignHistory /></ProtectedRoute>} />
          <Route path="/legacy/content" element={<ProtectedRoute><ContentHub /></ProtectedRoute>} />
          <Route path="/legacy/cockpit" element={<ProtectedRoute><Cockpit /></ProtectedRoute>} />
          <Route path="/legacy/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/legacy/plans" element={<ProtectedRoute><Plans /></ProtectedRoute>} />
          <Route path="/legacy/affiliate" element={<ProtectedRoute><AffiliateDashboard /></ProtectedRoute>} />
          <Route path="/legacy/admin" element={<AdminRoute><Admin /></AdminRoute>} />

          {/* ============ NEW v2 experience (Phase A scaffolds) ============ */}
          <Route path="/v2" element={<V2Landing />} />
          <Route path="/v2/onboarding" element={<V2Onboarding />} />
          <Route path="/v2/cockpit" element={<V2Cockpit />} />
          <Route path="/v2/blueprint" element={<V2Blueprint />} />
          <Route path="/v2/post/:dayId" element={<V2DailyPost />} />
          <Route path="/v2/report" element={<V2Report />} />
          <Route path="/v2/brand" element={<V2BrandCentre />} />
          <Route path="/v2/settings" element={<V2Settings />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
        <FloatingDesignStatus />
        <FloatingNavBar />
        <NewFloatingNav />
        <LowCreditsBanner />
        <AudiencePromptManager />
      </BrowserRouter>
      </DesignGenerationProvider>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
