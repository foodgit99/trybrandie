import { useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBrand } from "@/hooks/useBrand";
import NewAppHeader from "@/components/v2/NewAppHeader";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import { CheckCircle2, LifeBuoy, Loader2, Mail, Clock } from "lucide-react";

const CATEGORIES = [
  { value: "bug", label: "Something's broken" },
  { value: "billing", label: "Billing & credits" },
  { value: "feature_request", label: "Feature request" },
  { value: "account", label: "Account & access" },
  { value: "other", label: "Something else" },
] as const;

const FAQ = [
  {
    q: "When does my autopilot post drop?",
    a: "Autopilot runs at your chosen delivery window each day. If your engine is set to Autonomous and no design landed, check that you still have credits and that your brand is set as the active one.",
  },
  {
    q: "Why didn't I get an email today?",
    a: "Emails are sent the moment a design is rendered. Check your Promotions/Spam tab, and confirm the inbox you signed up with is current under Settings.",
  },
  {
    q: "How do credits work?",
    a: "Free credits are used first, then your subscription credits, then bonus credits, then paid credits. Each design or carousel slide consumes one credit.",
  },
  {
    q: "Can I change my brand colours or fonts later?",
    a: "Yes — open Brand Centre at any time. Existing designs aren't re-rendered, but new ones pick up your changes immediately.",
  },
  {
    q: "Do you offer refunds?",
    a: "Used credits aren't refundable, but we'll always look at unique situations. Send us the details and we'll take it from there.",
  },
];

const Schema = z.object({
  category: z.enum(["bug", "billing", "feature_request", "account", "other"]),
  subject: z.string().trim().min(3, "Add a short subject").max(120),
  message: z.string().trim().min(20, "Tell us a bit more (at least 20 characters)").max(2000),
});

type TicketResult = { ticket_number: string };

export default function Support() {
  const { user } = useAuth();
  const { brand } = useBrand(user);
  const navigate = useNavigate();
  const location = useLocation();

  const [category, setCategory] = useState<typeof CATEGORIES[number]["value"]>("bug");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<TicketResult | null>(null);

  const charCount = message.length;
  const canSubmit = useMemo(
    () => subject.trim().length >= 3 && message.trim().length >= 20 && !submitting,
    [subject, message, submitting],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Schema.safeParse({ category, subject, message });
    if (!parsed.success) {
      const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
      toast.error(first || "Please check the form");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("support-submit", {
        body: {
          ...parsed.data,
          context: {
            route: location.pathname || "/support",
            brand_id: brand?.id ?? null,
            brand_name: (brand as { name?: string } | null)?.name ?? null,
            user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
            viewport: typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : "",
          },
        },
      });
      if (error) throw error;
      const res = data as TicketResult;
      if (!res?.ticket_number) throw new Error("Could not submit ticket");
      setResult(res);
      toast.success("Got it — we'll be in touch soon");
    } catch (err) {
      console.error(err);
      toast.error((err as Error)?.message || "Could not submit your request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Support — Brandie"
        description="Get help from the Brandie team. Report bugs, ask billing questions, or request features."
      />
      <NewAppHeader />

      <main className="container max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <header className="mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-2 text-xs tracking-[0.22em] uppercase text-muted-foreground">
            <LifeBuoy className="h-3.5 w-3.5" />
            Support
          </div>
          <h1 className="mt-3 text-3xl sm:text-4xl font-serif tracking-tight">
            How can we help?
          </h1>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-2xl">
            Send us a message and the Brandie team will get back within 24 hours.
            We'll email you a confirmation with your ticket reference.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
          {/* Form */}
          <section className="lg:col-span-3">
            <div className="rounded-2xl border border-border bg-card p-5 sm:p-7 shadow-sm">
              {result ? (
                <div className="text-center py-6 space-y-5">
                  <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <CheckCircle2 className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">We've got it</h2>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      Your ticket reference is{" "}
                      <span className="font-mono font-semibold text-foreground">
                        {result.ticket_number}
                      </span>
                      .<br className="hidden sm:inline" />
                      Check your inbox at <span className="font-medium text-foreground">{user?.email}</span> for the confirmation.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
                    <Button
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => {
                        setResult(null); setSubject(""); setMessage(""); setCategory("bug");
                      }}
                    >
                      Send another
                    </Button>
                    <Button className="rounded-xl" onClick={() => navigate("/cockpit")}>
                      Back to Brandie
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="category">What's this about?</Label>
                    <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
                      <SelectTrigger id="category" className="rounded-xl h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject</Label>
                    <Input
                      id="subject"
                      value={subject}
                      maxLength={120}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Short summary"
                      className="rounded-xl h-11"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">Message</Label>
                    <Textarea
                      id="message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
                      placeholder="Tell us what happened, what you expected, and any links or screenshots that help."
                      rows={7}
                      className="rounded-xl resize-none"
                      required
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>We auto-include your current page and brand to help us debug.</span>
                      <span>{charCount}/2000</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <p className="text-xs text-muted-foreground hidden sm:block">
                      Sending as <span className="text-foreground">{user?.email}</span>
                    </p>
                    <Button
                      type="submit"
                      disabled={!canSubmit}
                      className="rounded-xl h-11 px-6 sm:ml-auto w-full sm:w-auto"
                    >
                      {submitting ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                      ) : (
                        "Send to support"
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </section>

          {/* Helper */}
          <aside className="lg:col-span-2 space-y-5">
            <div className="rounded-2xl border border-border bg-muted/30 p-5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock className="h-4 w-4 text-primary" />
                Usually within 24 hours
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Weekdays we reply faster — most tickets get a human response the same day.
              </p>
              <div className="mt-4 pt-4 border-t border-border/60 flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a
                  href="mailto:support@trybrandie.com"
                  className="text-foreground hover:underline"
                >
                  support@trybrandie.com
                </a>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold mb-2">Before you write</h3>
              <Accordion type="single" collapsible className="w-full">
                {FAQ.map((item, i) => (
                  <AccordionItem key={i} value={`item-${i}`}>
                    <AccordionTrigger className="text-sm text-left">{item.q}</AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
