import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { Header } from "@/components/layout/Header";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SCI Immobilier",
  description: "Suivi des investissements immobiliers et calculateur de rentabilite",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${jetbrainsMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-mono">
        <TooltipProvider>
          <Header />
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
            {children}
          </main>
          <footer className="border-t border-dashed border-muted-foreground/30 py-4 text-center text-xs text-muted-foreground">
            SCI Immobilier — Prototype
          </footer>
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  );
}
