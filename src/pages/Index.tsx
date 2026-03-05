import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Plus, Palette } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppHeader from "@/components/AppHeader";

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: designs } = useQuery({
    queryKey: ["recent-designs", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("designs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      {/* Main */}
      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-10 sm:py-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-10 sm:space-y-12"
        >
          {/* Hero CTA */}
          <section className="text-center space-y-4">
            <h2 className="text-3xl sm:text-4xl font-serif tracking-tight">What will you design today?</h2>
            <p className="text-muted-foreground max-w-md mx-auto text-sm sm:text-base">
              Describe what you need and your AI creative director will bring it to life — always on brand.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-4">
            <Button size="lg" className="h-12 px-8 rounded-xl gap-2 w-full sm:w-auto" onClick={() => navigate("/studio")}>
              <Plus className="h-4 w-4" />
              Create New Design
            </Button>
            <Button variant="outline" size="lg" className="h-12 px-6 rounded-xl gap-2 w-full sm:w-auto" onClick={() => navigate("/brand")}>
              <Palette className="h-4 w-4" />
              Brand Centre
            </Button>
            </div>
          </section>

          {/* Recent Designs */}
          <section className="space-y-4">
            <h3 className="text-lg font-medium text-foreground">Recent designs</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {(!designs || designs.length === 0) ? (
                [1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="aspect-square rounded-xl bg-secondary/60 border border-border flex items-center justify-center"
                  >
                    <span className="text-sm text-muted-foreground">No designs yet</span>
                  </div>
                ))
              ) : (
                designs.map((design) => (
                  <div
                    key={design.id}
                    className="aspect-square rounded-xl border border-border overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all"
                    onClick={() => navigate(`/studio?design=${design.id}`)}
                  >
                    <img
                      src={design.image_url}
                      alt={design.title || design.prompt}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))
              )}
            </div>
          </section>
        </motion.div>
      </main>
    </div>
  );
};

export default Index;
