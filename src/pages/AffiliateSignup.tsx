import SEO from "@/components/SEO";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { AnimatePresence, motion } from "framer-motion";
import brandieLogo from "@/assets/brandie-logo.png";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Users2,
  Sparkles,
  Megaphone,
  Target,
  ShieldCheck,
  Mail,
  Phone,
  MapPin,
  Loader2,
  PartyPopper,
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────────────────
   Option catalogues — keep in sync with admin filters
   ────────────────────────────────────────────────────────────────────────── */

const CHANNELS = [
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "x", label: "X / Twitter" },
  { id: "youtube", label: "YouTube" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "newsletter", label: "Newsletter / Blog" },
  { id: "podcast", label: "Podcast" },
  { id: "whatsapp", label: "WhatsApp community" },
  { id: "telegram", label: "Telegram community" },
  { id: "other", label: "Other" },
];

const AUDIENCE_SIZES = [
  { id: "under_1k", label: "Under 1,000" },
  { id: "1k_5k", label: "1,000 – 5,000" },
  { id: "5k_25k", label: "5,000 – 25,000" },
  { id: "25k_100k", label: "25,000 – 100,000" },
  { id: "100k_plus", label: "100,000+" },
];

const AUDIENCE_TYPES = [
  { id: "smb_owners", label: "Small business owners" },
  { id: "solopreneurs", label: "Solopreneurs / founders" },
  { id: "creators", label: "Content creators / influencers" },
  { id: "agencies", label: "Agencies / freelancers" },
  { id: "marketers", label: "In-house marketers" },
  { id: "students", label: "Students / early career" },
  { id: "other", label: "Other" },
];

const REGIONS = [
  { id: "nigeria", label: "Nigeria" },
  { id: "west_africa", label: "Rest of West Africa" },
  { id: "africa", label: "Rest of Africa" },
  { id: "europe", label: "Europe" },
  { id: "north_america", label: "North America" },
  { id: "asia", label: "Asia" },
  { id: "global", label: "Global / mixed" },
];

const CONTENT_TYPES = [
  { id: "reels", label: "Short-form video (Reels / TikTok)" },
  { id: "feed_posts", label: "Feed posts / carousels" },
  { id: "stories", label: "Stories" },
  { id: "threads", label: "Threads / long-form posts" },
  { id: "newsletter", label: "Newsletter / blog" },
  { id: "youtube", label: "Long-form video / YouTube" },
  { id: "livestream", label: "Livestreams / spaces" },
  { id: "dm_outreach", label: "1:1 DM / WhatsApp outreach" },
];

const CADENCE = [
  { id: "daily", label: "Daily" },
  { id: "few_per_week", label: "A few times a week" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "A few times a month" },
  { id: "occasional", label: "Occasional / campaign-based" },
];

/* ──────────────────────────────────────────────────────────────────────────
   Wizard config
   ────────────────────────────────────────────────────────────────────────── */

type StepId =
  | "welcome"
  | "account"
  | "contact"
  | "audience"
  | "fit"
  | "promo"
  | "agree"
  | "done";

const STEPS: { id: StepId; label: string; icon: any }[] = [
  { id: "account", label: "Account", icon: Mail },
  { id: "contact", label: "Contact", icon: Phone },
  { id: "audience", label: "Audience", icon: Users2 },
  { id: "fit", label: "Fit", icon: Sparkles },
  { id: "promo", label: "Plan", icon: Megaphone },
  { id: "agree", label: "Review", icon: ShieldCheck },
];

const fadeSlide = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
};

/* ──────────────────────────────────────────────────────────────────────────
   Component
   ────────────────────────────────────────────────────────────────────────── */

const AffiliateSignup = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get("ref") || "";

  const [step, setStep] = useState<StepId>("welcome");
  const [submitting, setSubmitting] = useState(false);

  // Account
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");

  // Contact
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [location, setLocation] = useState("");

  // Audience
  const [primaryChannel, setPrimaryChannel] = useState<string>("");
  const [channelHandle, setChannelHandle] = useState("");
  const [channelUrl, setChannelUrl] = useState("");
  const [audienceSize, setAudienceSize] = useState<string>("");
  const [niche, setNiche] = useState("");
  const [audienceTypes, setAudienceTypes] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);

  // Fit
  const [usedBrandie, setUsedBrandie] = useState<"yes" | "no" | "">("");
  const [brandieExperience, setBrandieExperience] = useState("");
  const [whyJoin, setWhyJoin] = useState("");

  // Promo
  const [contentTypes, setContentTypes] = useState<string[]>([]);
  const [postingCadence, setPostingCadence] = useState<string>("");
  const [promoPlan, setPromoPlan] = useState("");

  // Agree
  const [agreedDisclosure, setAgreedDisclosure] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);

  /* helpers ───────────────────────────────────────────────────────────── */

  const toggleIn = (arr: string[], val: string, setter: (v: string[]) => void) => {
    setter(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);
  };

  const wizardSteps = useMemo(
    () => (user ? STEPS.filter((s) => s.id !== "account") : STEPS),
    [user],
  );

  const currentIndex = wizardSteps.findIndex((s) => s.id === step);
  const progressPct =
    step === "welcome"
      ? 0
      : step === "done"
        ? 100
        : ((currentIndex + 1) / wizardSteps.length) * 100;

  const goNext = () => {
    if (step === "welcome") return setStep(user ? "contact" : "account");
    const next = wizardSteps[currentIndex + 1];
    if (next) setStep(next.id);
  };
  const goBack = () => {
    if (step === "welcome") return;
    if (currentIndex === 0) return setStep("welcome");
    const prev = wizardSteps[currentIndex - 1];
    if (prev) setStep(prev.id);
  };

  /* per-step validation ────────────────────────────────────────────────── */

  const validateCurrent = (): string | null => {
    switch (step) {
      case "account":
        if (!fullName.trim()) return "Please enter your full name.";
        if (!email.trim()) return "Please enter your email.";
        if (!/^\S+@\S+\.\S+$/.test(email.trim())) return "That email doesn't look right.";
        if (password.length < 6) return "Password must be at least 6 characters.";
        return null;
      case "contact":
        if (!whatsappNumber.trim()) return "WhatsApp number helps us reach you fast.";
        if (!location.trim()) return "Tell us where you're based.";
        return null;
      case "audience":
        if (!primaryChannel) return "Pick your main channel.";
        if (!channelHandle.trim()) return "Add your handle or page name.";
        if (!audienceSize) return "Pick an audience size band.";
        if (audienceTypes.length === 0) return "Pick at least one audience type.";
        if (regions.length === 0) return "Pick at least one region.";
        return null;
      case "fit":
        if (!usedBrandie) return "Let us know if you've used Brandie.";
        if (whyJoin.trim().length < 20) return "Tell us a bit more about why you want to join (min 20 chars).";
        return null;
      case "promo":
        if (contentTypes.length === 0) return "Pick at least one content type.";
        if (!postingCadence) return "Pick how often you'll post about Brandie.";
        if (promoPlan.trim().length < 30) return "A short promo plan helps approval (min 30 chars).";
        return null;
      case "agree":
        if (!agreedDisclosure) return "Please agree to the FTC disclosure rule.";
        if (!agreedTerms) return "Please accept the affiliate terms.";
        return null;
      default:
        return null;
    }
  };

  const handleNextClick = async () => {
    const err = validateCurrent();
    if (err) {
      toast({ title: err, variant: "destructive" });
      return;
    }
    if (step === "agree") {
      await handleSubmit();
      return;
    }
    goNext();
  };

  /* submit ─────────────────────────────────────────────────────────────── */

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      let userId = user?.id;
      let userEmail = user?.email;

      if (!userId) {
        const { data: signupData, error: signupError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              whatsapp_number: whatsappNumber.trim(),
            },
            emailRedirectTo: window.location.origin + "/affiliate",
          },
        });
        if (signupError) throw signupError;
        userId = signupData.user?.id;
        userEmail = email.trim();
        if (!userId) {
          toast({
            title: "Check your email",
            description: "Please confirm your email, then come back to finish your application.",
          });
          setSubmitting(false);
          return;
        }
      }

      // Existing application?
      const { data: existing } = await supabase
        .from("affiliates")
        .select("id, status")
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) {
        toast({
          title: existing.status === "approved" ? "Already approved" : "Application already on file",
          description:
            existing.status === "approved"
              ? "Taking you to your dashboard…"
              : "Your application is already in review.",
        });
        if (existing.status === "approved") navigate("/affiliate");
        setSubmitting(false);
        setStep("done");
        return;
      }

      // Recruiter (ref code)
      let recruitedBy: string | null = null;
      if (refCode) {
        const { data: recruiter } = await supabase
          .from("affiliates")
          .select("id")
          .eq("affiliate_code", refCode)
          .eq("status", "approved")
          .maybeSingle();
        if (recruiter) recruitedBy = recruiter.id;
      }

      const insertData: Record<string, unknown> = {
        user_id: userId,
        status: "pending",
        whatsapp_number: whatsappNumber.trim() || null,
        location: location.trim() || null,
        primary_channel: primaryChannel || null,
        channel_handle: channelHandle.trim() || null,
        channel_url: channelUrl.trim() || null,
        audience_size: audienceSize || null,
        audience_types: audienceTypes,
        niche: niche.trim() || null,
        regions,
        used_brandie: usedBrandie === "yes",
        brandie_experience: brandieExperience.trim() || null,
        promo_plan: promoPlan.trim() || null,
        content_types: contentTypes,
        posting_cadence: postingCadence || null,
        why_join: whyJoin.trim() || null,
        agreed_disclosure: agreedDisclosure,
        agreed_terms: agreedTerms,
        application_submitted_at: new Date().toISOString(),
      };
      if (recruitedBy) insertData.recruited_by = recruitedBy;

      const { error } = await supabase.from("affiliates").insert(insertData as any);
      if (error) throw error;

      // Notify applicant
      if (userEmail) {
        try {
          await supabase.functions.invoke("send-email", {
            body: {
              type: "affiliate_application_received",
              to: userEmail,
              data: { name: fullName.trim() || user?.user_metadata?.full_name || "" },
            },
          });
        } catch (e) {
          console.error("applicant email failed", e);
        }
      }

      // Notify admins
      try {
        await supabase.functions.invoke("send-email", {
          body: {
            type: "affiliate_application_admin_notify",
            to: "__admins__",
            data: {
              name: fullName.trim(),
              email: userEmail || "",
              whatsapp: whatsappNumber.trim(),
              location: location.trim(),
              primary_channel: primaryChannel,
              audience_size: audienceSize,
              niche: niche.trim(),
              recruited_by: refCode || "",
            },
          },
        });
      } catch (e) {
        console.error("admin email failed", e);
      }

      // Notify recruiter
      if (recruitedBy) {
        try {
          const { data: recruiterData } = await supabase
            .from("affiliates")
            .select("user_id")
            .eq("id", recruitedBy)
            .single();
          if (recruiterData?.user_id) {
            await supabase.functions.invoke("send-email", {
              body: {
                type: "affiliate_new_recruit",
                to: "__resolve_user__:" + recruiterData.user_id,
                data: { recruit_name: fullName.trim() || email.trim(), recruit_code: "" },
              },
            });
          }
        } catch (e) {
          console.error("recruiter email failed", e);
        }
      }

      setStep("done");
    } catch (err: any) {
      toast({ title: "Couldn't submit", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  /* ─────────────────────────────────────────────────────────────────────
     Render
     ───────────────────────────────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        title="Apply, Friends of Brandie Affiliate Program"
        description="Become a Brandie affiliate. Earn 20% first-month and 5% lifetime commission referring small businesses."
        path="/affiliate/signup"
      />

      {/* Top nav */}
      <nav className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-4 sm:px-6 h-14">
          <button onClick={() => navigate("/")} className="flex items-center gap-2">
            <img src={brandieLogo} alt="Brandie" className="h-7 w-7" />
            <span className="font-serif text-lg tracking-tight">Brandie</span>
          </button>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-xl text-xs"
            onClick={() => navigate("/auth")}
          >
            Sign in
          </Button>
        </div>
      </nav>

      {/* Progress bar */}
      {step !== "welcome" && step !== "done" && (
        <div className="border-b border-border bg-secondary/30">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                Step {currentIndex + 1} of {wizardSteps.length} ·{" "}
                {wizardSteps[currentIndex]?.label}
              </span>
              <span>{Math.round(progressPct)}%</span>
            </div>
            <Progress value={progressPct} className="h-1.5" />
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col">
        <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1">
          <AnimatePresence mode="wait">
            {/* ─── Welcome ─── */}
            {step === "welcome" && (
              <motion.div
                key="welcome"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="space-y-8 text-center pt-4"
              >
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mx-auto">
                  <Sparkles className="h-3 w-3" /> Friends of Brandie
                </div>
                <div className="space-y-4">
                  <h1 className="text-3xl sm:text-5xl font-serif tracking-tight">
                    Apply to become a Brandie affiliate
                  </h1>
                  <p className="text-muted-foreground text-base sm:text-lg max-w-lg mx-auto leading-relaxed">
                    A 2-minute application. Approval is usually within 24-48 hours.
                    Earn <span className="font-semibold text-foreground">20% first-payment</span> +{" "}
                    <span className="font-semibold text-foreground">5% lifetime</span> on every referral.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl mx-auto pt-2">
                  {[
                    { icon: Target, label: "Tell us about your audience" },
                    { icon: Megaphone, label: "Share your promo plan" },
                    { icon: CheckCircle2, label: "Get reviewed fast" },
                  ].map((b) => (
                    <div
                      key={b.label}
                      className="rounded-2xl border border-border bg-card p-4 text-left space-y-2"
                    >
                      <b.icon className="h-4 w-4 text-primary" />
                      <p className="text-xs font-medium leading-snug">{b.label}</p>
                    </div>
                  ))}
                </div>

                {refCode && (
                  <div className="inline-flex items-center gap-2 text-xs text-muted-foreground bg-secondary rounded-full px-4 py-2 mx-auto">
                    <Users2 className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      Invited by:{" "}
                      <span className="font-mono font-medium text-foreground">{refCode}</span>
                    </span>
                  </div>
                )}

                <Button
                  size="lg"
                  className="rounded-xl h-12 px-8 gap-2 mx-auto"
                  onClick={goNext}
                >
                  Start application <ArrowRight className="h-4 w-4" />
                </Button>
              </motion.div>
            )}

            {/* ─── Account ─── */}
            {step === "account" && (
              <motion.div key="account" {...fadeSlide} className="space-y-6">
                <StepHeader
                  title="Let's create your account"
                  subtitle="You'll use this to sign in to your affiliate dashboard."
                />
                <Card>
                  <Field label="Full name" required>
                    <Input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Jane Smith"
                      maxLength={100}
                    />
                  </Field>
                  <Field label="Email" required>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      maxLength={255}
                    />
                  </Field>
                  <Field label="Password" required hint="At least 6 characters.">
                    <PasswordInput
                                            value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      minLength={6}
                    />
                  </Field>
                  <p className="text-center text-xs text-muted-foreground pt-2">
                    Already have an account?{" "}
                    <button
                      onClick={() => navigate("/auth")}
                      className="underline underline-offset-4 hover:text-foreground"
                    >
                      Sign in
                    </button>{" "}
                    then come back.
                  </p>
                </Card>
              </motion.div>
            )}

            {/* ─── Contact ─── */}
            {step === "contact" && (
              <motion.div key="contact" {...fadeSlide} className="space-y-6">
                <StepHeader
                  title="How can we reach you?"
                  subtitle="We send approval and payout updates via WhatsApp and email."
                />
                <Card>
                  <Field
                    label="WhatsApp number"
                    required
                    icon={<Phone className="h-3.5 w-3.5" />}
                    hint="Include country code, e.g. +234…"
                  >
                    <Input
                      type="tel"
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      placeholder="+234 801 234 5678"
                      maxLength={20}
                    />
                  </Field>
                  <Field
                    label="Where are you based?"
                    required
                    icon={<MapPin className="h-3.5 w-3.5" />}
                  >
                    <Input
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Lagos, Nigeria"
                      maxLength={100}
                    />
                  </Field>
                </Card>
              </motion.div>
            )}

            {/* ─── Audience ─── */}
            {step === "audience" && (
              <motion.div key="audience" {...fadeSlide} className="space-y-6">
                <StepHeader
                  title="Tell us about your audience"
                  subtitle="The clearer the picture, the faster we can approve and match you with the right kit."
                />
                <Card>
                  <Field label="Your main channel" required>
                    <Select value={primaryChannel} onValueChange={setPrimaryChannel}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pick the platform you'll mostly use" />
                      </SelectTrigger>
                      <SelectContent>
                        {CHANNELS.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Handle / page name" required>
                      <Input
                        value={channelHandle}
                        onChange={(e) => setChannelHandle(e.target.value)}
                        placeholder="@yourhandle"
                        maxLength={120}
                      />
                    </Field>
                    <Field label="Profile URL" hint="Optional but speeds up review.">
                      <Input
                        value={channelUrl}
                        onChange={(e) => setChannelUrl(e.target.value)}
                        placeholder="https://…"
                        maxLength={500}
                      />
                    </Field>
                  </div>

                  <Field label="Audience size" required>
                    <ChipGroup
                      options={AUDIENCE_SIZES}
                      value={audienceSize}
                      onChange={setAudienceSize}
                    />
                  </Field>

                  <Field
                    label="Niche / what you talk about"
                    hint="e.g. small business growth, fashion entrepreneurs, AI tools…"
                  >
                    <Input
                      value={niche}
                      onChange={(e) => setNiche(e.target.value)}
                      placeholder="One short line"
                      maxLength={140}
                    />
                  </Field>

                  <Field
                    label="Who's in your audience?"
                    required
                    hint="Pick all that apply."
                  >
                    <CheckGroup
                      options={AUDIENCE_TYPES}
                      values={audienceTypes}
                      onToggle={(v) => toggleIn(audienceTypes, v, setAudienceTypes)}
                    />
                  </Field>

                  <Field label="Where do they live?" required hint="Pick all that apply.">
                    <CheckGroup
                      options={REGIONS}
                      values={regions}
                      onToggle={(v) => toggleIn(regions, v, setRegions)}
                    />
                  </Field>
                </Card>
              </motion.div>
            )}

            {/* ─── Fit ─── */}
            {step === "fit" && (
              <motion.div key="fit" {...fadeSlide} className="space-y-6">
                <StepHeader
                  title="Have you used Brandie?"
                  subtitle="It's not a requirement, but honest answers help us tailor your approval."
                />
                <Card>
                  <Field label="Have you used Brandie yourself?" required>
                    <ChipGroup
                      options={[
                        { id: "yes", label: "Yes, I've used it" },
                        { id: "no", label: "Not yet" },
                      ]}
                      value={usedBrandie}
                      onChange={(v) => setUsedBrandie(v as "yes" | "no")}
                    />
                  </Field>

                  {usedBrandie === "yes" && (
                    <Field
                      label="What's your experience been like?"
                      hint="One or two lines is plenty."
                    >
                      <Textarea
                        value={brandieExperience}
                        onChange={(e) => setBrandieExperience(e.target.value)}
                        placeholder="What you've used it for, what's worked, what hasn't…"
                        rows={3}
                        maxLength={500}
                      />
                    </Field>
                  )}

                  <Field
                    label="Why do you want to join the program?"
                    required
                    hint="The 'why' helps us understand fit."
                  >
                    <Textarea
                      value={whyJoin}
                      onChange={(e) => setWhyJoin(e.target.value)}
                      placeholder="What excites you about referring Brandie to your audience?"
                      rows={4}
                      maxLength={800}
                    />
                  </Field>
                </Card>
              </motion.div>
            )}

            {/* ─── Promo plan ─── */}
            {step === "promo" && (
              <motion.div key="promo" {...fadeSlide} className="space-y-6">
                <StepHeader
                  title="How will you promote Brandie?"
                  subtitle="A clear plan dramatically increases your approval odds."
                />
                <Card>
                  <Field label="Content types you'll use" required hint="Pick all that apply.">
                    <CheckGroup
                      options={CONTENT_TYPES}
                      values={contentTypes}
                      onToggle={(v) => toggleIn(contentTypes, v, setContentTypes)}
                    />
                  </Field>

                  <Field label="How often will you post about Brandie?" required>
                    <ChipGroup
                      options={CADENCE}
                      value={postingCadence}
                      onChange={setPostingCadence}
                    />
                  </Field>

                  <Field
                    label="Your promo plan"
                    required
                    hint="A few sentences on what you'll actually do."
                  >
                    <Textarea
                      value={promoPlan}
                      onChange={(e) => setPromoPlan(e.target.value)}
                      placeholder="e.g. A weekly carousel showing a Brandie weekly drop + a monthly newsletter feature + DMs to my warm list."
                      rows={5}
                      maxLength={1000}
                    />
                  </Field>
                </Card>
              </motion.div>
            )}

            {/* ─── Agree ─── */}
            {step === "agree" && (
              <motion.div key="agree" {...fadeSlide} className="space-y-6">
                <StepHeader
                  title="Almost there"
                  subtitle="A couple of agreements and we'll review your application."
                />
                <Card>
                  <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-border p-4 hover:bg-secondary/30 transition-colors">
                    <Checkbox
                      checked={agreedDisclosure}
                      onCheckedChange={(c) => setAgreedDisclosure(Boolean(c))}
                      className="mt-0.5"
                    />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">FTC disclosure</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        I'll clearly disclose my affiliate relationship whenever I post or share
                        Brandie (e.g. "#ad" or "affiliate link") so my audience knows I earn a
                        commission.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-border p-4 hover:bg-secondary/30 transition-colors">
                    <Checkbox
                      checked={agreedTerms}
                      onCheckedChange={(c) => setAgreedTerms(Boolean(c))}
                      className="mt-0.5"
                    />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Affiliate program terms</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        I won't run paid ads on Brandie's brand keywords, won't spam, won't
                        self-refer, and understand commissions are paid monthly on confirmed
                        revenue.
                      </p>
                    </div>
                  </label>

                  <div className="rounded-xl bg-secondary/40 border border-border p-4 text-xs text-muted-foreground leading-relaxed">
                    <p>
                      <span className="font-medium text-foreground">What happens next:</span> our
                      team reviews every application by hand, usually within 24 hours. You'll get
                      an email + WhatsApp message either way.
                    </p>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* ─── Done ─── */}
            {step === "done" && (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6 text-center py-10"
              >
                <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <PartyPopper className="h-8 w-8 text-primary" />
                </div>
                <div className="space-y-3">
                  <h1 className="text-3xl sm:text-4xl font-serif tracking-tight">
                    Application in 🎉
                  </h1>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    We'll review and get back to you within 24 hours via email and WhatsApp. In the
                    meantime, you can sign in and check your dashboard.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
                  <Button
                    size="lg"
                    className="rounded-xl"
                    onClick={() => navigate("/affiliate")}
                  >
                    Go to dashboard <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => navigate("/")}
                  >
                    Back to home
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sticky footer with nav */}
        {step !== "welcome" && step !== "done" && (
          <div className="sticky bottom-0 border-t border-border bg-background/95 backdrop-blur-md">
            <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                onClick={goBack}
                disabled={submitting}
                className="rounded-xl gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button
                onClick={handleNextClick}
                disabled={submitting}
                className="rounded-xl gap-1.5 min-w-[140px]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
                  </>
                ) : step === "agree" ? (
                  <>
                    Submit application <CheckCircle2 className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    Continue <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Yaries Business Systems. All rights reserved.
      </footer>
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────────────────
   Small presentational helpers
   ────────────────────────────────────────────────────────────────────────── */

const StepHeader = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <div className="space-y-2">
    <h2 className="text-2xl sm:text-3xl font-serif tracking-tight">{title}</h2>
    {subtitle && <p className="text-sm text-muted-foreground leading-relaxed">{subtitle}</p>}
  </div>
);

const Card = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-5">{children}</div>
);

const Field = ({
  label,
  hint,
  required,
  icon,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div className="space-y-2">
    <Label className="flex items-center gap-1.5 text-sm">
      {icon}
      {label}
      {required && <span className="text-destructive">*</span>}
    </Label>
    {children}
    {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
  </div>
);

const ChipGroup = ({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) => (
  <div className="flex flex-wrap gap-2">
    {options.map((o) => {
      const active = value === o.id;
      return (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`text-xs rounded-full px-3.5 py-2 border transition-colors ${
            active
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background border-border hover:bg-secondary/60"
          }`}
        >
          {o.label}
        </button>
      );
    })}
  </div>
);

const CheckGroup = ({
  options,
  values,
  onToggle,
}: {
  options: { id: string; label: string }[];
  values: string[];
  onToggle: (v: string) => void;
}) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
    {options.map((o) => {
      const active = values.includes(o.id);
      return (
        <button
          key={o.id}
          type="button"
          onClick={() => onToggle(o.id)}
          className={`flex items-center gap-2 text-sm rounded-xl px-3.5 py-2.5 border transition-colors text-left ${
            active
              ? "bg-primary/10 border-primary text-foreground"
              : "bg-background border-border hover:bg-secondary/60"
          }`}
        >
          <span
            className={`h-4 w-4 rounded-md border flex items-center justify-center shrink-0 ${
              active ? "bg-primary border-primary" : "border-border"
            }`}
          >
            {active && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
          </span>
          <span className="leading-snug">{o.label}</span>
        </button>
      );
    })}
  </div>
);

export default AffiliateSignup;
