import type { ReactNode } from "react";
import { AppSidebar, MobileSidebarTrigger } from "@/components/disha/app-sidebar";
import { useAuth } from "@clerk/tanstack-react-start";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { setAuthToken } from "@/lib/api";
import { useStore } from "@/lib/mock-store";

export function AppShell({ children, header }: { children: ReactNode; header?: ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const navigate = useNavigate();
  const loadWorkspaces = useStore((s) => s.loadWorkspaces);
  const loadTools = useStore((s) => s.loadTools);
  const loadApiKeys = useStore((s) => s.loadApiKeys);
  const initialized = useRef(false);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      navigate({ to: "/sign-in" });
    }
  }, [isLoaded, isSignedIn, navigate]);

  useEffect(() => {
    if (isLoaded && isSignedIn && !initialized.current) {
      initialized.current = true;

      const refreshToken = async () => {
        const token = await getToken();
        if (token) {
          setAuthToken(token);
        }
      };

      refreshToken().then(() => {
        loadWorkspaces();
        loadTools();
        loadApiKeys();
      });

      const interval = setInterval(refreshToken, 50000);
      return () => clearInterval(interval);
    }
  }, [isLoaded, isSignedIn, getToken, loadWorkspaces, loadTools]);

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4 md:px-6">
          <MobileSidebarTrigger />
          <div className="min-w-0 flex-1">{header}</div>
        </div>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}