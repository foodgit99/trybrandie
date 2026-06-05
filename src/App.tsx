import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
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
import LegacyOnboarding from "./pages/Onboarding";
import LegacyLanding from "./pages/Landing";
import LegacyIndex from "./pages/Index";
import LegacyBrandCentre from "./pages/BrandCentre";
import DesignStudio from "./pages/DesignStudio";
import DesignHistory from "./pages/DesignHistory";
import LegacySettings from "./pages/Settings";
import Plans from "./pages/Plans";
import AffiliateSignup from "./pages/AffiliateSignup";
import AffiliateDashboard from "./pages/AffiliateDashboard";
import AffiliateMarketing from "./pages/AffiliateMarketing";
import Admin from "./pages/Admin";
import ContentHub from "./pages/ContentHub";
import LegacyCockpit from "./pages/Cockpit";
import NotFound from "./pages/NotFound";

// v2 (now primary) experience
import V2Landing from "./pages/v2/Landing";
import V2Onboarding from "./pages/v2/Onboarding";
import V2Cockpit from "./pages/v2/Cockpit";
import V2Blueprint from "./pages/v2/Blueprint";
import V2DailyPost from "./pages/v2/DailyPost";
import V2Report from "./pages/v2/Report";
import V2BrandCentre from "./pages/v2/BrandCentre";
import V2Settings from "./pages/v2/Settings";
import V2Engine from "./pages/v2/Engine";
import V2ContentHub from "./pages/v2/ContentHubV2";

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

function LandingOrCockpit() {
  const { user, loading } = useAuth();
  const { brand, isLoading: brandLoading } = useBrand(user);

  if (loading || brandLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }
  if (!user) return <V2Landing />;
  if (!brand || !brand.onboarding_complete) return <Navigate to="/onboarding" replace />;
  return <Navigate to="/cockpit" replace />;
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

// Preserve old /v2/post/:dayId bookmarks
function PostRedirect() {
  const { dayId } = useParams();
  return <Navigate to={`/post/${dayId}`} replace />;
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
          {/* ============ PRIMARY (v2) experience ============ */}
          <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/" element={<LandingOrCockpit />} />
          <Route path="/onboarding" element={<OnboardingRoute><V2Onboarding /></OnboardingRoute>} />
          <Route path="/cockpit" element={<ProtectedRoute><V2Cockpit /></ProtectedRoute>} />
          <Route path="/blueprint" element={<ProtectedRoute><V2Blueprint /></ProtectedRoute>} />
          <Route path="/post/:dayId" element={<ProtectedRoute><V2DailyPost /></ProtectedRoute>} />
          <Route path="/report" element={<ProtectedRoute><V2Report /></ProtectedRoute>} />
          <Route path="/brand" element={<ProtectedRoute><V2BrandCentre /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><V2Settings /></ProtectedRoute>} />
          <Route path="/engine" element={<ProtectedRoute><V2Engine /></ProtectedRoute>} />
          <Route path="/content-hub" element={<ProtectedRoute><V2ContentHub /></ProtectedRoute>} />

          {/* Shared / utility surfaces (no v2 equivalent yet) */}
          <Route path="/studio" element={<ProtectedRoute><V2Studio /></ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute><DesignHistory /></ProtectedRoute>} />
          <Route path="/content" element={<ProtectedRoute><ContentHub /></ProtectedRoute>} />
          <Route path="/plans" element={<ProtectedRoute><Plans /></ProtectedRoute>} />
          <Route path="/affiliates" element={<AffiliateMarketing />} />
          <Route path="/affiliate/signup" element={<AffiliateSignup />} />
          <Route path="/affiliate" element={<ProtectedRoute><AffiliateDashboard /></ProtectedRoute>} />
          <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />

          {/* Bookmark shims */}
          <Route path="/dashboard" element={<Navigate to="/cockpit" replace />} />
          <Route path="/briefing" element={<Navigate to="/cockpit#week-blueprint" replace />} />
          <Route path="/v2" element={<Navigate to="/" replace />} />
          <Route path="/v2/onboarding" element={<Navigate to="/onboarding" replace />} />
          <Route path="/v2/cockpit" element={<Navigate to="/cockpit" replace />} />
          <Route path="/v2/blueprint" element={<Navigate to="/blueprint" replace />} />
          <Route path="/v2/report" element={<Navigate to="/report" replace />} />
          <Route path="/v2/brand" element={<Navigate to="/brand" replace />} />
          <Route path="/v2/settings" element={<Navigate to="/settings" replace />} />
          <Route path="/v2/post/:dayId" element={<PostRedirect />} />

          {/* ============ LEGACY mirror under /legacy/* ============ */}
          <Route path="/legacy" element={<ProtectedRoute><LegacyIndex /></ProtectedRoute>} />
          <Route path="/legacy/dashboard" element={<ProtectedRoute><LegacyIndex /></ProtectedRoute>} />
          <Route path="/legacy/onboarding" element={<OnboardingRoute><LegacyOnboarding /></OnboardingRoute>} />
          <Route path="/legacy/landing" element={<LegacyLanding />} />
          <Route path="/legacy/brand" element={<ProtectedRoute><LegacyBrandCentre /></ProtectedRoute>} />
          <Route path="/legacy/studio" element={<ProtectedRoute><DesignStudio /></ProtectedRoute>} />
          <Route path="/legacy/history" element={<ProtectedRoute><DesignHistory /></ProtectedRoute>} />
          <Route path="/legacy/content" element={<ProtectedRoute><ContentHub /></ProtectedRoute>} />
          <Route path="/legacy/cockpit" element={<ProtectedRoute><LegacyCockpit /></ProtectedRoute>} />
          <Route path="/legacy/settings" element={<ProtectedRoute><LegacySettings /></ProtectedRoute>} />
          <Route path="/legacy/plans" element={<ProtectedRoute><Plans /></ProtectedRoute>} />
          <Route path="/legacy/affiliate" element={<ProtectedRoute><AffiliateDashboard /></ProtectedRoute>} />
          <Route path="/legacy/admin" element={<AdminRoute><Admin /></AdminRoute>} />

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
