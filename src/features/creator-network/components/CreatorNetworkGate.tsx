import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { LoadingState } from "@/components/ui/spinner";
import NewAppHeader from "@/components/v2/NewAppHeader";
import { useCreatorNetwork } from "../hooks/useCreatorNetwork";

export default function CreatorNetworkGate({ children }: { children: ReactNode }) {
  const cn = useCreatorNetwork();
  if (cn.loading) return <div className="flex min-h-screen items-center justify-center"><LoadingState label="Loading" /></div>;
  if (!cn.enabled) return <Navigate to="/" replace />;
  if (!cn.canAccess)
    return (
      <div className="min-h-screen bg-background lg:pl-20">
        <NewAppHeader />
        <main className="mx-auto max-w-md px-4 py-20 text-center space-y-2">
          <h1 className="text-xl font-semibold">Access restricted</h1>
          <p className="text-sm text-muted-foreground">Creator Network is an internal Brandie workspace. Ask a Brandie admin to add you as an operator.</p>
        </main>
      </div>
    );
  return <>{children}</>;
}
