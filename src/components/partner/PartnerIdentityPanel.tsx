import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus } from "lucide-react";

const DOMAIN = "trybrandie.com";

export default function PartnerIdentityPanel({
  partnerId,
  partnerName,
  userId,
}: {
  partnerId: string;
  partnerName: string;
  userId: string;
}) {
  const { toast } = useToast();
  const [handle, setHandle] = useState("");
  const [fromName, setFromName] = useState(partnerName);
  const [replyTo, setReplyTo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: alias, isLoading, refetch } = useQuery({
    queryKey: ["partner-alias", partnerId],
    queryFn: async () => {
      const { data } = await supabase
        .from("email_sender_aliases")
        .select("*")
        .eq("partner_id", partnerId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
  });

  const request = async () => {
    if (!handle || !fromName || !replyTo) {
      toast({ title: "All fields are required", variant: "destructive" });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo)) {
      toast({ title: "Invalid reply-to email", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("email_sender_aliases")
        .insert({
          partner_id: partnerId,
          user_id: userId,
          handle,
          from_name: fromName,
          reply_to: replyTo,
          status: "pending",
        })
        .select("id")
        .single();
      if (error) throw error;
      await supabase.functions.invoke("email-alias-verify", {
        body: { action: "request", alias_id: data.id, handle, reply_to: replyTo, from_name: fromName },
      });
      toast({ title: "Alias requested", description: `Check ${replyTo} to confirm the reply-to address.` });
      setHandle("");
      setReplyTo("");
      refetch();
    } catch (e: any) {
      const msg = String(e.message || "");
      toast({
        title: "Request failed",
        description: msg.includes("ALIAS_HANDLE_RESERVED")
          ? "That handle is reserved. Pick another one."
          : msg.includes("duplicate key")
            ? "That handle is already taken."
            : msg.includes("ALIAS_ALREADY_REQUESTED")
              ? "You already have a pending or approved alias."
              : msg,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const [resending, setResending] = useState(false);

  const describeSendError = (raw: string) => {
    if (raw.includes("daily_quota_exceeded") || raw.includes("sending quota"))
      return "Our email provider hit its daily sending limit. Try again after it resets.";
    if (raw.includes("RESEND_API_KEY")) return "Email sending isn't configured yet.";
    if (raw.includes("unauthorized")) return "Your session expired. Sign in again and retry.";
    if (raw.includes("invalid_reply_to")) return "That reply-to address looks invalid.";
    return raw || "Unknown error";
  };

  const resendVerification = async () => {
    if (!alias) return;
    if (!alias.reply_to) {
      toast({ title: "No reply-to address on file", variant: "destructive" });
      return;
    }
    setResending(true);
    try {
      const { data, error } = await supabase.functions.invoke("email-alias-verify", {
        body: {
          action: "request",
          alias_id: alias.id,
          handle: alias.handle,
          reply_to: alias.reply_to,
          from_name: alias.from_name,
        },
      });

      if (error) {
        let details = error.message;
        // Read the real failure body instead of "non-2xx status code"
        const ctx = (error as any)?.context;
        if (ctx && typeof ctx.text === "function") {
          try {
            details = await ctx.text();
          } catch {
            /* keep original message */
          }
        }
        throw new Error(details);
      }
      if (data?.error) throw new Error(data.details || data.error);

      toast({ title: "Verification email resent", description: `Check ${alias.reply_to}.` });
      refetch();
    } catch (e: any) {
      toast({
        title: "Couldn't resend the email",
        description: describeSendError(String(e?.message || "")),
        variant: "destructive",
      });
    } finally {
      setResending(false);
    }
  };


  const live = alias?.status === "approved" && !!alias?.reply_to_verified_at;

  return (
    <Card className="rounded-2xl max-w-xl">
      <CardHeader>
        <CardTitle>Sending identity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Request your own Brandie sending address so your campaigns and automations arrive from{" "}
          <code className="bg-muted px-1 py-0.5 rounded text-foreground">yourname@{DOMAIN}</code> instead of the
          generic partner address. Replies go to your verified email.
        </p>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your identity
          </div>
        ) : !alias || alias.status === "rejected" ? (
          <div className="space-y-3">
            {alias?.status === "rejected" && (
              <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                Your previous request was rejected{alias.review_note ? `: ${alias.review_note}` : "."} You can request
                another handle.
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Handle (the part before @)</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={handle}
                  onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9.-]/g, ""))}
                  placeholder="amina"
                  className="rounded-xl"
                />
                <span className="text-sm text-muted-foreground whitespace-nowrap">@{DOMAIN}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                3–30 characters. Letters, numbers, dots, and hyphens only.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>From name</Label>
              <Input
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder={partnerName}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Reply-to email</Label>
              <Input
                type="email"
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
                placeholder="you@example.com"
                className="rounded-xl"
              />
            </div>
            <Button
              onClick={request}
              disabled={submitting || !handle || !fromName || !replyTo}
              className="w-full rounded-xl"
            >
              {submitting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Plus className="h-4 w-4 mr-1.5" />}
              Request alias
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium truncate">
                  {alias.from_name}{" "}
                  <span className="text-muted-foreground font-normal">
                    &lt;{alias.handle}@{DOMAIN}&gt;
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Reply-to: {alias.reply_to} {alias.reply_to_verified_at ? "· verified" : "· unverified"}
                </div>
              </div>
              <Badge variant={live ? "default" : "outline"} className="capitalize shrink-0">
                {live ? "Live" : alias.status}
              </Badge>
            </div>

            {!alias.reply_to_verified_at && (
              <div className="rounded-xl bg-muted p-3 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-muted-foreground">
                  Confirm your reply-to address to finish setting up this sender.
                </span>
                <Button size="sm" variant="outline" onClick={resendVerification} className="rounded-xl shrink-0">
                  Resend email
                </Button>
              </div>
            )}

            {alias.status === "pending" && (
              <div className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
                Pending Brandie review. Your emails keep sending from the generic partner address until it is approved.
              </div>
            )}

            {live && (
              <div className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
                All your campaigns and automations now send from this address.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
