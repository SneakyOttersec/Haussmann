"use client";

import { useRef } from "react";
import type { Attachment } from "@/types";
import { toast } from "sonner";

const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30 MB per file

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

const ICON_MAP: Record<string, string> = {
  "application/pdf": "PDF",
  "image/png": "PNG",
  "image/jpeg": "JPG",
  "image/webp": "WEBP",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
  "application/vnd.ms-excel": "XLS",
  "text/plain": "TXT",
};

function fileTag(type: string): string {
  return ICON_MAP[type] ?? type.split("/").pop()?.toUpperCase().slice(0, 4) ?? "FILE";
}

interface AttachmentsPanelProps {
  attachments: Attachment[];
  onChange: (attachments: Attachment[]) => void;
}

export function AttachmentsPanel({ attachments, onChange }: AttachmentsPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`"${file.name}" depasse 30 Mo`);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const attachment: Attachment = {
          id: crypto.randomUUID(),
          nom: file.name,
          type: file.type,
          taille: file.size,
          data: reader.result as string,
          ajouteLe: new Date().toISOString(),
        };
        onChange([...attachments, attachment]);
      };
      reader.readAsDataURL(file);
    });

    e.target.value = "";
  };

  const handleRemove = (id: string) => {
    onChange(attachments.filter((a) => a.id !== id));
  };

  const handleDownload = (attachment: Attachment) => {
    const a = document.createElement("a");
    a.href = attachment.data;
    a.download = attachment.nom;
    a.click();
  };

  return (
    <div className="border border-dotted rounded-lg p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider">Pieces jointes</h2>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-[11px] text-primary hover:underline"
        >
          + Ajouter un fichier
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.txt"
          onChange={handleAdd}
          className="hidden"
        />
      </div>

      {attachments.length === 0 ? (
        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-muted-foreground/20 rounded-md p-6 text-center cursor-pointer hover:border-primary/40 transition-colors"
        >
          <p className="text-xs text-muted-foreground">
            Devis, audit energetique, photos, DPE...
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            Cliquer ou glisser-deposer (max 30 Mo/fichier)
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="group flex items-center gap-2.5 rounded-md border border-input px-3 py-2 text-xs hover:bg-muted/50 transition-colors"
            >
              <span className="shrink-0 w-9 h-5 flex items-center justify-center rounded bg-primary/10 text-primary text-[9px] font-bold">
                {fileTag(att.type)}
              </span>
              <button
                onClick={() => handleDownload(att)}
                className="flex-1 min-w-0 text-left hover:text-primary truncate"
                title={att.nom}
              >
                {att.nom}
              </button>
              <span className="shrink-0 text-muted-foreground/60 text-[10px]">
                {formatSize(att.taille)}
              </span>
              <button
                onClick={() => handleRemove(att.id)}
                className="shrink-0 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive/80 transition-opacity"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full border border-dashed border-muted-foreground/20 rounded-md py-1.5 text-[10px] text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
          >
            + Ajouter
          </button>
        </div>
      )}
    </div>
  );
}
