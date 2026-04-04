import { useState, useRef, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Calendar,
  Image as ImageIcon,
  FolderPlus,
  Folder,
  FolderOpen,
  Plus,
  X,
  MoreHorizontal,
  Pencil,
  Trash2,
  Check,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import AppHeader from "@/components/AppHeader";
import DesignViewer from "@/components/DesignViewer";

const FOLDER_COLORS = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ef4444", "#14b8a6",
];

const DesignHistory = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();


  const initialTab = "designs";

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState(FOLDER_COLORS[0]);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignDesignId, setAssignDesignId] = useState<string | null>(null);
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameRef = useRef<HTMLInputElement>(null);

  // Fetch all designs
  const { data: designs = [], isLoading } = useQuery({
    queryKey: ["all-designs", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("designs")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch folders
  const { data: folders = [] } = useQuery({
    queryKey: ["design-folders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("design_folders" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  // Fetch folder assignments
  const { data: assignments = [] } = useQuery({
    queryKey: ["folder-assignments", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("design_folder_assignments" as any)
        .select("*");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  // Fetch video projects
  const { data: videoProjects = [], isLoading: videosLoading } = useQuery({
    queryKey: ["video-projects", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("video_projects")
        .select("*, video_scenes(*)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (renamingFolder && renameRef.current) {
      renameRef.current.focus();
      renameRef.current.select();
    }
  }, [renamingFolder]);

  // Group carousel slides: show only first slide per carousel_id, attach slide count
  const groupedDesigns = useMemo(() => {
    const baseList = activeFolder
      ? designs.filter((d) => assignments.some((a: any) => a.design_id === d.id && a.folder_id === activeFolder))
      : designs;

    const carouselMap = new Map<string, typeof baseList>();
    const result: Array<(typeof designs)[0] & { _slideCount?: number; _carouselSlides?: typeof designs }> = [];

    for (const d of baseList) {
      const cid = (d as any).carousel_id;
      if (cid) {
        if (!carouselMap.has(cid)) {
          carouselMap.set(cid, []);
        }
        carouselMap.get(cid)!.push(d);
      } else {
        result.push(d);
      }
    }

    // Insert grouped carousels (use first slide by slide_index)
    for (const [, slides] of carouselMap) {
      const sorted = [...slides].sort((a, b) => ((a as any).slide_index ?? 0) - ((b as any).slide_index ?? 0));
      result.push({ ...sorted[0], _slideCount: sorted.length, _carouselSlides: sorted });
    }

    // Sort by created_at descending
    result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return result;
  }, [designs, activeFolder, assignments]);

  const filteredDesigns = groupedDesigns;

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !user) return;
    const { error } = await supabase.from("design_folders" as any).insert({
      user_id: user.id,
      name: newFolderName.trim(),
      color: newFolderColor,
    } as any);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Folder created" });
      setNewFolderName("");
      setCreateFolderOpen(false);
      queryClient.invalidateQueries({ queryKey: ["design-folders"] });
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    const { error } = await supabase.from("design_folders" as any).delete().eq("id", folderId);
    if (!error) {
      if (activeFolder === folderId) setActiveFolder(null);
      queryClient.invalidateQueries({ queryKey: ["design-folders"] });
      queryClient.invalidateQueries({ queryKey: ["folder-assignments"] });
      toast({ title: "Folder deleted" });
    }
  };

  const handleRenameFolder = async (folderId: string) => {
    if (!renameValue.trim()) return;
    const { error } = await supabase
      .from("design_folders" as any)
      .update({ name: renameValue.trim() } as any)
      .eq("id", folderId);
    if (!error) {
      queryClient.invalidateQueries({ queryKey: ["design-folders"] });
      setRenamingFolder(null);
    }
  };

  const handleAssignToFolder = async (folderId: string) => {
    if (!assignDesignId) return;
    // Check if already assigned
    const existing = assignments.find(
      (a: any) => a.design_id === assignDesignId && a.folder_id === folderId
    );
    if (existing) {
      // Remove assignment
      await supabase.from("design_folder_assignments" as any).delete().eq("id", existing.id);
    } else {
      // Add assignment
      await supabase.from("design_folder_assignments" as any).insert({
        design_id: assignDesignId,
        folder_id: folderId,
      } as any);
    }
    queryClient.invalidateQueries({ queryKey: ["folder-assignments"] });
  };

  // State for viewer carousel slides
  const [viewerDesigns, setViewerDesigns] = useState<typeof designs>([]);

  const openViewer = (index: number, design: any) => {
    // If it's a carousel group, show all slides in the viewer
    if (design._carouselSlides && design._carouselSlides.length > 1) {
      const sorted = [...design._carouselSlides].sort((a: any, b: any) => ((a as any).slide_index ?? 0) - ((b as any).slide_index ?? 0));
      setViewerDesigns(sorted);
      setViewerIndex(0);
    } else {
      setViewerDesigns([design]);
      setViewerIndex(0);
    }
    setViewerOpen(true);
  };

  const openAssignDialog = (designId: string) => {
    setAssignDesignId(designId);
    setAssignDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="rounded-xl">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h2 className="text-2xl sm:text-3xl font-serif tracking-tight">History</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {designs.length} design{designs.length !== 1 ? "s" : ""} · {videoProjects.length} video{videoProjects.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          </div>

          <Tabs defaultValue={initialTab} className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <TabsList className="rounded-xl">
                <TabsTrigger value="designs" className="rounded-lg gap-1.5 text-xs">
                  <ImageIcon className="h-3.5 w-3.5" /> Designs
                </TabsTrigger>
                <TabsTrigger value="videos" className="rounded-lg gap-1.5 text-xs">
                  <Film className="h-3.5 w-3.5" /> Videos
                </TabsTrigger>
              </TabsList>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl gap-1.5 text-xs"
                onClick={() => setCreateFolderOpen(true)}
              >
                <FolderPlus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">New Folder</span>
              </Button>
            </div>

            {/* === DESIGNS TAB === */}
            <TabsContent value="designs" className="space-y-4">
              {/* Folder pills */}
              {folders.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  <button
                    onClick={() => setActiveFolder(null)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                      !activeFolder
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    All
                  </button>
                  {folders.map((folder: any) => {
                    const count = assignments.filter((a: any) => a.folder_id === folder.id).length;
                    return (
                      <div key={folder.id} className="flex items-center gap-0">
                        {renamingFolder === folder.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              ref={renameRef}
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleRenameFolder(folder.id);
                                if (e.key === "Escape") setRenamingFolder(null);
                              }}
                              onBlur={() => handleRenameFolder(folder.id)}
                              className="h-7 px-2 text-xs rounded-lg border border-input bg-background w-24"
                            />
                          </div>
                        ) : (
                          <button
                            onClick={() => setActiveFolder(activeFolder === folder.id ? null : folder.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                              activeFolder === folder.id
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <div
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{ backgroundColor: folder.color }}
                            />
                            {folder.name}
                            <span className="opacity-50">{count}</span>
                          </button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="h-6 w-6 flex items-center justify-center rounded-lg text-muted-foreground/40 hover:text-foreground hover:bg-muted/40 transition-colors -ml-0.5">
                              <MoreHorizontal className="h-3 w-3" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-36">
                            <DropdownMenuItem
                              onClick={() => {
                                setRenamingFolder(folder.id);
                                setRenameValue(folder.name);
                              }}
                              className="gap-2 text-xs"
                            >
                              <Pencil className="h-3 w-3" />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteFolder(folder.id)}
                              className="gap-2 text-xs text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Design grid */}
              {isLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="aspect-square rounded-xl bg-secondary/60 animate-pulse" />
                  ))}
                </div>
              ) : filteredDesigns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <ImageIcon className="h-12 w-12 text-muted-foreground/40 mb-4" />
                  <p className="text-muted-foreground">
                    {activeFolder ? "No designs in this folder" : "No designs yet"}
                  </p>
                  {!activeFolder && (
                    <Button className="mt-4 rounded-xl" onClick={() => navigate("/studio")}>
                      Create your first design
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {filteredDesigns.map((design, index) => (
                    <motion.div
                      key={design.id}
                      whileHover={{ scale: 1.02 }}
                      className="group relative rounded-xl border border-border overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
                      onClick={() => openViewer(index, design)}
                    >
                      <div className="aspect-square">
                        <img
                          src={design.image_url}
                          alt={design.title || design.prompt}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      {(design as any)._slideCount > 1 && (
                        <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-black/60 text-white text-[10px] font-medium backdrop-blur-sm">
                          <Layers className="h-3 w-3" />
                          {(design as any)._slideCount} slides
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-white text-xs font-medium truncate">
                          {design.title || "Untitled"}
                        </p>
                        <div className="flex items-center justify-between mt-1">
                          <div className="flex items-center gap-1 text-white/70">
                            <Calendar className="h-3 w-3" />
                            <span className="text-[10px]">
                              {format(new Date(design.created_at), "MMM d, yyyy")}
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openAssignDialog(design.id);
                            }}
                            className="h-6 w-6 flex items-center justify-center rounded-lg bg-white/10 text-white/70 hover:bg-white/20 transition-colors"
                          >
                            <FolderPlus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* === VIDEOS TAB === */}
            <TabsContent value="videos" className="space-y-4">
              {videosLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="aspect-[3/4] rounded-xl bg-secondary/60 animate-pulse" />
                  ))}
                </div>
              ) : videoProjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Film className="h-12 w-12 text-muted-foreground/40 mb-4" />
                  <p className="text-muted-foreground">No video projects yet</p>
                  <Button className="mt-4 rounded-xl" onClick={() => navigate("/studio?mode=video")}>
                    Create your first video
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {videoProjects.map((project: any) => {
                    const scenes = (project.video_scenes || []).sort((a: any, b: any) => a.scene_index - b.scene_index);
                    const firstScene = scenes[0];
                    const totalDuration = scenes.reduce((sum: number, s: any) => sum + (s.duration_ms || 0), 0);
                    const intent = project.intent || {};

                    return (
                      <motion.div
                        key={project.id}
                        whileHover={{ scale: 1.02 }}
                        className="group relative rounded-xl border border-border overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
                        onClick={() => {
                          setSelectedVideoProject(project);
                          setVideoViewerOpen(true);
                        }}
                      >
                        <div className="aspect-[3/4] bg-muted">
                          {firstScene?.image_url ? (
                            <img
                              src={firstScene.image_url}
                              alt={intent.goal || "Video"}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Film className="h-8 w-8 text-muted-foreground/40" />
                            </div>
                          )}
                        </div>
                        {/* Badges */}
                        <div className="absolute top-2 right-2 flex items-center gap-1">
                          <Badge variant="secondary" className="text-[9px] bg-black/50 text-white border-none backdrop-blur-sm">
                            {scenes.length} scenes
                          </Badge>
                        </div>
                        {intent.platform && (
                          <div className="absolute top-2 left-2">
                            <Badge variant="secondary" className="text-[9px] bg-black/50 text-white border-none backdrop-blur-sm">
                              {intent.platform}
                            </Badge>
                          </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                          <p className="text-white text-xs font-medium truncate">
                            {intent.goal || "Video Project"}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-white/70">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span className="text-[10px]">{(totalDuration / 1000).toFixed(0)}s</span>
                            </div>
                            <span className="text-[10px]">·</span>
                            <span className="text-[10px]">
                              {format(new Date(project.created_at), "MMM d")}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </motion.div>
      </main>

      {/* Design Viewer */}
      <DesignViewer
        designs={viewerDesigns}
        initialIndex={viewerIndex}
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
        onAddToFolder={(designId) => openAssignDialog(designId)}
      />

      {/* Video Project Viewer */}
      <VideoProjectViewer
        project={selectedVideoProject}
        open={videoViewerOpen}
        onClose={() => setVideoViewerOpen(false)}
      />

      {/* Create Folder Dialog */}
      <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif">New Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
              className="rounded-xl"
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Colour</span>
              <div className="flex gap-1.5">
                {FOLDER_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewFolderColor(color)}
                    className={`h-6 w-6 rounded-full transition-all ${
                      newFolderColor === color ? "ring-2 ring-offset-2 ring-offset-background ring-primary scale-110" : "hover:scale-110"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim()}
              className="rounded-xl w-full"
            >
              Create Folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign to Folder Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif">Add to Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 py-2 max-h-60 overflow-y-auto">
            {folders.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground mb-3">No folders yet</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl gap-1.5"
                  onClick={() => {
                    setAssignDialogOpen(false);
                    setCreateFolderOpen(true);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create a folder
                </Button>
              </div>
            ) : (
              folders.map((folder: any) => {
                const isAssigned = assignments.some(
                  (a: any) => a.design_id === assignDesignId && a.folder_id === folder.id
                );
                return (
                  <button
                    key={folder.id}
                    onClick={() => handleAssignToFolder(folder.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                      isAssigned
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted/50 text-foreground"
                    }`}
                  >
                    <div
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: folder.color }}
                    />
                    <span className="flex-1 text-left truncate">{folder.name}</span>
                    {isAssigned && <Check className="h-4 w-4 text-primary" />}
                  </button>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DesignHistory;
