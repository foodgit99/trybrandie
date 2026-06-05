import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Returns a handler that navigates back to the previous in-app page when
 * possible, falling back to the provided route when the user landed on this
 * page directly (deep link, refresh, external referrer).
 */
export function useSmartBack(fallback: string = "/") {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(() => {
    // react-router sets location.key to "default" for the initial entry, so
    // any other value means we have in-app history we can pop.
    if (location.key && location.key !== "default") {
      navigate(-1);
    } else {
      navigate(fallback, { replace: true });
    }
  }, [navigate, location.key, fallback]);
}
