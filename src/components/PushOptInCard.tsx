import { useEffect, useState } from "react";
import { Bell, BellOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { currentPermission, detectPushSupport, enablePush, hasLocalPushToken } from "@/lib/push";
import { gaEvent } from "@/lib/ga";

const DISMISS_KEY = "brandie:push:dismissed_at";
const DISMISS_DAYS = 14;

export default function PushOptInCard() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const support = detectPushSupport();
    if (!support.supported) {
      // Only show iOS "install first" hint, hide everything else silently.
      if (support.reason === "ios-not-installed") {
        setReason("ios");
        setVisible(!isDismissed());
      }
      return;
    }
    const perm = currentPermission();
    if (perm === "granted" && hasLocalPushToken()) return;
    if (perm === "denied") return;
    if (isDismissed()) return;
    setVisible(true);
  }, [user]);

  const isDismissed = () => {
    try {
      const v = localStorage.getItem(DISMISS_KEY);
      if (!v) return false;
      const ts = Number(v);
      if (!Number.isFinite(ts)) return false;
      return Date.now() - ts < DISMISS_DAYS * 86400000;
    } catch { return false; }
  };

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    setVisible(false);
    gaEvent("push_optin_dismissed", { reason: reason || "default" });
  };

  const onEnable = async () => {
    setLoading(true);
    const res = await enablePush();
    setLoading(false);
    if (res.ok) {
      gaEvent("push_optin_enabled");
      toast({ title: "Notifications on", description: "We'll ping you when today's post is ready." });
      setVisible(false);
    } else {
      gaEvent("push_optin_failed", { error: res.error });
      toast({
        title: "Couldn't enable notifications",
        description: res.error === "permission-denied"
          ? "You blocked notifications. Enable them from your browser settings."
          : "Try again in a moment.",
        variant: "destructive",
      });
    }
  };

  if (!visible) return null;

  if (reason === "ios") {
    return (
      <Card className="p-4 flex items-start gap-3 border-border/60">
        <div className="rounded-full bg-muted p-2"><BellOff className="h-4 w-4 text-muted-foreground" /></div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">Get post-ready alerts on iPhone</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tap the Share icon in Safari → <span className="font-medium">Add to Home Screen</span>, open Brandie from the icon, then enable alerts.
          </p>
        </div>
        <button onClick={dismiss} className="text-muted-foreground hover:text-foreground" aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      </Card>
    );
  }

  return (
    <Card className="p-4 flex items-start gap-3 border-border/60">
      <div className="rounded-full bg-primary/10 p-2"><Bell className="h-4 w-4 text-primary" /></div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">Get post-ready alerts</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          We'll notify you the moment today's autopilot post is ready to share.
        </p>
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={onEnable} disabled={loading}>
            {loading ? "Enabling…" : "Turn on alerts"}
          </Button>
          <Button size="sm" variant="ghost" onClick={dismiss}>Not now</Button>
        </div>
      </div>
      <button onClick={dismiss} className="text-muted-foreground hover:text-foreground" aria-label="Dismiss">
        <X className="h-4 w-4" />
      </button>
    </Card>
  );
}
