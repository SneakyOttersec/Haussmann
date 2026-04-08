"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { importData, loadDataWithBlobs, saveData, exportDataAsZip, importDataFromZip } from "@/lib/storage";
import { signIn, saveToGDrive, loadFromGDrive, isSignedIn } from "@/lib/gdrive";
import { toast } from "sonner";

function useCurrentDate() {
  const [date, setDate] = useState<string | null>(null);
  useEffect(() => {
    const format = () =>
      new Date().toLocaleDateString("fr-FR", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    setDate(format());
    // Refresh at midnight in case the session stays open
    const ms = new Date().setHours(24, 0, 0, 0) - Date.now();
    const timeout = setTimeout(() => setDate(format()), ms + 1000);
    return () => clearTimeout(timeout);
  }, []);
  return date;
}

const gestionItems = [
  { href: "/", label: "Portefeuille", icon: "⌂" },
  { href: "/finances", label: "Finances", icon: "€" },
  { href: "/loyers", label: "Loyers & Charges", icon: "◷" },
];

const outilsItems = [
  { href: "/simulateur", label: "Simulateur", icon: "⚙" },
  { href: "/comparateur", label: "Comparateur", icon: "⇔" },
  { href: "/scenarios", label: "Scenarios", icon: "↗" },
];

const configItems = [
  { href: "/parametres", label: "Parametres", icon: "☰" },
];

function getClientId(): string | null {
  try {
    const raw = localStorage.getItem('sci-immobilier-data');
    if (!raw) return null;
    return JSON.parse(raw)?.settings?.googleClientId ?? null;
  } catch { return null; }
}

export function Sidebar() {
  const pathname = usePathname();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const today = useCurrentDate();
  const [driveBusy, setDriveBusy] = useState(false);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/" || pathname.startsWith("/biens");
    return pathname.startsWith(href);
  };

  const handleExport = async () => {
    try {
      const data = await loadDataWithBlobs();
      const blob = await exportDataAsZip(data);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `haussmann-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Donnees exportees (ZIP)");
    } catch {
      toast.error("Erreur lors de l'export");
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (file.name.endsWith('.zip')) {
        await importDataFromZip(file);
      } else {
        const text = await file.text();
        importData(text);
      }
      toast.success("Donnees importees — rechargement...");
      setTimeout(() => window.location.reload(), 500);
    } catch {
      toast.error("Fichier invalide");
    }
    e.target.value = "";
  };

  const handleDriveSave = async () => {
    const clientId = getClientId();
    if (!clientId) { toast.error('Client ID Google manquant', { description: 'Configurez-le dans Parametres → Sauvegarde Google Drive' }); return; }
    try {
      setDriveBusy(true);
      if (!isSignedIn()) await signIn(clientId);
      const data = await loadDataWithBlobs();
      const { docsUploaded } = await saveToGDrive(data);
      toast.success('Sauvegarde Drive reussie', { description: `${docsUploaded} document${docsUploaded !== 1 ? 's' : ''} synchronise${docsUploaded !== 1 ? 's' : ''}` });
    } catch (err) {
      toast.error('Erreur Drive', { description: err instanceof Error ? err.message : 'Erreur inconnue' });
    } finally { setDriveBusy(false); }
  };

  const handleDriveRestore = async () => {
    const clientId = getClientId();
    if (!clientId) { toast.error('Client ID Google manquant', { description: 'Configurez-le dans Parametres → Sauvegarde Google Drive' }); return; }
    try {
      setDriveBusy(true);
      if (!isSignedIn()) await signIn(clientId);
      const restored = await loadFromGDrive();
      saveData(restored);
      toast.success('Restauration Drive reussie — rechargement...');
      setTimeout(() => window.location.reload(), 500);
    } catch (err) {
      toast.error('Erreur Drive', { description: err instanceof Error ? err.message : 'Erreur inconnue' });
    } finally { setDriveBusy(false); }
  };

  return (
    <aside className="hidden md:flex flex-col w-48 shrink-0 border-r border-dashed border-muted-foreground/20 bg-background sticky top-0 h-screen">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-dashed border-muted-foreground/20">
        <Link href="/" className="text-primary font-bold text-base hover:opacity-80 transition-opacity">
          Haussmann
        </Link>
        {today && (
          <p className="text-[10px] text-muted-foreground/70 mt-0.5 capitalize tabular-nums">{today}</p>
        )}
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
          <p className="px-3 text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1">Donnees</p>
          {/* Sauvegarder — hover submenu */}
          <div className="group/save relative">
            <button
              disabled={driveBusy}
              className="flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40"
            >
              <span className="text-xs opacity-70">↓</span>
              {driveBusy ? 'Sync...' : 'Sauvegarder'}
            </button>
            <div className="invisible group-hover/save:visible absolute left-full top-0 ml-1 z-50 bg-background border border-muted-foreground/20 rounded-md shadow-lg py-1 min-w-[150px]">
              <button
                onClick={handleDriveSave}
                disabled={driveBusy}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40"
              >
                <span className="opacity-70">☁</span> Google Drive
              </button>
              <button
                onClick={handleExport}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <span className="opacity-70">{ }</span> Fichier ZIP
              </button>
            </div>
          </div>
          {/* Restaurer — hover submenu */}
          <div className="group/load relative">
            <button
              disabled={driveBusy}
              className="flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40"
            >
              <span className="text-xs opacity-70">↑</span>
              Restaurer
            </button>
            <div className="invisible group-hover/load:visible absolute left-full top-0 ml-1 z-50 bg-background border border-muted-foreground/20 rounded-md shadow-lg py-1 min-w-[150px]">
              <button
                onClick={handleDriveRestore}
                disabled={driveBusy}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40"
              >
                <span className="opacity-70">☁</span> Google Drive
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <span className="opacity-70">{ }</span> Fichier ZIP
              </button>
            </div>
          </div>
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
      </nav>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.zip"
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
  const [driveBusy, setDriveBusy] = useState(false);
  const today = useCurrentDate();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/" || pathname.startsWith("/biens");
    return pathname.startsWith(href);
  };

  const handleExport = async () => {
    try {
      const data = await loadDataWithBlobs();
      const blob = await exportDataAsZip(data);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `haussmann-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Donnees exportees (ZIP)");
    } catch {
      toast.error("Erreur lors de l'export");
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (file.name.endsWith('.zip')) {
        await importDataFromZip(file);
      } else {
        const text = await file.text();
        importData(text);
      }
      toast.success("Donnees importees — rechargement...");
      setTimeout(() => window.location.reload(), 500);
    } catch {
      toast.error("Fichier invalide");
    }
    e.target.value = "";
  };

  return (
    <header className="md:hidden border-b border-dashed border-muted-foreground/30 sticky top-0 z-40 bg-background/95 backdrop-blur-sm">
      <div className="px-4 py-3 flex items-center justify-between">
        <div>
          <Link href="/" className="text-primary font-bold text-base hover:opacity-80 transition-opacity">
            Haussmann
          </Link>
          {today && (
            <p className="text-[9px] text-muted-foreground/70 leading-none capitalize tabular-nums">{today}</p>
          )}
        </div>
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
        <div className="border-t border-dashed border-muted-foreground/20 px-4 py-2 space-y-1">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground/50">Sauvegarder</p>
          <div className="flex gap-3">
            <button
              disabled={driveBusy}
              onClick={async () => {
                const clientId = getClientId();
                if (!clientId) { toast.error('Client ID Google manquant', { description: 'Parametres → Sauvegarde Google Drive' }); return; }
                try {
                  setDriveBusy(true);
                  if (!isSignedIn()) await signIn(clientId);
                  const d = await loadDataWithBlobs();
                  const { docsUploaded } = await saveToGDrive(d);
                  toast.success('Sauvegarde Drive reussie', { description: `${docsUploaded} doc(s)` });
                } catch (err) { toast.error('Erreur Drive', { description: err instanceof Error ? err.message : 'Erreur' }); }
                finally { setDriveBusy(false); setMenuOpen(false); }
              }}
              className="text-xs text-muted-foreground hover:text-primary disabled:opacity-40"
            >
              ☁ Drive
            </button>
            <button onClick={() => { handleExport(); setMenuOpen(false); }} className="text-xs text-muted-foreground hover:text-primary">
              { } ZIP
            </button>
          </div>
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground/50 pt-1">Restaurer</p>
          <div className="flex gap-3">
            <button
              disabled={driveBusy}
              onClick={async () => {
                const clientId = getClientId();
                if (!clientId) { toast.error('Client ID Google manquant', { description: 'Parametres → Sauvegarde Google Drive' }); return; }
                try {
                  setDriveBusy(true);
                  if (!isSignedIn()) await signIn(clientId);
                  const restored = await loadFromGDrive();
                  saveData(restored);
                  toast.success('Restauration Drive reussie — rechargement...');
                  setTimeout(() => window.location.reload(), 500);
                } catch (err) { toast.error('Erreur Drive', { description: err instanceof Error ? err.message : 'Erreur' }); }
                finally { setDriveBusy(false); setMenuOpen(false); }
              }}
              className="text-xs text-muted-foreground hover:text-primary disabled:opacity-40"
            >
              ☁ Drive
            </button>
            <button onClick={() => { fileInputRef.current?.click(); setMenuOpen(false); }} className="text-xs text-muted-foreground hover:text-primary">
              { } ZIP
            </button>
          </div>
        </div>
      )}
      <input ref={fileInputRef} type="file" accept=".json,.zip" onChange={handleImport} className="hidden" />
    </header>
  );
}
