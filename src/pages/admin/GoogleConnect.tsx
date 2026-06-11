import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  AlertTriangle, CheckCircle2, Copy, Eye, EyeOff, Link as LinkIcon,
  Loader2, LogOut, RefreshCw, Shield,
} from "lucide-react";

type StatusToken = {
  google_email: string;
  scopes: string[];
  expires_at: string | null;
  updated_at: string;
} | null;

type RevealToken = {
  google_email: string;
  refresh_token: string;
  access_token: string | null;
  expires_at: string | null;
  scopes: string[];
};

export default function GoogleConnect() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [token, setToken] = useState<StatusToken>(null);
  const [reveal, setReveal] = useState<RevealToken | null>(null);
  const [showRefresh, setShowRefresh] = useState(false);

  const loadStatus = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("google-access-token", {
      body: { action: "status" },
    });
    if (error) {
      toast.error(error.message || "Could not load status");
    } else {
      setToken((data as { token: StatusToken })?.token ?? null);
    }
    setLoading(false);
  };

  useEffect(() => {
    const status = params.get("status");
    const message = params.get("message");
    if (status === "ok") toast.success(`Connected as ${params.get("email") || "Google account"}`);
    if (status === "error") toast.error(message ? decodeURIComponent(message) : "Connection failed");
    if (status) {
      const next = new URLSearchParams(params);
      ["status", "message", "email"].forEach((k) => next.delete(k));
      setParams(next, { replace: true });
    }
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = async () => {
    setWorking("connect");
    try {
      const { data, error } = await supabase.functions.invoke("google-oauth-start", {
        body: { origin: window.location.origin },
      });
      if (error) throw error;
      const url = (data as { url?: string })?.url;
      if (!url) throw new Error("No url returned");
      window.location.href = url;
    } catch (e) {
      toast.error((e as Error).message || "Could not start connect flow");
      setWorking(null);
    }
  };

  const refresh = async () => {
    setWorking("refresh");
    try {
      const { data, error } = await supabase.functions.invoke("google-access-token", {
        body: { action: "refresh" },
      });
      if (error) throw error;
      toast.success("Access token refreshed");
      await loadStatus();
      if (reveal) setReveal({ ...reveal, access_token: (data as { access_token: string }).access_token });
    } catch (e) {
      toast.error((e as Error).message || "Refresh failed");
    } finally { setWorking(null); }
  };

  const disconnect = async () => {
    if (!confirm("Disconnect this Google account and revoke its refresh token?")) return;
    setWorking("disconnect");
    try {
      const { error } = await supabase.functions.invoke("google-access-token", {
        body: { action: "disconnect" },
      });
      if (error) throw error;
      toast.success("Disconnected");
      setToken(null); setReveal(null); setShowRefresh(false);
    } catch (e) {
      toast.error((e as Error).message || "Disconnect failed");
    } finally { setWorking(null); }
  };

  const revealTokens = async () => {
    setWorking("reveal");
    try {
      const { data, error } = await supabase.functions.invoke("google-access-token", {
        body: { action: "reveal" },
      });
      if (error) throw error;
      setReveal(data as RevealToken);
    } catch (e) {
      toast.error((e as Error).message || "Could not load token");
    } finally { setWorking(null); }
  };

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Clipboard blocked");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs tracking-[0.22em] uppercase text-muted-foreground">
              <Shield className="h-3.5 w-3.5" />
              Admin · Integrations
            </div>
            <h1 className="mt-3 text-3xl font-serif tracking-tight">Google connection</h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-xl">
              Authorize Brandie to act on your Google account (Gmail + Analytics) using an offline refresh token.
              The token is stored encrypted at rest and only revealed to admins on demand.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/admin")}>Back to admin</Button>
        </div>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LinkIcon className="h-4 w-4" />
              Connection status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : token ? (
              <>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{token.google_email}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Last refreshed {new Date(token.updated_at).toLocaleString()}
                      {token.expires_at && ` · expires ${new Date(token.expires_at).toLocaleString()}`}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {token.scopes.map((s) => (
                    <Badge key={s} variant="secondary" className="font-mono text-[10px]">
                      {s.replace("https://www.googleapis.com/auth/", "")}
                    </Badge>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button variant="outline" onClick={refresh} disabled={!!working}>
                    {working === "refresh" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Refresh access token
                  </Button>
                  <Button variant="outline" onClick={connect} disabled={!!working}>
                    Reconnect
                  </Button>
                  <Button variant="outline" onClick={disconnect} disabled={!!working}>
                    {working === "disconnect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                    Disconnect
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    No Google account connected yet. Click below to grant offline access.
                    You'll be sent to Google to approve the scopes.
                  </p>
                </div>
                <Button onClick={connect} disabled={!!working} className="rounded-xl">
                  {working === "connect" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Connect Google
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {token && (
          <Card className="rounded-2xl mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4" />
                Tokens
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!reveal ? (
                <Button variant="outline" onClick={revealTokens} disabled={!!working}>
                  {working === "reveal" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                  Reveal tokens
                </Button>
              ) : (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs uppercase tracking-wider text-muted-foreground">Refresh token</label>
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => setShowRefresh((v) => !v)}>
                          {showRefresh ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => copy("Refresh token", reveal.refresh_token)}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <pre className="text-xs font-mono bg-muted/60 rounded-lg p-3 overflow-x-auto break-all whitespace-pre-wrap">
{showRefresh ? reveal.refresh_token : "•".repeat(48)}
                    </pre>
                  </div>

                  {reveal.access_token && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs uppercase tracking-wider text-muted-foreground">Current access token</label>
                        <Button size="sm" variant="ghost" onClick={() => copy("Access token", reveal.access_token!)}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <pre className="text-xs font-mono bg-muted/60 rounded-lg p-3 overflow-x-auto break-all whitespace-pre-wrap">
{reveal.access_token}
                      </pre>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
