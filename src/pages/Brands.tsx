import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useBrand } from "@/hooks/useBrand";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Check, Loader2, Lock, Plus, Trash2 } from "lucide-react";
import SEO from "@/components/SEO";
import NewAppHeader from "@/components/v2/NewAppHeader";

const BrandsPage = () => {
  const { user, loading: authLoading } = useAuth();
  const { brand, brands, setActiveBrand, isLoading, refetch } = useBrand(user);
  const { data: sub, isLoading: subLoading } = useSubscription();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);

  if (authLoading || isLoading || subLoading) {
    return (
      <div className="min-h-dvh grid place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth?next=/brands" replace />;
  if (!brand) return <Navigate to="/onboarding" replace />;

  const canMultiBrand =
    sub?.brandLimit === null || (sub?.brandLimit ?? 1) > 1;
  const visible = brands.filter((b: any) => !b.is_archived);
  const limitReached =
    sub?.brandLimit !== null &&
    sub?.brandLimit !== undefined &&
    visible.length >= sub.brandLimit;

  const createBrand = async () => {
    if (!newName.trim() || !user) return;
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("brands")
        .insert({ user_id: user.id, name: newName.trim() } as any)
        .select("*")
        .single();
      if (error) {
        if ((error.message || "").includes("BRAND_LIMIT_REACHED")) {
          toast({
            title: "Brand limit reached",
            description: "Upgrade to Creator or Agency to add more brands.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        return;
      }
      setNewName("");
      await refetch();
      if (data?.id) {
        setActiveBrand(data.id);
        toast({ title: "Brand created. Finish setup in Brand Centre." });
        navigate("/brand/editor");
      }
    } catch (err: any) {
      toast({
        title: "Couldn't create brand",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const archiveBrand = async (id: string) => {
    setArchiving(true);
    try {
      const { error } = await supabase
        .from("brands")
        .update({ is_archived: true } as any)
        .eq("id", id);
      if (error) throw error;
      if (id === brand.id) {
        const next = visible.find((b: any) => b.id !== id);
        setActiveBrand(next?.id ?? null);
      }
      await refetch();
      toast({ title: "Brand archived." });
    } catch (err: any) {
      toast({
        title: "Couldn't archive",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setArchiving(false);
      setConfirmArchive(null);
    }
  };

  return (
    <div className="min-h-dvh bg-background lg:pl-20 pb-24">
      <SEO title="Brands, Brandie" description="Manage your brands." path="/brands" noindex />
      <NewAppHeader />

      <main className="max-w-3xl mx-auto px-5 sm:px-8 pt-10 sm:pt-16 space-y-10">
        <header className="space-y-2">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-xs tracking-[0.18em] uppercase text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <h1 className="font-serif text-4xl sm:text-5xl tracking-tight leading-[1]">
            Your brands.
          </h1>
          <p className="text-muted-foreground">
            {canMultiBrand
              ? sub?.brandLimit === null
                ? "Unlimited brands on your plan."
                : `Up to ${sub?.brandLimit} brands on your plan.`
              : "Your current plan includes 1 brand. Upgrade to add more."}
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xs tracking-[0.22em] uppercase text-muted-foreground">
            Active brands ({visible.length}
            {sub?.brandLimit ? ` / ${sub.brandLimit}` : ""})
          </h2>
          <div className="rounded-2xl border border-border bg-card divide-y divide-border">
            {visible.map((b: any) => {
              const isActive = b.id === brand.id;
              return (
                <div
                  key={b.id}
                  className="flex items-center justify-between gap-3 p-4"
                >
                  <button
                    onClick={() => setActiveBrand(b.id)}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left"
                  >
                    {b.logo_url ? (
                      <img
                        src={b.logo_url}
                        alt=""
                        className="h-10 w-10 rounded-lg object-cover bg-secondary shrink-0"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-secondary shrink-0 grid place-items-center text-sm font-medium text-muted-foreground">
                        {(b.name || "?").slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium truncate">{b.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {b.tagline || b.description || "No tagline yet"}
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    {isActive && (
                      <span className="inline-flex items-center gap-1 text-[10px] tracking-[0.18em] uppercase text-primary">
                        <Check className="h-3 w-3" /> Active
                      </span>
                    )}
                    {visible.length > 1 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-full text-destructive hover:text-destructive"
                        onClick={() => setConfirmArchive(b.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xs tracking-[0.22em] uppercase text-muted-foreground">
            Add a brand
          </h2>
          {canMultiBrand ? (
            <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="New brand name"
                  className="h-11"
                  disabled={limitReached}
                />
                <Button
                  onClick={createBrand}
                  disabled={!newName.trim() || creating || limitReached}
                  className="rounded-full h-11 gap-1.5"
                >
                  {creating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Create brand
                </Button>
              </div>
              {limitReached && (
                <p className="text-xs text-muted-foreground">
                  You've reached your plan's brand limit.{" "}
                  <Link to="/pricing" className="underline text-foreground">
                    Upgrade
                  </Link>{" "}
                  for more.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                You'll be taken to Brand Centre to finish setup (logo, colors,
                audience, products).
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-lg bg-secondary grid place-items-center shrink-0">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium leading-tight">Multi-brand is on Creator & Agency</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Manage multiple brands from one account.
                  </p>
                </div>
              </div>
              <Button asChild size="sm" className="rounded-full shrink-0">
                <Link to="/pricing">View plans</Link>
              </Button>
            </div>
          )}
        </section>
      </main>

      <AlertDialog
        open={!!confirmArchive}
        onOpenChange={(o) => !o && setConfirmArchive(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this brand?</AlertDialogTitle>
            <AlertDialogDescription>
              The brand is hidden from your workspace and stops counting toward
              your plan limit. Designs and history are preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={archiving}
              onClick={() => confirmArchive && archiveBrand(confirmArchive)}
            >
              {archiving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Archive"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default BrandsPage;
