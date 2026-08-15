import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import SEO from "@/components/SEO";
import brandieLogo from "@/assets/brandie-logo.png";

export default function AliasVerify() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [message, setMessage] = useState("Verifying your reply-to address...");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("The verification link is missing a token.");
      return;
    }

    let cancelled = false;
    supabase.functions
      .invoke("email-alias-verify", {
        body: { action: "verify", token },
      })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || data?.error) {
          setStatus("error");
          setMessage(error?.message || data?.error || "Verification failed.");
        } else {
          setStatus("success");
          setMessage(data?.message || "Your reply-to address has been confirmed.");
          toast({ title: "Alias verified", description: "You can now send emails from this identity." });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus("error");
        setMessage(err.message || "An unexpected error occurred.");
      });

    return () => {
      cancelled = true;
    };
  }, [token, toast]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <SEO title="Verify email alias" description="Confirm your Brandie sending alias." noindex />
      <div className="max-w-md w-full text-center">
        <img src={brandieLogo} alt="Brandie" className="h-16 w-16 mx-auto mb-6" />
        <h1 className="text-3xl font-bold tracking-tight mb-2">Verify reply-to address</h1>
        <p className="text-muted-foreground mb-8">{message}</p>

        {status === "verifying" && <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />}
        {status === "success" && (
          <>
            <CheckCircle2 className="h-10 w-10 mx-auto text-green-500 mb-6" />
            <Button onClick={() => navigate("/hub")} className="w-full">
              Go to Outbox
            </Button>
          </>
        )}
        {status === "error" && (
          <>
            <AlertCircle className="h-10 w-10 mx-auto text-destructive mb-6" />
            <Button onClick={() => navigate("/settings")} variant="outline" className="w-full">
              Back to Settings
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
