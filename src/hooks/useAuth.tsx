import { useEffect, useState } from "react";
import {
  getAuthState,
  subscribeAuth,
  signOut as storeSignOut,
  type AuthState,
} from "@/lib/authStore";

/**
 * Thin subscriber over the shared auth store. Mounting this hook many times is
 * cheap: the store performs a single getSession()/getUser() per page load, so we
 * never contend on the Supabase auth token lock.
 */
export function useAuth() {
  const [state, setState] = useState<AuthState>(() => getAuthState());

  useEffect(() => subscribeAuth(setState), []);

  return {
    user: state.user,
    session: state.session,
    loading: state.loading,
    signOut: storeSignOut,
  };
}
