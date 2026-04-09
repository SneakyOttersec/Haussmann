import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { Sidebar, MobileHeader } from "@/components/layout/Sidebar";
import { AuthProvider } from "@/components/auth/AuthProvider";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Haussmann",
  description: "Suivi des investissements immobiliers et simulateur de rentabilite",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${jetbrainsMono.variable} h-full antialiased`}>
      <body className="min-h-full flex font-mono">
        <TooltipProvider>
          <AuthProvider>
            <Sidebar />
            <div className="flex-1 flex flex-col min-h-screen">
              <MobileHeader />
              <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-8">
                {children}
              </main>
              <footer className="border-t border-dashed border-muted-foreground/30 py-4 text-center text-xs text-muted-foreground">
                Haussmann — Prototype
              </footer>
            </div>
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  );
}
