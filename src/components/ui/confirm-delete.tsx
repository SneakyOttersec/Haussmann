"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConfirmDeleteProps {
  /** What is being deleted, shown in the dialog */
  label: string;
  onConfirm: () => void;
  children?: React.ReactNode;
}

export function ConfirmDelete({ label, onConfirm, children }: ConfirmDeleteProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-destructive text-sm hover:opacity-70 shrink-0"
      >
        {children ?? "×"}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Supprimer <strong className="text-foreground">{label}</strong> ? Cette action est irreversible.
          </p>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="flex-1"
              onClick={() => { onConfirm(); setOpen(false); }}
            >
              Supprimer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
