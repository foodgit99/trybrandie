import { Routes, Route, Navigate } from "react-router-dom";
import CreatorNetworkGate from "./components/CreatorNetworkGate";
import Overview from "./pages/Overview";
import Work from "./pages/Work";
import Creators from "./pages/Creators";
import CreatorDetail from "./pages/CreatorDetail";
import Businesses from "./pages/Businesses";
import Matches from "./pages/Matches";
import Opportunities from "./pages/Opportunities";
import Production from "./pages/Production";
import Sales from "./pages/Sales";
import Evidence from "./pages/Evidence";
import AiWork from "./pages/AiWork";
import Learning from "./pages/Learning";

/** Mounted at /creator-network/* — the only registration point in App.tsx. */
export default function CreatorNetworkRoutes() {
  return (
    <CreatorNetworkGate>
      <Routes>
        <Route index element={<Overview />} />
        <Route path="work" element={<Work />} />
        <Route path="creators" element={<Creators />} />
        <Route path="creators/:creatorId" element={<CreatorDetail />} />
        <Route path="businesses" element={<Businesses />} />
        <Route path="matches" element={<Matches />} />
        <Route path="opportunities" element={<Opportunities />} />
        <Route path="production" element={<Production />} />
        <Route path="sales" element={<Sales />} />
        <Route path="evidence" element={<Evidence />} />
        <Route path="ai-work" element={<AiWork />} />
        <Route path="learning" element={<Learning />} />
        <Route path="*" element={<Navigate to="/creator-network" replace />} />
      </Routes>
    </CreatorNetworkGate>
  );
}
