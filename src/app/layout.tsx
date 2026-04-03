import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { Sidebar, MobileHeader } from "@/components/layout/Sidebar";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Haussmann",
  description: "Suivi des investissements immobiliers et calculateur de rentabilite",
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
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  );
}
