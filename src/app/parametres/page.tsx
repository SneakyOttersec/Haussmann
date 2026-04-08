"use client";

import { useState } from "react";
import { useAppData } from "@/hooks/useLocalStorage";
import { useProperties } from "@/hooks/useProperties";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { Associe } from "@/types";
import { generateId } from "@/lib/utils";
import { importData, saveData } from "@/lib/storage";
import { signIn, saveToGDrive, loadFromGDrive, isSignedIn } from "@/lib/gdrive";

export default function Parametres() {
  const { data, setData } = useAppData();

  const { deletedProperties, restoreProperty, permanentlyDeleteProperty } = useProperties(data, setData);

  const [driveStatus, setDriveStatus] = useState<'idle' | 'saving' | 'loading' | 'success' | 'error'>('idle');
  const [driveMessage, setDriveMessage] = useState('');
  const [lastSyncDate, setLastSyncDate] = useState<string | null>(null);

  if (!data) return null;

  const { settings } = data;
  const associes = settings.associes ?? [];
  const totalParts = associes.reduce((s, a) => s + a.quotePart, 0);

  const updateSettings = (updates: Partial<typeof settings>) => {
    setData((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...updates },
    }));
  };

  const updateAssocies = (newAssocies: Associe[]) => {
    updateSettings({ associes: newAssocies });
  };

  const updateAssocie = (id: string, updates: Partial<Associe>) => {
    updateAssocies(associes.map((a) => (a.id === id ? { ...a, ...updates } : a)));
  };

  const addAssocie = () => {
    updateAssocies([...associes, { id: generateId(), nom: `Associe ${associes.length + 1}`, quotePart: 0 }]);
  };

  const removeAssocie = (id: string) => {
    if (associes.length <= 1) return;
    updateAssocies(associes.filter((a) => a.id !== id));
  };

  return (
    <div className="space-y-8 max-w-xl">
      <h1>Parametres</h1>

      {/* Societe */}
      <section className="border border-dotted rounded-lg p-5 space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider">Societe</h2>
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Nom de la SC</Label>
          <Input
            value={settings.nomSCI}
            onChange={(e) => updateSettings({ nomSCI: e.target.value })}
            placeholder="Ma SCI"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Regime fiscal</Label>
          <div className="flex gap-2">
            {(["IR", "IS"] as const).map((regime) => (
              <button
                key={regime}
                type="button"
                onClick={() => updateSettings({ regimeFiscal: regime })}
                className={`px-4 py-1.5 rounded-md text-sm transition-colors ${
                  settings.regimeFiscal === regime
                    ? "bg-primary text-primary-foreground font-medium"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                SC a l&apos;{regime}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Associes */}
      <section className="border border-dotted rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider">Associes</h2>
          <button onClick={addAssocie} className="text-xs text-primary hover:underline">+ Ajouter</button>
        </div>
        <div className="space-y-3">
          {associes.map((a) => (
            <div key={a.id} className="flex items-center gap-3">
              <Input
                value={a.nom}
                onChange={(e) => updateAssocie(a.id, { nom: e.target.value })}
                className="flex-1 h-9"
                placeholder="Nom"
              />
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={a.quotePart || ""}
                  onChange={(e) => updateAssocie(a.id, { quotePart: Number(e.target.value) || 0 })}
                  className="w-20 h-9 text-right"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              {associes.length > 1 && (
                <button onClick={() => removeAssocie(a.id)} className="text-destructive text-lg hover:opacity-70">×</button>
              )}
            </div>
          ))}
        </div>
        {totalParts !== 100 && (
          <p className="text-xs text-destructive">Total : {totalParts}% (doit etre 100%)</p>
        )}
        {totalParts === 100 && (
          <p className="text-xs text-green-600">Total : 100%</p>
        )}
      </section>

      {/* Alertes */}
      <section className="border border-dotted rounded-lg p-5 space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider">Alertes</h2>
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Seuil d&apos;alerte tresorerie (EUR)</Label>
          <Input
            type="number"
            value={settings.seuilAlerteTresorerie ?? ""}
            onChange={(e) => updateSettings({ seuilAlerteTresorerie: Number(e.target.value) || 0 })}
            placeholder="Ex: -5000"
          />
          <p className="text-xs text-muted-foreground">Alerte affichee sur la page Finances si le cash flow cumule passe sous ce seuil.</p>
        </div>
      </section>
      {/* Google Drive sync */}
      <section className="border border-dotted rounded-lg p-5 space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider">Sauvegarde Google Drive</h2>

        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Google OAuth Client ID</Label>
          <Input
            value={settings.googleClientId ?? ""}
            onChange={(e) => updateSettings({ googleClientId: e.target.value })}
            placeholder="123456789-xxxx.apps.googleusercontent.com"
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Creer un projet sur{" "}
            <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Google Cloud Console
            </a>
            {" "}→ activer Drive API → creer un ID client OAuth (type Web, origine autorisee : <code className="text-[10px] bg-muted px-1 rounded">{typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}</code>).
          </p>
        </div>

        {settings.googleClientId && (
          <div className="space-y-3 pt-2 border-t border-dashed border-muted-foreground/15">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={driveStatus === 'saving' || driveStatus === 'loading'}
                onClick={async () => {
                  try {
                    setDriveStatus('saving');
                    setDriveMessage('');
                    if (!isSignedIn()) await signIn(settings.googleClientId!);
                    const { savedAt, docsUploaded } = await saveToGDrive(data);
                    setLastSyncDate(savedAt);
                    setDriveStatus('success');
                    setDriveMessage(`Sauvegarde reussie — ${docsUploaded} document${docsUploaded > 1 ? 's' : ''} synchronise${docsUploaded > 1 ? 's' : ''}`);
                  } catch (err) {
                    setDriveStatus('error');
                    setDriveMessage(err instanceof Error ? err.message : 'Erreur inconnue');
                  }
                }}
              >
                {driveStatus === 'saving' ? 'Sauvegarde...' : 'Sauvegarder sur Drive'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={driveStatus === 'saving' || driveStatus === 'loading'}
                onClick={async () => {
                  try {
                    setDriveStatus('loading');
                    setDriveMessage('');
                    if (!isSignedIn()) await signIn(settings.googleClientId!);
                    const restored = await loadFromGDrive();
                    saveData(restored);
                    setData(() => restored);
                    setDriveStatus('success');
                    setDriveMessage('Restauration reussie (donnees + documents)');
                  } catch (err) {
                    setDriveStatus('error');
                    setDriveMessage(err instanceof Error ? err.message : 'Erreur inconnue');
                  }
                }}
              >
                {driveStatus === 'loading' ? 'Restauration...' : 'Restaurer depuis Drive'}
              </Button>
            </div>

            {driveMessage && (
              <p className={`text-xs ${driveStatus === 'error' ? 'text-destructive' : 'text-green-600'}`}>
                {driveMessage}
              </p>
            )}

            {lastSyncDate && driveStatus !== 'error' && (
              <p className="text-[10px] text-muted-foreground">
                Derniere sync : {new Date(lastSyncDate).toLocaleString('fr-FR')}
              </p>
            )}

            <p className="text-[10px] text-muted-foreground">
              Les donnees sont stockees dans un dossier &quot;Haussmann&quot; sur votre Google Drive personnel.
            </p>
          </div>
        )}
      </section>

      {/* Corbeille */}
      {deletedProperties.length > 0 && (
        <section className="border border-dotted rounded-lg p-5 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider">Corbeille ({deletedProperties.length})</h2>
          <div className="space-y-2">
            {deletedProperties.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b border-dotted last:border-0">
                <div>
                  <span className="text-sm font-medium">{p.nom}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    Supprime le {new Date(p.deletedAt!).toLocaleDateString("fr-FR")}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => restoreProperty(p.id)}>
                    Restaurer
                  </Button>
                  <Button variant="outline" size="sm" className="text-destructive" onClick={() => permanentlyDeleteProperty(p.id)}>
                    Supprimer
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
