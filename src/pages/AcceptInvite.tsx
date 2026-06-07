import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBrand } from "@/hooks/useBrand";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertCircle, MailWarning } from "lucide-react";
import SEO from "@/components/SEO";

type State =
  | { status: "loading" }
  | { status: "success"; brand_id: string; brand_name: string }
  | { status: "email_mismatch"; invited: string; signed_in: string }
  | { status: "not_found" }
  | { status: "error"; message: string };

const AcceptInvite = () => {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading } = useAuth();
  const { setActiveBrand, refetch } = useBrand(user);
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ status: "loading" });

  // Bounce to auth if not signed in
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      const next = encodeURIComponent(`/invite/${token ?? ""}`);
      navigate(`/auth?next=${next}`, { replace: true });
    }
  }, [authLoading, user, token, navigate]);

  // Accept once signed in
  useEffect(() => {
    if (authLoading || !user || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("team-invite-accept", {
          body: { token },
        });
        if (cancelled) return;
        if (error) {
          // FunctionsHttpError surfaces structured payload in error.context
          const ctx = (error as any).context;
          let parsed: any = null;
          try {
            parsed = ctx ? await ctx.json() : null;
          } catch {
            /* noop */
          }
          const code = parsed?.error;
          if (code === "email_mismatch") {
            setState({
              status: "email_mismatch",
              invited: parsed.invited_email,
              signed_in: parsed.signed_in_email,
            });
            return;
          }
          if (code === "not_found" || code === "revoked") {
            setState({ status: "not_found" });
            return;
          }
          setState({ status: "error", message: parsed?.error || error.message });
          return;
        }
        await refetch();
        setActiveBrand(data.brand_id);
        setState({ status: "success", brand_id: data.brand_id, brand_name: data.brand_name });
        setTimeout(() => navigate("/cockpit", { replace: true }), 1400);
      } catch (e: any) {
        if (!cancelled) setState({ status: "error", message: e?.message || "Unknown error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, token, navigate, refetch, setActiveBrand]);

  const signOut = async () => {
    await supabase.auth.signOut();
    const next = encodeURIComponent(`/invite/${token ?? ""}`);
    navigate(`/auth?next=${next}`, { replace: true });
  };

  return (
    <div className="min-h-dvh bg-background grid place-items-center px-5">
      <SEO title="Accept invite, Brandie" path={`/invite/${token ?? ""}`} noindex />
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center space-y-4">
        {state.status === "loading" && (
          <>
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
            <h1 className="font-serif text-2xl">Accepting your invitation…</h1>
            <p className="text-sm text-muted-foreground">One moment.</p>
          </>
        )}
        {state.status === "success" && (
          <>
            <CheckCircle2 className="h-8 w-8 text-primary mx-auto" />
            <h1 className="font-serif text-2xl">Welcome to {state.brand_name}</h1>
            <p className="text-sm text-muted-foreground">
              Taking you to the cockpit…
            </p>
          </>
        )}
        {state.status === "email_mismatch" && (
          <>
            <MailWarning className="h-8 w-8 text-destructive mx-auto" />
            <h1 className="font-serif text-2xl">Wrong email</h1>
            <p className="text-sm text-muted-foreground">
              This invite was sent to <strong>{state.invited}</strong>, but you're signed in as{" "}
              <strong>{state.signed_in}</strong>.
            </p>
            <Button onClick={signOut} className="rounded-full mt-2">
              Sign out & switch account
            </Button>
          </>
        )}
        {state.status === "not_found" && (
          <>
            <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
            <h1 className="font-serif text-2xl">Invite expired</h1>
            <p className="text-sm text-muted-foreground">
              This invitation link is no longer valid. Ask the brand owner to send a new one.
            </p>
            <Button onClick={() => navigate("/")} variant="secondary" className="rounded-full mt-2">
              Go home
            </Button>
          </>
        )}
        {state.status === "error" && (
          <>
            <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
            <h1 className="font-serif text-2xl">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">{state.message}</p>
            <Button onClick={() => navigate("/")} variant="secondary" className="rounded-full mt-2">
              Go home
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default AcceptInvite;
