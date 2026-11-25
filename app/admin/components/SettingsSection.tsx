"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CircleNotchIcon } from "@phosphor-icons/react";
import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = {
  settings: Record<string, string>;
  setSettings: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  flash: (msg: string, kind: "ok" | "err") => void;
};

export default function SettingsSection({ settings, setSettings, flash }: Props) {
  const router = useRouter();
  const [companyName, setCompanyName] = useState(settings.COMPANY_NAME ?? "GRACE DIVINE");
  const [retentionDays, setRetentionDays] = useState(String(settings.RETENTION_DAYS ?? "90"));
  const [autoReject, setAutoReject] = useState(
    settings.AUTO_REJECT_BELOW_THRESHOLD === "true",
  );
  const [isSavingSettings, startSavingSettings] = useTransition();

  function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    startSavingSettings(async () => {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          COMPANY_NAME: companyName.trim(),
          RETENTION_DAYS: Number(retentionDays),
          AUTO_REJECT_BELOW_THRESHOLD: autoReject,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        flash(data.error ?? "Impossible d’enregistrer les réglages.", "err");
        return;
      }
      const data = await res.json();
      setSettings((prev) => ({
        ...prev,
        COMPANY_NAME: String(data.COMPANY_NAME),
        RETENTION_DAYS: String(data.RETENTION_DAYS),
        AUTO_REJECT_BELOW_THRESHOLD: String(data.AUTO_REJECT_BELOW_THRESHOLD ?? autoReject),
      }));
      flash("Réglages enregistrés", "ok");
      router.refresh();
    });
  }

  return (
    <Card className="border-[#d8e0e8] bg-white shadow-sm">
      <CardHeader className="pb-3">
        <CardDescription className="text-xs">
          Personnalisez l’identité affichée sur le site et les courriels, ainsi que les règles de conservation et de traitement.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSaveSettings} className="flex flex-col gap-4">
          <div className="flex max-w-md flex-col gap-1.5">
            <Label htmlFor="company-name" className="text-sm">Nom de l’organisation</Label>
            <Input id="company-name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} minLength={2} maxLength={80} required className="h-11 bg-white" />
            <p className="text-xs text-muted-foreground">Visible dans l’en-tête, le pied de page, la page d’accueil et les courriels.</p>
          </div>
          <div className="flex items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="retention-days" className="text-xs">Durée de conservation (jours)</Label>
              <Input id="retention-days" type="number" min={1} max={3650} required value={retentionDays} onChange={(e) => setRetentionDays(e.target.value)} className="h-11 w-32 bg-white" />
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3">
            <div className="flex items-start gap-2.5">
              <input
                id="auto-reject"
                type="checkbox"
                checked={autoReject}
                onChange={(e) => setAutoReject(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary"
              />
              <Label htmlFor="auto-reject" className="text-xs font-medium cursor-pointer">
                Refuser automatiquement les candidatures sous le seuil
              </Label>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Désactivé par défaut. Tant que ce réglage est désactivé, les dossiers sous le seuil
              passent en revue humaine et aucun e-mail de refus n’est envoyé avant une décision.
              Son activation permet un refus par traitement automatique seul.
            </p>
          </div>

          <Button type="submit" className="brand-cta h-11 self-start rounded-xl px-5 font-semibold" disabled={isSavingSettings}>
            {isSavingSettings && <CircleNotchIcon className="size-4 animate-spin mr-1" />}
            Enregistrer
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
