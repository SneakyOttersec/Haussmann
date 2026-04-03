"use client";

import { useState } from "react";
import type { Contact, ContactRole } from "@/types";
import { CONTACT_ROLE_LABELS } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Props {
  contacts: Contact[];
  onAdd: (data: Omit<Contact, "id" | "createdAt" | "updatedAt">) => void;
  onUpdate: (id: string, updates: Partial<Contact>) => void;
  onDelete: (id: string) => void;
  propertyId: string;
}

function ContactRow({ contact: c, onUpdate, onDelete }: {
  contact: Contact;
  onUpdate: (id: string, updates: Partial<Contact>) => void;
  onDelete: (id: string) => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [edit, setEdit] = useState({ nom: c.nom, role: c.role, telephone: c.telephone || "", email: c.email || "", notes: c.notes || "" });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate(c.id, { ...edit, telephone: edit.telephone || undefined, email: edit.email || undefined, notes: edit.notes || undefined });
    setEditOpen(false);
  };

  return (
    <>
      <div className="flex items-center gap-3 text-sm py-1.5 border-b border-dashed border-muted-foreground/10 last:border-0">
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">{CONTACT_ROLE_LABELS[c.role]}</span>
        <button
          className="font-medium flex-1 text-left hover:text-primary transition-colors cursor-pointer"
          onClick={() => { setEdit({ nom: c.nom, role: c.role, telephone: c.telephone || "", email: c.email || "", notes: c.notes || "" }); setEditOpen(true); }}
        >
          {c.nom}
        </button>
        {c.telephone && <span className="text-xs text-muted-foreground">{c.telephone}</span>}
        {c.email && <span className="text-xs text-muted-foreground truncate max-w-[180px]">{c.email}</span>}
        <button onClick={() => onDelete(c.id)} className="text-destructive text-sm hover:opacity-70 shrink-0">×</button>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifier le contact</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Role</Label>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(CONTACT_ROLE_LABELS).map(([k, label]) => (
                  <button key={k} type="button" onClick={() => setEdit({ ...edit, role: k as ContactRole })}
                    className={`px-2.5 py-1 rounded-md text-xs transition-colors ${edit.role === k ? "bg-primary text-primary-foreground font-medium" : "bg-muted text-muted-foreground"}`}
                  >{label}</button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Nom</Label>
              <Input value={edit.nom} onChange={(e) => setEdit({ ...edit, nom: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Telephone</Label>
                <Input value={edit.telephone} onChange={(e) => setEdit({ ...edit, telephone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
                <Input value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Notes</Label>
              <Input value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} placeholder="Notes..." />
            </div>
            <Button type="submit" className="w-full">Enregistrer</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ContactSection({ contacts, onAdd, onUpdate, onDelete, propertyId }: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nom: "", role: "autre" as ContactRole, telephone: "", email: "", notes: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({ ...form, propertyId });
    setOpen(false);
    setForm({ nom: "", role: "autre", telephone: "", email: "", notes: "" });
  };

  const propertyContacts = contacts.filter(c => c.propertyId === propertyId);

  return (
    <Card className="border-dotted">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Contacts & Prestataires</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button variant="outline" size="sm" />}>+ Contact</DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Ajouter un contact</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Role</Label>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(CONTACT_ROLE_LABELS).map(([k, label]) => (
                    <button key={k} type="button" onClick={() => setForm({ ...form, role: k as ContactRole })}
                      className={`px-2.5 py-1 rounded-md text-xs transition-colors ${form.role === k ? "bg-primary text-primary-foreground font-medium" : "bg-muted text-muted-foreground"}`}
                    >{label}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Nom</Label>
                <Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} required placeholder="Nom du contact" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Telephone</Label>
                  <Input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} placeholder="06 ..." />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
                  <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@..." />
                </div>
              </div>
              <Button type="submit" className="w-full">Ajouter</Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {propertyContacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun contact enregistre.</p>
        ) : (
          <div>
            {propertyContacts.map((c) => (
              <ContactRow key={c.id} contact={c} onUpdate={onUpdate} onDelete={onDelete} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
