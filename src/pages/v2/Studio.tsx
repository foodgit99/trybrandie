// V2 Studio, Manual Engine Mode
// Clones the legacy Design Studio surface 1:1 by rendering the shared
// DesignStudio component. Shares ALL frontend and backend functionality
// (chat orchestrator, generation, history, plan mode, sources, ideas,
// brand-strategist, design-orchestrator edge functions). Routed at
// /studio and surfaced from the Engine page when "Manual" mode is on.
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import DesignStudio from "@/pages/DesignStudio";

const V2Studio = () => (
  <div className="relative">
    <div className="sticky top-0 z-30 w-full border-b border-border/50 bg-background/95 backdrop-blur-sm px-4 py-2.5 sm:px-6 sm:py-3">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <p className="text-xs sm:text-sm text-muted-foreground">
          <span className="hidden sm:inline">Try the new structured design canvas —</span>
          <span className="sm:hidden">Structured design canvas —</span>
          {" "}
          <span className="font-medium text-foreground">edit layouts, text, and layers directly.</span>
        </p>
        <Button asChild size="sm" variant="outline" className="shrink-0 gap-1.5 rounded-full h-8 text-xs sm:text-sm">
          <Link to="/studio/canvas">
            <Sparkles className="h-3.5 w-3.5" />
            Open Canvas
          </Link>
        </Button>
      </div>
    </div>
    <DesignStudio />
  </div>
);

export default V2Studio;
