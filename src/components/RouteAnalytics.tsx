import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { gaPageView, gaSetUserId } from "@/lib/ga";
import { useAuth } from "@/hooks/useAuth";

const RouteAnalytics = () => {
  const { pathname, search } = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    gaPageView(pathname + search);
  }, [pathname, search]);

  useEffect(() => {
    gaSetUserId(user?.id ?? null);
  }, [user?.id]);

  return null;
};

export default RouteAnalytics;
