"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { AuthProvider } from "@/lib/auth";
import { AuthGuard } from "./AuthGuard";
import { Sidebar } from "./Sidebar";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  // Register service worker for PWA
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return (
    <AuthProvider>
      <AuthGuard>
        {isLoginPage ? (
          children
        ) : (
          <div className="min-h-full flex">
            <Sidebar />
            <main className="flex-1 min-w-0">
              <div className="p-4 pt-16 md:p-6 md:pt-6 lg:p-8">{children}</div>
            </main>
          </div>
        )}
      </AuthGuard>
    </AuthProvider>
  );
}
