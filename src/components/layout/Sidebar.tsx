"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { exportData, importData } from "@/lib/storage";
import { toast } from "sonner";

const gestionItems = [
  { href: "/", label: "Portefeuille", icon: "⌂" },
  { href: "/finances", label: "Finances", icon: "€" },
  { href: "/loyers", label: "Loyers", icon: "◷" },
];

const outilsItems = [
  { href: "/simulateur", label: "Simulateur", icon: "⚙" },
  { href: "/comparateur", label: "Comparateur", icon: "⇔" },
  { href: "/scenarios", label: "Scenarios", icon: "↗" },
];

const configItems = [
  { href: "/parametres", label: "Parametres", icon: "☰" },
];

export function Sidebar() {
  const pathname = usePathname();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/" || pathname.startsWith("/biens");
    return pathname.startsWith(href);
  };

  const handleExport = () => {
    const json = exportData();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sci-immobilier-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Donnees exportees");
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importData(reader.result as string);
        toast.success("Donnees importees — rechargement...");
        setTimeout(() => window.location.reload(), 500);
      } catch {
        toast.error("Fichier invalide");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <aside className="hidden md:flex flex-col w-48 shrink-0 border-r border-dashed border-muted-foreground/20 bg-background sticky top-0 h-screen">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-dashed border-muted-foreground/20">
        <Link href="/" className="text-primary font-bold text-base hover:opacity-80 transition-opacity">
          Haussmann
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-4">
        <div className="space-y-1">
          <p className="px-3 text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1">Gestion</p>
          {gestionItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
                isActive(item.href)
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <span className="text-xs opacity-70">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>

        <div className="space-y-1">
          <p className="px-3 text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1">Outils</p>
          {outilsItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
                isActive(item.href)
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <span className="text-xs opacity-70">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>

        <div className="space-y-1">
          <p className="px-3 text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1">Configuration</p>
          {configItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
                isActive(item.href)
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <span className="text-xs opacity-70">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>

        <div className="space-y-1">
          <p className="px-3 text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1">Donnees</p>
          <button
            onClick={handleExport}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <span className="text-xs opacity-70">↓</span>
            Exporter
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <span className="text-xs opacity-70">↑</span>
            Importer
          </button>
        </div>
      </nav>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleImport}
        className="hidden"
      />
    </aside>
  );
}

export function MobileHeader() {
  const pathname = usePathname();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/" || pathname.startsWith("/biens");
    return pathname.startsWith(href);
  };

  const handleExport = () => {
    const json = exportData();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sci-immobilier-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Donnees exportees");
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importData(reader.result as string);
        toast.success("Donnees importees — rechargement...");
        setTimeout(() => window.location.reload(), 500);
      } catch {
        toast.error("Fichier invalide");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <header className="md:hidden border-b border-dashed border-muted-foreground/30 sticky top-0 z-40 bg-background/95 backdrop-blur-sm">
      <div className="px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-primary font-bold text-base hover:opacity-80 transition-opacity">
          Haussmann
        </Link>
        <div className="flex items-center gap-1">
          {[...gestionItems, ...outilsItems, ...configItems].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "text-xs px-2 py-1 rounded transition-colors",
                isActive(item.href)
                  ? "text-primary font-semibold bg-primary/10"
                  : "text-muted-foreground"
              )}
            >
              {item.label}
            </Link>
          ))}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="text-muted-foreground hover:text-primary text-sm px-1 ml-1"
          >
            ...
          </button>
        </div>
      </div>
      {menuOpen && (
        <div className="border-t border-dashed border-muted-foreground/20 px-4 py-2 flex gap-3">
          <button onClick={() => { handleExport(); setMenuOpen(false); }} className="text-xs text-muted-foreground hover:text-primary">
            Exporter
          </button>
          <button onClick={() => { fileInputRef.current?.click(); setMenuOpen(false); }} className="text-xs text-muted-foreground hover:text-primary">
            Importer
          </button>
        </div>
      )}
      <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
    </header>
  );
}
