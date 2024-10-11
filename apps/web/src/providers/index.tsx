"use client";
import { SonnerToaster } from "@repo/ui";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";

export function Providers({ children }: React.PropsWithChildren) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <SessionProvider>
        <SonnerToaster />
        {children}
      </SessionProvider>
    </ThemeProvider>
  );
}
