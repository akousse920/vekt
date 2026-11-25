"use client";

import type { User } from "@/app/admin/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CircleNotchIcon, PlusCircleIcon } from "@phosphor-icons/react";
import React, { useState, useTransition } from "react";

type Props = {
  onUserAdded: (user: User) => void;
  flash: (msg: string, kind: "ok" | "err") => void;
};

export default function AddUserForm({ onUserAdded, flash }: Props) {
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"RECRUITER" | "ADMIN">("RECRUITER");
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, startAdding] = useTransition();

  function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    startAdding(async () => {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail, password: newPassword, role: newRole }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAddError(data.error ?? "Impossible de créer ce compte.");
        return;
      }
      const user = await res.json();
      onUserAdded(user);
      setNewEmail("");
      setNewPassword("");
      setNewRole("RECRUITER");
      flash(`Compte créé : ${user.email}`, "ok");
    });
  }

  return (
    <Card className="border-[#d8e0e8] bg-white shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <PlusCircleIcon weight="duotone" className="size-5 text-primary" />
          Ajouter un utilisateur
        </CardTitle>
        <CardDescription className="text-sm">Créez un compte recruteur ou administrateur.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleAddUser} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5 sm:col-span-1">
              <Label htmlFor="new-email" className="text-xs">Email</Label>
              <Input id="new-email" type="email" required placeholder="recruteur@exemple.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="h-11 bg-white" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-password" className="text-xs">Mot de passe (8 caractères minimum)</Label>
              <Input id="new-password" type="password" required minLength={8} placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="h-11 bg-white" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-role" className="text-xs">Rôle</Label>
              <select id="new-role" value={newRole} onChange={(e) => setNewRole(e.target.value as "RECRUITER" | "ADMIN")} className="h-11 rounded-xl border border-input bg-white px-3 text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="RECRUITER">Recruteur</option>
                <option value="ADMIN">Administrateur</option>
              </select>
            </div>
          </div>
          {addError && <p className="text-xs text-destructive">{addError}</p>}
          <div className="flex justify-end">
            <Button type="submit" disabled={isAdding} className="brand-cta h-11 rounded-xl px-5 font-semibold">
              {isAdding && <CircleNotchIcon className="size-4 animate-spin mr-1" />}
              Ajouter le compte
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
