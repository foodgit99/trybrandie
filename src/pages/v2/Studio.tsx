// V2 Studio - Manual Engine Mode
// Clones the legacy Design Studio surface 1:1 by rendering the shared
// DesignStudio component. Shares ALL frontend and backend functionality
// (chat orchestrator, generation, history, plan mode, sources, ideas,
// brand-strategist, design-orchestrator edge functions). Routed at
// /studio and surfaced from the Engine page when "Manual" mode is on.
import DesignStudio from "@/pages/DesignStudio";

const V2Studio = () => <DesignStudio />;

export default V2Studio;
