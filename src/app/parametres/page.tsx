"use client";

import { useAppData } from "@/hooks/useLocalStorage";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Associe } from "@/types";
import { generateId } from "@/lib/utils";

export default function Parametres() {
  const { data, setData } = useAppData();

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
    </div>
  );
}
