import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";

const VALID = ["light", "dark", "system"] as const;

/**
 * Keeps the local next-themes choice in sync with the signed-in user's
 * `profiles.theme_preference`, so the appearance follows them across devices.
 */
export function useThemeSync() {
  const { theme, setTheme } = useTheme();
  const hydrated = useRef(false);
  const remote = useRef<string | null>(null);
  const userId = useRef<string | null>(null);

  // Pull the stored preference once a session exists.
  useEffect(() => {
    let cancelled = false;

    const load = async (uid: string | null) => {
      userId.current = uid;
      if (!uid) {
        hydrated.current = false;
        remote.current = null;
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("theme_preference")
        .eq("user_id", uid)
        .maybeSingle();
      if (cancelled) return;
      const pref = (data as any)?.theme_preference as string | undefined;
      if (pref && (VALID as readonly string[]).includes(pref)) {
        remote.current = pref;
        setTheme(pref);
      }
      hydrated.current = true;
    };

    supabase.auth.getSession().then(({ data }) => load(data.session?.user?.id ?? null));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      const uid = session?.user?.id ?? null;
      if (uid !== userId.current) {
        hydrated.current = false;
        setTimeout(() => load(uid), 0);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [setTheme]);

  // Push local changes back to the profile.
  useEffect(() => {
    if (!hydrated.current || !userId.current || !theme) return;
    if (!(VALID as readonly string[]).includes(theme)) return;
    if (theme === remote.current) return;
    remote.current = theme;
    supabase
      .from("profiles")
      .update({ theme_preference: theme } as any)
      .eq("user_id", userId.current)
      .then(() => {}, () => {});
  }, [theme]);
}

export function ThemeSync() {
  useThemeSync();
  return null;
}
