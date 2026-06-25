import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Camera, Loader2, Lock, LogOut, Trash2 } from "lucide-react";
import SEO from "@/components/SEO";
import NewAppHeader from "@/components/v2/NewAppHeader";

const LOCALES = [
  { id: "en", label: "English" },
  { id: "en-NG", label: "English (Nigeria)" },
  { id: "en-GB", label: "English (UK)" },
  { id: "en-US", label: "English (US)" },
  { id: "fr", label: "Français" },
  { id: "es", label: "Español" },
  { id: "pt", label: "Português" },
  { id: "ar", label: "العربية" },
];

const profileSchema = z.object({
  full_name: z.string().trim().min(1, "Required").max(100),
  whatsapp_number: z
    .string()
    .trim()
    .max(20)
    .regex(/^(\+?\d[\d\s-]{5,18})?$/, "Use a valid phone number")
    .optional()
    .or(z.literal("")),
  locale: z.string().max(10).optional().or(z.literal("")),
  timezone: z.string().max(64).optional().or(z.literal("")),
});

const passwordSchema = z
  .object({
    next: z.string().min(8, "Min 8 characters").max(128),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  });

const Section: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <section className="space-y-3">
    <h2 className="text-xs tracking-[0.22em] uppercase text-muted-foreground">{label}</h2>
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-5">{children}</div>
  </section>
);

const ProfilePage = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement | null>(null);

  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [locale, setLocale] = useState("");
  const [timezone, setTimezone] = useState("");
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [avatarSignedUrl, setAvatarSignedUrl] = useState<string | null>(null);

  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pwNext, setPwNext] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);

  const timezones = useMemo<string[]>(() => {
    try {
      // @ts-ignore — modern browsers
      const list: string[] = (Intl as any).supportedValuesOf?.("timeZone") ?? [];
      return list.length ? list : ["UTC", "Africa/Lagos", "Europe/London", "America/New_York"];
    } catch {
      return ["UTC", "Africa/Lagos", "Europe/London", "America/New_York"];
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, whatsapp_number, avatar_url, locale, timezone")
        .eq("user_id", user.id)
        .maybeSingle();
      setFullName((data?.full_name as string) ?? "");
      setWhatsapp((data?.whatsapp_number as string) ?? "");
      setLocale(((data as any)?.locale as string) ?? "");
      setTimezone(
        ((data as any)?.timezone as string) ??
          (Intl.DateTimeFormat().resolvedOptions().timeZone || ""),
      );
      const path = ((data as any)?.avatar_url as string) ?? null;
      setAvatarPath(path);
      if (path) {
        const { data: signed } = await supabase.storage
          .from("avatars")
          .createSignedUrl(path, 60 * 60);
        setAvatarSignedUrl(signed?.signedUrl ?? null);
      }
      setLoaded(true);
    })();
  }, [user]);

  const initials = (fullName || user?.email || "U")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  const onPickAvatar = () => fileInput.current?.click();

  const onAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Pick an image file.", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Max 2 MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${user.id}/avatar-${Date.now()}.${ext || "jpg"}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ avatar_url: path })
        .eq("user_id", user.id);
      if (dbErr) throw dbErr;
      // best-effort delete old
      if (avatarPath && avatarPath !== path) {
        await supabase.storage.from("avatars").remove([avatarPath]);
      }
      const { data: signed } = await supabase.storage
        .from("avatars")
        .createSignedUrl(path, 60 * 60);
      setAvatarPath(path);
      setAvatarSignedUrl(signed?.signedUrl ?? null);
      toast({ title: "Profile picture updated." });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const removeAvatar = async () => {
    if (!user || !avatarPath) return;
    setUploading(true);
    try {
      await supabase.storage.from("avatars").remove([avatarPath]);
      await supabase.from("profiles").update({ avatar_url: null }).eq("user_id", user.id);
      setAvatarPath(null);
      setAvatarSignedUrl(null);
      toast({ title: "Profile picture removed." });
    } catch (err: any) {
      toast({ title: "Couldn't remove", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    const parsed = profileSchema.safeParse({
      full_name: fullName,
      whatsapp_number: whatsapp,
      locale,
      timezone,
    });
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      toast({ title: "Check your details", description: first?.message, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: parsed.data.full_name,
          whatsapp_number: parsed.data.whatsapp_number || null,
          locale: parsed.data.locale || null,
          timezone: parsed.data.timezone || null,
        } as any)
        .eq("user_id", user.id);
      if (error) throw error;
      toast({ title: "Profile saved." });
    } catch (err: any) {
      toast({ title: "Couldn't save", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    const parsed = passwordSchema.safeParse({ next: pwNext, confirm: pwConfirm });
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      toast({ title: "Check password", description: first?.message, variant: "destructive" });
      return;
    }
    setSavingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: parsed.data.next });
      if (error) throw error;
      setPwNext("");
      setPwConfirm("");
      toast({ title: "Password updated." });
    } catch (err: any) {
      toast({ title: "Couldn't update password", description: err.message, variant: "destructive" });
    } finally {
      setSavingPw(false);
    }
  };

  const signOutAll = async () => {
    setSigningOutAll(true);
    try {
      await supabase.auth.signOut({ scope: "global" });
      window.location.href = "/auth";
    } catch (err: any) {
      toast({ title: "Couldn't sign out", description: err.message, variant: "destructive" });
      setSigningOutAll(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-dvh grid place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth?next=/profile" replace />;

  return (
    <div className="min-h-dvh bg-background lg:pl-20 pb-24">
      <SEO title="Profile, Brandie" description="Manage your personal profile." path="/profile" noindex />
      <NewAppHeader />

      <main className="max-w-2xl mx-auto px-5 sm:px-8 pt-8 sm:pt-12 space-y-10">
        <header className="space-y-2">
          <button
            onClick={() => navigate("/settings")}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Settings
          </button>
          <p className="text-xs tracking-[0.22em] uppercase text-muted-foreground">Profile</p>
          <h1 className="font-serif text-4xl sm:text-5xl tracking-tight leading-[1]">
            Your personal profile.
          </h1>
          <p className="text-muted-foreground">
            Signed in as <span className="text-foreground">{user.email}</span>
          </p>
        </header>

        <Section label="Identity">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              {avatarSignedUrl && <AvatarImage src={avatarSignedUrl} alt={fullName || "Avatar"} />}
              <AvatarFallback className="text-lg">{initials || "U"}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-2">
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                hidden
                onChange={onAvatarChange}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="rounded-full"
                  onClick={onPickAvatar}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Camera className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  {avatarPath ? "Replace" : "Upload"}
                </Button>
                {avatarPath && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-full text-destructive hover:text-destructive"
                    onClick={removeAvatar}
                    disabled={uploading}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Remove
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">JPG or PNG, up to 2 MB.</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="full_name">Full name</Label>
            <Input
              id="full_name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user.email ?? ""} disabled />
            <p className="text-[11px] text-muted-foreground">
              Email changes aren't supported yet — reach out to support if you need to move accounts.
            </p>
          </div>
        </Section>

        <Section label="Contact">
          <div className="space-y-2">
            <Label htmlFor="whatsapp">WhatsApp number</Label>
            <Input
              id="whatsapp"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="+234 800 000 0000"
              inputMode="tel"
              maxLength={20}
            />
            <p className="text-[11px] text-muted-foreground">
              Include the country code. Used for daily delivery pings.
            </p>
          </div>
        </Section>

        <Section label="Locale">
          <div className="space-y-2">
            <Label htmlFor="locale">Language</Label>
            <select
              id="locale"
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="">System default</option>
              {LOCALES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <select
              id="timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="">System default</option>
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">
              Used for scheduling display. Posting schedule lives in Settings.
            </p>
          </div>
        </Section>

        <div className="flex justify-end">
          <Button onClick={saveProfile} disabled={!loaded || saving} className="rounded-full">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
            Save changes
          </Button>
        </div>

        <Section label="Security">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="pw_next">New password</Label>
              <Input
                id="pw_next"
                type="password"
                value={pwNext}
                onChange={(e) => setPwNext(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw_confirm">Confirm</Label>
              <Input
                id="pw_confirm"
                type="password"
                value={pwConfirm}
                onChange={(e) => setPwConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 justify-between items-center">
            <Button
              variant="secondary"
              size="sm"
              className="rounded-full"
              onClick={changePassword}
              disabled={savingPw || !pwNext || !pwConfirm}
            >
              {savingPw ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <Lock className="h-3.5 w-3.5 mr-1.5" />
              )}
              Update password
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full text-destructive hover:text-destructive"
              onClick={signOutAll}
              disabled={signingOutAll}
            >
              {signingOutAll ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <LogOut className="h-3.5 w-3.5 mr-1.5" />
              )}
              Sign out of all sessions
            </Button>
          </div>
        </Section>

        <div className="flex justify-end pb-12">
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full text-muted-foreground"
            onClick={signOut}
          >
            <LogOut className="h-3.5 w-3.5 mr-1.5" /> Sign out
          </Button>
        </div>
      </main>
    </div>
  );
};

export default ProfilePage;
