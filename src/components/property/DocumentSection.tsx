"use client";

import { useRef, useState } from "react";
import type { PropertyDocument, DocumentCategory } from "@/types";
import { DOCUMENT_CATEGORY_LABELS } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Props {
  documents: PropertyDocument[];
  onAdd: (data: Omit<PropertyDocument, "id">) => void;
  onDelete: (id: string) => void;
  propertyId: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function DocumentSection({ documents, onAdd, onDelete, propertyId }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [categorie, setCategorie] = useState<DocumentCategory>("autre");

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Fichier trop volumineux (max 5 Mo)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onAdd({
        propertyId,
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

  const download = (doc: PropertyDocument) => {
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
            {Object.entries(DOCUMENT_CATEGORY_LABELS).map(([k, label]) => (
              <button key={k} type="button" onClick={() => setCategorie(k as DocumentCategory)}
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
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">{DOCUMENT_CATEGORY_LABELS[doc.categorie]}</span>
                <button onClick={() => download(doc)} className="flex-1 text-left text-primary hover:underline truncate">{doc.nom}</button>
                <span className="text-xs text-muted-foreground shrink-0">{formatSize(doc.taille)}</span>
                <span className="text-xs text-muted-foreground shrink-0">{doc.ajouteLe}</span>
                <button onClick={() => onDelete(doc.id)} className="text-destructive text-sm hover:opacity-70 shrink-0">×</button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
