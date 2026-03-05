import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useBrand } from "@/hooks/useBrand";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import { ArrowLeft, User, Palette, CreditCard, LogOut, Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import AppHeader from "@/components/AppHeader";

const Settings = () => {
  const { user, signOut } = useAuth();
  const { brand } = useBrand(user);
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="max-w-2xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-8"
        >
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="rounded-xl">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-2xl sm:text-3xl font-serif tracking-tight">Settings</h2>
          </div>

          {/* Account */}
          <section className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Account</h3>
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">{user?.user_metadata?.full_name || "User"}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </div>
            </div>
          </section>

          <Separator />

          {/* Brand */}
          <section className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Brand</h3>
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {brand?.logo_url ? (
                    <img src={brand.logo_url} alt="Logo" className="h-10 w-10 rounded-lg object-contain bg-secondary" />
                  ) : (
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Palette className="h-5 w-5 text-primary" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium">{brand?.name || "No brand"}</p>
                    <p className="text-xs text-muted-foreground">{brand?.tagline || "Set up your brand"}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="rounded-xl" onClick={() => navigate("/brand")}>
                  Edit
                </Button>
              </div>
            </div>
          </section>

          <Separator />

          {/* Plan */}
          <section className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Plan</h3>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Free Plan</p>
                    <p className="text-xs text-muted-foreground">10 generations per month</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="rounded-xl" onClick={() => navigate("/plans")}>
                  Upgrade
                </Button>
              </div>
            </div>
          </section>

          <Separator />

          {/* Appearance */}
          <section className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Appearance</h3>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Theme</p>
                  <p className="text-xs text-muted-foreground">Choose your preferred look</p>
                </div>
                <div className="flex items-center gap-1 rounded-xl bg-secondary p-1">
                  {[
                    { value: "light", icon: Sun, label: "Light" },
                    { value: "dark", icon: Moon, label: "Dark" },
                    { value: "system", icon: Monitor, label: "System" },
                  ].map(({ value, icon: Icon, label }) => (
                    <Button
                      key={value}
                      variant={theme === value ? "default" : "ghost"}
                      size="sm"
                      className="h-8 px-3 rounded-lg gap-1.5 text-xs"
                      onClick={() => setTheme(value)}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{label}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <Separator />

          {/* Sign out */}
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </motion.div>
      </main>
    </div>
  );
};

export default Settings;
