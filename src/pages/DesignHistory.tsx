import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import AppHeader from "@/components/AppHeader";

const DesignHistory = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: designs, isLoading } = useQuery({
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

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
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
            <div>
              <h2 className="text-2xl sm:text-3xl font-serif tracking-tight">Design History</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {designs?.length ?? 0} designs created
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="aspect-square rounded-xl bg-secondary/60 animate-pulse" />
              ))}
            </div>
          ) : !designs || designs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <ImageIcon className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <p className="text-muted-foreground">No designs yet</p>
              <Button className="mt-4 rounded-xl" onClick={() => navigate("/studio")}>
                Create your first design
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {designs.map((design) => (
                <motion.div
                  key={design.id}
                  whileHover={{ scale: 1.02 }}
                  className="group relative rounded-xl border border-border overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all"
                  onClick={() => navigate(`/studio?design=${design.id}`)}
                >
                  <div className="aspect-square">
                    <img
                      src={design.image_url}
                      alt={design.title || design.prompt}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-white text-xs font-medium truncate">
                      {design.title || "Untitled"}
                    </p>
                    <div className="flex items-center gap-1 mt-1 text-white/70">
                      <Calendar className="h-3 w-3" />
                      <span className="text-[10px]">
                        {format(new Date(design.created_at), "MMM d, yyyy")}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
};

export default DesignHistory;
