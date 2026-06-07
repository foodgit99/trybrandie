import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Check,
  Loader2,
  Lock,
  Plus,
  Trash2,
  Folder,
  FolderPlus,
  MoreHorizontal,
  Users,
} from "lucide-react";
import SEO from "@/components/SEO";
import NewAppHeader from "@/components/v2/NewAppHeader";

const FOLDER_COLORS = ["#C4993B", "#2B6CB0", "#9F1239", "#047857", "#7C3AED", "#0F172A"];

const BrandsPage = () => {
  const { user, loading: authLoading } = useAuth();
  const { brand, brands, setActiveBrand, isLoading, refetch } = useBrand(user);
  const { data: sub, isLoading: subLoading } = useSubscription();
  const { toast } = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [folderModal, setFolderModal] = useState<{ id?: string; name: string; color: string } | null>(null);
  const [activeFolder, setActiveFolder] = useState<string | "all" | "unfiled">("all");
  const [savingFolder, setSavingFolder] = useState(false);

  const foldersEnabled = !!sub?.features?.client_folders;

  const { data: folders = [] } = useQuery({
    queryKey: ["client-folders", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("client_folders" as any)
        .select("*")
        .eq("owner_user_id", user.id)
        .order("name", { ascending: true });
      return data ?? [];
    },
    enabled: !!user && foldersEnabled,
  });

  if (authLoading || isLoading || subLoading) {
    return (
      <div className="min-h-dvh grid place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth?next=/brands" replace />;
  if (!brand) return <Navigate to="/onboarding" replace />;

  const canMultiBrand = sub?.brandLimit === null || (sub?.brandLimit ?? 1) > 1;
  const ownedVisible = brands.filter(
    (b: any) => !b.is_archived && b.__role === "owner"
  );
  const memberVisible = brands.filter(
    (b: any) => !b.is_archived && b.__role === "member"
  );
  const visible = [...ownedVisible, ...memberVisible];
  const limitReached =
    sub?.brandLimit !== null &&
    sub?.brandLimit !== undefined &&
    ownedVisible.length >= sub.brandLimit;

  const filtered = visible.filter((b: any) => {
    if (!foldersEnabled) return true;
    if (activeFolder === "all") return true;
    if (activeFolder === "unfiled") return !b.client_folder_id;
    return b.client_folder_id === activeFolder;
  });

  const folderById: Record<string, any> = {};
  for (const f of folders as any[]) folderById[f.id] = f;

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
        } else throw error;
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
      toast({ title: "Couldn't create brand", description: err.message, variant: "destructive" });
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
      toast({ title: "Couldn't archive", description: err.message, variant: "destructive" });
    } finally {
      setArchiving(false);
      setConfirmArchive(null);
    }
  };

  const saveFolder = async () => {
    if (!folderModal || !folderModal.name.trim() || !user) return;
    setSavingFolder(true);
    try {
      if (folderModal.id) {
        const { error } = await supabase
          .from("client_folders" as any)
          .update({ name: folderModal.name.trim(), color: folderModal.color })
          .eq("id", folderModal.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("client_folders" as any).insert({
          owner_user_id: user.id,
          name: folderModal.name.trim(),
          color: folderModal.color,
        });
        if (error) throw error;
      }
      qc.invalidateQueries({ queryKey: ["client-folders", user.id] });
      setFolderModal(null);
      toast({ title: "Folder saved" });
    } catch (err: any) {
      toast({ title: "Couldn't save folder", description: err.message, variant: "destructive" });
    } finally {
      setSavingFolder(false);
    }
  };

  const deleteFolder = async (id: string) => {
    const { error } = await supabase.from("client_folders" as any).delete().eq("id", id);
    if (error) {
      toast({ title: "Couldn't delete", description: error.message, variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["client-folders", user.id] });
    if (activeFolder === id) setActiveFolder("all");
    toast({ title: "Folder deleted" });
  };

  const moveBrandToFolder = async (brandId: string, folderId: string | null) => {
    const { error } = await supabase
      .from("brands")
      .update({ client_folder_id: folderId } as any)
      .eq("id", brandId);
    if (error) {
      toast({ title: "Couldn't move", description: error.message, variant: "destructive" });
      return;
    }
    await refetch();
    toast({ title: folderId ? "Moved to folder" : "Removed from folder" });
  };

  return (
    <div className="min-h-dvh bg-background lg:pl-20 pb-24">
      <SEO title="Brands, Brandie" description="Manage your brands." path="/brands" noindex />
      <NewAppHeader />

      <main className="max-w-5xl mx-auto px-5 sm:px-8 pt-10 sm:pt-16 space-y-10">
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

        <div className={foldersEnabled ? "grid lg:grid-cols-[200px_1fr] gap-8" : ""}>
          {foldersEnabled && (
            <aside className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xs tracking-[0.22em] uppercase text-muted-foreground">
                  Folders
                </h2>
                <button
                  onClick={() => setFolderModal({ name: "", color: FOLDER_COLORS[0] })}
                  className="text-muted-foreground hover:text-foreground"
                  title="New folder"
                >
                  <FolderPlus className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-1">
                {[
                  { id: "all" as const, name: "All brands", color: undefined },
                  { id: "unfiled" as const, name: "Unfiled", color: undefined },
                  ...(folders as any[]),
                ].map((f: any) => {
                  const active = activeFolder === f.id;
                  return (
                    <div
                      key={f.id}
                      className={`group flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer ${
                        active ? "bg-secondary text-foreground" : "hover:bg-secondary/60 text-muted-foreground"
                      }`}
                      onClick={() => setActiveFolder(f.id)}
                    >
                      {f.color ? (
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: f.color }}
                        />
                      ) : (
                        <Folder className="h-3.5 w-3.5 opacity-60" />
                      )}
                      <span className="flex-1 truncate">{f.name}</span>
                      {f.id !== "all" && f.id !== "unfiled" && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <button className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                setFolderModal({ id: f.id, name: f.name, color: f.color })
                              }
                            >
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => deleteFolder(f.id)}
                            >
                              Delete folder
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  );
                })}
              </div>
            </aside>
          )}

          <div className="space-y-10">
            <section className="space-y-3">
              <h2 className="text-xs tracking-[0.22em] uppercase text-muted-foreground">
                {foldersEnabled && activeFolder !== "all"
                  ? activeFolder === "unfiled"
                    ? "Unfiled brands"
                    : `${folderById[activeFolder]?.name ?? "Folder"} brands`
                  : `Active brands (${ownedVisible.length}${
                      sub?.brandLimit ? ` / ${sub.brandLimit}` : ""
                    })`}
              </h2>
              <div className="rounded-2xl border border-border bg-card divide-y divide-border">
                {filtered.length === 0 ? (
                  <div className="p-5 text-sm text-muted-foreground">No brands here.</div>
                ) : (
                  filtered.map((b: any) => {
                    const isActive = b.id === brand.id;
                    const isMember = b.__role === "member";
                    const folder = b.client_folder_id ? folderById[b.client_folder_id] : null;
                    return (
                      <div key={b.id} className="flex items-center justify-between gap-3 p-4">
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
                            <p className="font-medium truncate flex items-center gap-2">
                              {b.name}
                              {isMember && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] tracking-[0.14em] uppercase text-muted-foreground border border-border rounded px-1.5 py-0.5">
                                  <Users className="h-2.5 w-2.5" /> Member
                                </span>
                              )}
                              {foldersEnabled && folder && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                                  <span
                                    className="h-2 w-2 rounded-full"
                                    style={{ backgroundColor: folder.color }}
                                  />
                                  {folder.name}
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {b.tagline || b.description || "No tagline yet"}
                            </p>
                          </div>
                        </button>
                        <div className="flex items-center gap-1 shrink-0">
                          {isActive && (
                            <span className="inline-flex items-center gap-1 text-[10px] tracking-[0.18em] uppercase text-primary">
                              <Check className="h-3 w-3" /> Active
                            </span>
                          )}
                          {foldersEnabled && !isMember && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="ghost" className="rounded-full">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <div className="px-2 py-1.5 text-[10px] tracking-[0.18em] uppercase text-muted-foreground">
                                  Move to folder
                                </div>
                                <DropdownMenuItem onClick={() => moveBrandToFolder(b.id, null)}>
                                  Unfiled
                                </DropdownMenuItem>
                                {(folders as any[]).map((f: any) => (
                                  <DropdownMenuItem
                                    key={f.id}
                                    onClick={() => moveBrandToFolder(b.id, f.id)}
                                  >
                                    <span
                                      className="h-2.5 w-2.5 rounded-full mr-2"
                                      style={{ backgroundColor: f.color }}
                                    />
                                    {f.name}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                          {!isMember && ownedVisible.length > 1 && (
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
                  })
                )}
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
                      {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      Create brand
                    </Button>
                  </div>
                  {limitReached && (
                    <p className="text-xs text-muted-foreground">
                      You've reached your plan's brand limit.{" "}
                      <Link to="/pricing" className="underline text-foreground">Upgrade</Link>{" "}
                      for more.
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    You'll be taken to Brand Centre to finish setup (logo, colors, audience, products).
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
          </div>
        </div>
      </main>

      <AlertDialog open={!!confirmArchive} onOpenChange={(o) => !o && setConfirmArchive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this brand?</AlertDialogTitle>
            <AlertDialogDescription>
              The brand is hidden from your workspace and stops counting toward your plan limit. Designs and history are preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={archiving}
              onClick={() => confirmArchive && archiveBrand(confirmArchive)}
            >
              {archiving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!folderModal} onOpenChange={(o) => !o && setFolderModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{folderModal?.id ? "Rename folder" : "New folder"}</DialogTitle>
          </DialogHeader>
          {folderModal && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs tracking-wider uppercase text-muted-foreground">Name</label>
                <Input
                  value={folderModal.name}
                  onChange={(e) => setFolderModal({ ...folderModal, name: e.target.value })}
                  placeholder="e.g. Acme Co."
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs tracking-wider uppercase text-muted-foreground">Color</label>
                <div className="flex flex-wrap gap-2">
                  {FOLDER_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setFolderModal({ ...folderModal, color: c })}
                      className={`h-8 w-8 rounded-full border-2 ${
                        folderModal.color === c ? "border-foreground" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFolderModal(null)}>Cancel</Button>
            <Button onClick={saveFolder} disabled={savingFolder || !folderModal?.name.trim()}>
              {savingFolder ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BrandsPage;
