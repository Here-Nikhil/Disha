import type { ReactNode } from "react";
import { AppSidebar, MobileSidebarTrigger } from "@/components/disha/app-sidebar";
import { useAuth } from "@clerk/tanstack-react-start";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { setAuthToken, setTokenRefresher } from "@/lib/api";
import { useStore } from "@/lib/mock-store";

let _dataLoaded = false;

export function AppShell({ children, header }: { children: ReactNode; header?: ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const navigate = useNavigate();
  const loadWorkspaces = useStore((s) => s.loadWorkspaces);
  const loadTools = useStore((s) => s.loadTools);
  const loadApiKeys = useStore((s) => s.loadApiKeys);
  const loadUser = useStore((s) => s.loadUser);
  const initialized = useRef(false);
  const [tokenReady, setTokenReady] = useState(false);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      navigate({ to: "/sign-in" });
    }
  }, [isLoaded, isSignedIn, navigate]);

  useEffect(() => {
    if (isLoaded && isSignedIn && !initialized.current) {
      initialized.current = true;

      const refreshToken = async () => {
        const token = await getToken({ skipCache: true });
        if (token) {
          setAuthToken(token);
        }
        return token;
      };

      setTokenRefresher(async () => {
        try {
          const t = await getToken({ skipCache: true });
          return t;
        } catch {
          return null;
        }
      });

      refreshToken().then(() => {
        setTokenReady(true);
        if (!_dataLoaded) {
          _dataLoaded = true;
          loadWorkspaces();
          loadTools();
          loadApiKeys();
          loadUser();
        }
      });

      const interval = setInterval(refreshToken, 25000);
      return () => clearInterval(interval);
    }
  }, [isLoaded, isSignedIn, getToken, loadWorkspaces, loadTools, loadApiKeys, loadUser]);

  if (!isLoaded || !isSignedIn || !tokenReady) {
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