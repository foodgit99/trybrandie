import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

// Errors that mean the locally cached session is no longer trustworthy
// (signing key rotation, deleted user, malformed/expired JWT, etc.).
function isInvalidSessionError(err: any): boolean {
  if (!err) return false;
  const status = err.status ?? err.statusCode;
  const code = String(err.code ?? err.error_code ?? "").toLowerCase();
  const msg = String(err.message ?? "").toLowerCase();
  if (status === 401 || status === 403) return true;
  if (
    code.includes("bad_jwt") ||
    code.includes("invalid_claim") ||
    code.includes("user_not_found") ||
    code.includes("session_not_found")
  ) {
    return true;
  }
  if (
    msg.includes("invalid claim") ||
    msg.includes("missing sub") ||
    msg.includes("jwt") ||
    msg.includes("user not found")
  ) {
    return true;
  }
  return false;
}

async function clearLocalSession() {
  try {
    await supabase.auth.signOut({ scope: "local" } as any);
  } catch {
    /* ignore */
  }
  // Belt and braces — strip any leftover sb-* keys.
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("sb-"))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    (async () => {
      const { data: { session: localSession } } = await supabase.auth.getSession();

      if (!localSession) {
        if (!cancelled) {
          setSession(null);
          setUser(null);
          setLoading(false);
        }
        return;
      }

      // Validate the cached session server-side. If it's stale / signing keys
      // rotated, drop it so routing falls through to /auth instead of trapping
      // the user on /onboarding.
      const { data: userData, error } = await supabase.auth.getUser();

      if (cancelled) return;

      if (error || !userData?.user) {
        if (isInvalidSessionError(error) || !userData?.user) {
          await clearLocalSession();
          if (cancelled) return;
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }
      }

      setSession(localSession);
      setUser(userData?.user ?? localSession.user ?? null);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, session, loading, signOut };
}
