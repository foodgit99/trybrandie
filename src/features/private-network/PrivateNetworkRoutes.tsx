import { Routes, Route, Navigate } from "react-router-dom";
import { PNGate } from "./components/PNShell";
import Feed from "./pages/Feed";
import Published from "./pages/Published";
import Earnings from "./pages/Earnings";
import Profile from "./pages/Profile";
import Manage from "./pages/Manage";

/** Mounted at /private-network/* — the only registration point in App.tsx. */
export default function PrivateNetworkRoutes() {
  return (
    <PNGate>
      <Routes>
        <Route index element={<Feed />} />
        <Route path="saved" element={<Feed savedOnly />} />
        <Route path="published" element={<Published />} />
        <Route path="earnings" element={<Earnings />} />
        <Route path="profile" element={<Profile />} />
        <Route path="manage" element={<Manage />} />
        <Route path="*" element={<Navigate to="/private-network" replace />} />
      </Routes>
    </PNGate>
  );
}
