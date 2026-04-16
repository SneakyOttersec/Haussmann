"use client";

import { useRef, useState } from "react";
import type { DocumentBien, CategorieDocument } from "@/types";
import { CATEGORIE_DOCUMENT_LABELS } from "@/types";
import { checkFileSize } from "@/lib/utils";
import { ConfirmDelete } from "@/components/ui/confirm-delete";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/** A read-only doc entry from another source (timeline, credit, intervention). */
export interface LinkedDoc {
  key: string;
  sourceLabel: string;
  fileName: string;
  fileSize: number;
  date: string;
  dataUri: string;
}

interface Props {
  documents: DocumentBien[];
  onAdd: (data: Omit<DocumentBien, "id">) => void;
  onDelete: (id: string) => void;
  bienId: string;
  /** Documents from other sources (timeline phases, pret PJs, intervention PJs). Read-only. */
  linkedDocs?: LinkedDoc[];
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function SectionDocuments({ documents, onAdd, onDelete, bienId, linkedDocs = [] }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [categorie, setCategorie] = useState<CategorieDocument>("autre");

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !checkFileSize(file)) return;
    const reader = new FileReader();
    reader.onload = () => {
      onAdd({
        bienId,
        nom: file.name,
        categorie,
        data: reader.result as string,
        type: file.type,
        taille: file.size,
        ajouteLe: new Date().toISOString().slice(0, 10),
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const download = (doc: DocumentBien) => {
    const a = document.createElement("a");
    a.href = doc.data;
    a.download = doc.nom;
    a.click();
  };

  return (
    <Card className="border-dotted">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Documents</CardTitle>
        <div className="flex items-center gap-2">
          <div className="flex flex-wrap gap-1">
            {Object.entries(CATEGORIE_DOCUMENT_LABELS).map(([k, label]) => (
              <button key={k} type="button" onClick={() => setCategorie(k as CategorieDocument)}
                className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${categorie === k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              >{label}</button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>+ Document</Button>
        </div>
      </CardHeader>
      <CardContent>
        <input ref={fileRef} type="file" onChange={handleFile} className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" />
        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun document. Selectionnez une categorie puis cliquez sur + Document.</p>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 text-sm py-1.5 border-b border-dashed border-muted-foreground/10 last:border-0">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">{CATEGORIE_DOCUMENT_LABELS[doc.categorie]}</span>
                <button onClick={() => download(doc)} className="flex-1 text-left text-primary hover:underline truncate">{doc.nom}</button>
                <span className="text-xs text-muted-foreground shrink-0">{formatSize(doc.taille)}</span>
                <span className="text-xs text-muted-foreground shrink-0">{doc.ajouteLe}</span>
                <ConfirmDelete label={doc.nom} onConfirm={() => onDelete(doc.id)} />
              </div>
            ))}
          </div>
        )}
        {/* Linked documents from other sources (read-only) */}
        {linkedDocs.length > 0 && (
          <div className={documents.length > 0 ? "mt-3 pt-3 border-t border-dashed border-muted-foreground/15" : ""}>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
              Autres documents ({linkedDocs.length})
            </p>
            <div className="space-y-2">
              {linkedDocs.map((doc) => (
                <div key={doc.key} className="flex items-center gap-3 text-sm py-1.5 border-b border-dashed border-muted-foreground/10 last:border-0 opacity-80">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">{doc.sourceLabel}</span>
                  <button onClick={() => download({ nom: doc.fileName, data: doc.dataUri } as DocumentBien)} className="flex-1 text-left text-primary hover:underline truncate">{doc.fileName}</button>
                  <span className="text-xs text-muted-foreground shrink-0">{formatSize(doc.fileSize)}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{doc.date ? new Date(doc.date).toLocaleDateString("fr-FR") : "—"}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
