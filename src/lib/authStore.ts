import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

/**
 * Shared, module-level auth store.
 *
 * The Supabase JS client serialises every session read/refresh behind a single
 * browser-wide exclusive Navigator LockManager lock keyed on the auth token.
 * Calling `getSession()` / `getUser()` from dozens of mounted hooks (and from
 * many components that only want a bearer token) causes lock contention, and on
 * slow mobile connections with several tabs open the lock acquisition times out
 * after 10s:
 *
 *   Acquiring an exclusive Navigator LockManager lock
 *   "lock:sb-...-auth-token" timed out waiting 10000ms
 *
 * This store performs exactly ONE `getSession()` and at most ONE validating
 * `getUser()` per page load, keeps one `onAuthStateChange` subscription, and
 * serves everything else from memory.
 */

export type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

let state: AuthState = { session: null, user: null, loading: true };
const listeners = new Set<(s: AuthState) => void>();

function emit() {
  for (const l of listeners) l(state);
}

function setState(next: Partial<AuthState>) {
  state = { ...state, ...next };
  emit();
}

/** Transient browser lock contention — never a signal that the session is bad. */
export function isLockTimeoutError(err: any): boolean {
  const msg = String(err?.message ?? err ?? "").toLowerCase();
  return (
    msg.includes("lockmanager") ||
    (msg.includes("lock") && msg.includes("timed out"))
  );
}

/**
 * Errors that mean the locally cached session is no longer trustworthy
 * (signing key rotation, deleted user, malformed/expired JWT, etc.).
 */
export function isInvalidSessionError(err: any): boolean {
  if (!err) return false;
  if (isLockTimeoutError(err)) return false;
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

export async function clearLocalSession() {
  try {
    await supabase.auth.signOut({ scope: "local" } as any);
  } catch {
    /* ignore */
  }
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("sb-"))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

let subscribed = false;
function ensureSubscription() {
  if (subscribed) return;
  subscribed = true;
  supabase.auth.onAuthStateChange((_event, session) => {
    setState({ session, user: session?.user ?? null, loading: false });
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** getSession with one retry on transient lock timeouts. */
async function readSessionOnce(): Promise<Session | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { data } = await supabase.auth.getSession();
      return data.session ?? null;
    } catch (err) {
      if (attempt === 0 && isLockTimeoutError(err)) {
        await sleep(600);
        continue;
      }
      // Never let a lock timeout look like a signed-out user to callers that
      // can retry; but don't hang the app either.
      if (isLockTimeoutError(err)) return null;
      throw err;
    }
  }
  return null;
}

let initPromise: Promise<AuthState> | null = null;

/**
 * Resolve the current auth state. Deduped: concurrent callers share one
 * `getSession()` and one validating `getUser()`.
 */
export function ensureAuth(): Promise<AuthState> {
  ensureSubscription();
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const localSession = await readSessionOnce();

    if (!localSession) {
      setState({ session: null, user: null, loading: false });
      return state;
    }

    // Optimistically publish the cached session so the UI renders immediately.
    setState({ session: localSession, user: localSession.user ?? null, loading: false });

    // Validate the cached session server-side exactly once per page load.
    try {
      const { data: userData, error } = await supabase.auth.getUser();
      if (error && isLockTimeoutError(error)) {
        return state; // transient — keep the cached session
      }
      if (error ? isInvalidSessionError(error) : !userData?.user) {
        await clearLocalSession();
        setState({ session: null, user: null, loading: false });
        return state;
      }
      if (userData?.user) {
        setState({ user: userData.user, loading: false });
      }
    } catch (err) {
      if (!isLockTimeoutError(err)) {
        // Network / unexpected failure — keep the cached session rather than
        // trapping a signed-in user on /auth.
        console.warn("[auth] session validation failed", err);
      }
    }
    return state;
  })();

  return initPromise;
}

export function getAuthState(): AuthState {
  return state;
}

export function subscribeAuth(listener: (s: AuthState) => void): () => void {
  ensureSubscription();
  listeners.add(listener);
  void ensureAuth();
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Bearer token for edge-function calls, served from memory whenever possible.
 * Use this instead of `supabase.auth.getSession()` when you only need a token.
 */
export async function getAccessToken(): Promise<string | null> {
  if (state.session?.access_token) {
    const expiresAt = state.session.expires_at ? state.session.expires_at * 1000 : 0;
    // Only fall back to the client (which takes the lock to refresh) when the
    // cached token is expired or about to expire.
    if (!expiresAt || expiresAt - Date.now() > 30_000) {
      return state.session.access_token;
    }
  }
  const session = await readSessionOnce();
  if (session) setState({ session, user: session.user ?? null, loading: false });
  return session?.access_token ?? null;
}

export async function signOut() {
  await supabase.auth.signOut();
  setState({ session: null, user: null, loading: false });
}
