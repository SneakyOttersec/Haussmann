"use client";

import { useMemo, useState } from "react";
import { useDonnees } from "@/hooks/useLocalStorage";
import { Input } from "@/components/ui/input";
import type { DonneesApp } from "@/types";
import { listAllDocuments, formatFileSize, type DocumentListEntry } from "@/lib/doc-extract";

/**
 * Delete a document by its key. The key encodes source + location:
 *   phase:propId:phaseName | doc:docId | pret:loanId:index | inter:interId
 */
function deleteDocByKey(key: string, setData: (fn: (prev: DonneesApp) => DonneesApp) => void) {
  const parts = key.split(":");
  const src = parts[0];

  if (src === "phase" && parts.length >= 3) {
    const propId = parts[1];
    const phase = parts.slice(2).join(":");
    setData((prev) => ({
      ...prev,
      biens: prev.biens.map((p) => {
        if (p.id !== propId || !p.statusDocs) return p;
        const { [phase]: _, ...rest } = p.statusDocs as Record<string, unknown>;
        return { ...p, statusDocs: rest as typeof p.statusDocs };
      }),
    }));
  } else if (src === "doc" && parts[1]) {
    const docId = parts[1];
    setData((prev) => ({
      ...prev,
      documents: (prev.documents ?? []).filter((d) => d.id !== docId),
    }));
  } else if (src === "pret" && parts.length >= 3) {
    const loanId = parts[1];
    const idx = Number(parts[2]);
    setData((prev) => ({
      ...prev,
      prets: prev.prets.map((l) => {
        if (l.id !== loanId) return l;
        return { ...l, documents: (l.documents ?? []).filter((_, i) => i !== idx) };
      }),
    }));
  } else if (src === "inter" && parts[1]) {
    const interId = parts[1];
    setData((prev) => ({
      ...prev,
      interventions: (prev.interventions ?? []).map((i) =>
        i.id === interId ? { ...i, pieceJointe: undefined } : i,
      ),
    }));
  }
}

export default function DocumentsPage() {
  const { data, setData } = useDonnees();

  const documents = useMemo(() => (data ? listAllDocuments(data) : []), [data]);
  const documentsTotalSize = useMemo(
    () => documents.reduce((s, d) => s + (d.fileSize ?? 0), 0),
    [documents],
  );
  const [docFilter, setDocFilter] = useState("");
  const filteredDocuments = useMemo(() => {
    if (!docFilter.trim()) return documents;
    const q = docFilter.toLowerCase();
    return documents.filter(
      (d) =>
        d.fileName.toLowerCase().includes(q) ||
        d.propertyName.toLowerCase().includes(q) ||
        d.sourceLabel.toLowerCase().includes(q),
    );
  }, [documents, docFilter]);

  if (!data) return null;

  const downloadDoc = (entry: { fileName: string; dataUri: string }) => {
    const a = document.createElement("a");
    a.href = entry.dataUri;
    a.download = entry.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1>Documents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tous les fichiers uploades : phases d&apos;un bien, documents proprietaire,
            pieces jointes credit, devis/factures interventions.
          </p>
        </div>
        {documents.length > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
            {documents.length} fichier{documents.length > 1 ? "s" : ""} · {formatFileSize(documentsTotalSize)}
          </span>
        )}
      </div>

      {documents.length === 0 ? (
        <div className="border border-dashed border-muted-foreground/30 rounded-md p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Aucun document uploade pour le moment.
          </p>
        </div>
      ) : (
        <>
          <Input
            value={docFilter}
            onChange={(e) => setDocFilter(e.target.value)}
            placeholder="Rechercher par nom de fichier, bien ou type..."
            className="h-9 text-xs"
          />
          <div className="border border-dotted rounded-md overflow-y-auto max-h-[calc(100vh-250px)]">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-background border-b border-dashed border-muted-foreground/20">
                <tr>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Fichier</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Bien</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Source</th>
                  <th className="text-right py-2 px-3 text-muted-foreground font-medium">Taille</th>
                  <th className="text-right py-2 px-3 text-muted-foreground font-medium">Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredDocuments.map((d) => (
                  <tr
                    key={d.key}
                    className={`border-b border-dotted last:border-0 hover:bg-muted/30 ${d.isDuplicate ? "bg-amber-500/5" : ""}`}
                  >
                    <td className="py-1.5 px-3 font-medium">
                      <button onClick={() => downloadDoc(d)} className="text-primary hover:underline truncate max-w-[260px] block text-left">
                        {d.fileName}
                      </button>
                      {d.isDuplicate && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/15 text-amber-700 ml-1">doublon</span>
                      )}
                    </td>
                    <td className="py-1.5 px-3 truncate max-w-[180px] text-muted-foreground">{d.propertyName}</td>
                    <td className="py-1.5 px-3 text-muted-foreground">{d.sourceLabel}</td>
                    <td className="py-1.5 px-3 text-right tabular-nums text-muted-foreground">{formatFileSize(d.fileSize)}</td>
                    <td className="py-1.5 px-3 text-right tabular-nums text-muted-foreground">
                      {d.date ? new Date(d.date).toLocaleDateString("fr-FR") : "—"}
                    </td>
                    <td className="py-1.5 px-1">
                      <button
                        onClick={() => deleteDocByKey(d.key, setData)}
                        className="text-destructive/40 hover:text-destructive text-sm transition-colors"
                        title="Supprimer ce document"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredDocuments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-3 px-3 text-center text-muted-foreground">
                      Aucun document ne correspond a la recherche.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
