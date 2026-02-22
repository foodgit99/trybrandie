import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { LogOut, Plus, Palette } from "lucide-react";

const Index = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-6 border-b border-border">
        <h1 className="text-2xl font-serif tracking-tight">Brandie</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{user?.email}</span>
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-8 py-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-12"
        >
          {/* Hero CTA */}
          <section className="text-center space-y-4">
            <h2 className="text-4xl font-serif tracking-tight">What will you design today?</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Describe what you need and your AI creative director will bring it to life — always on brand.
            </p>
            <div className="flex items-center justify-center gap-3 mt-4">
            <Button size="lg" className="h-12 px-8 rounded-xl gap-2" onClick={() => navigate("/studio")}>
              <Plus className="h-4 w-4" />
              Create New Design
            </Button>
            <Button variant="outline" size="lg" className="h-12 px-6 rounded-xl gap-2" onClick={() => navigate("/brand")}>
              <Palette className="h-4 w-4" />
              Brand Centre
            </Button>
            </div>
          </section>

          {/* Recent Designs placeholder */}
          <section className="space-y-4">
            <h3 className="text-lg font-medium text-foreground">Recent designs</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="aspect-square rounded-xl bg-secondary/60 border border-border flex items-center justify-center"
                >
                  <span className="text-sm text-muted-foreground">No designs yet</span>
                </div>
              ))}
            </div>
          </section>
        </motion.div>
      </main>
    </div>
  );
};

export default Index;
