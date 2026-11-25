"use client";

import type { TemplateEntry } from "@/app/admin/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CircleNotchIcon, EyeIcon } from "@phosphor-icons/react";
import React, { useState, useTransition } from "react";

type Props = {
  templates: Record<string, TemplateEntry>;
  setTemplates: React.Dispatch<React.SetStateAction<Record<string, TemplateEntry>>>;
  settings: Record<string, string>;
  setSettings: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  flash: (msg: string, kind: "ok" | "err") => void;
};

const EMAIL_TYPES = [
  { key: "APPLIED", label: "Candidature reçue", description: "Envoyé après le dépôt d’une candidature." },
  { key: "SHORTLISTED", label: "Candidature transmise", description: "Envoyé lorsqu’un dossier est transmis au recruteur." },
  { key: "REJECTED", label: "Candidature refusée", description: "Envoyé après une décision de refus." },
  { key: "ACCEPTED", label: "Candidature acceptée", description: "Envoyé après une décision d’acceptation." },
  { key: "DATA_RETENTION_WARNING", label: "Fin de conservation des données", description: "Envoyé avant la suppression prévue des données du candidat." },
] as const;

const TEMPLATE_VARS = "{{candidateName}}, {{jobTitle}}, {{companyName}}, {{statusPageUrl}}, {{retentionDate}}";

const SAMPLE_VARS: Record<string, string> = {
  candidateName: "Jane Smith",
  jobTitle: "Senior Frontend Engineer",
  companyName: "Acme Corp",
  statusPageUrl: "https://example.com/status/preview",
  retentionDate: "1 January 2027",
};

function interpolatePreview(template: string): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => SAMPLE_VARS[key] ?? `{{${key}}}`);
}

export default function EmailTemplatesSection({ templates, setTemplates, settings, setSettings, flash }: Props) {
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [isSavingTemplate, startSavingTemplate] = useTransition();
  const [showPreview, setShowPreview] = useState(false);

  const [emailDelayHours, setEmailDelayHours] = useState(String(settings.STATUS_EMAIL_DELAY_HOURS ?? "48"));
  const [isSavingEmailDelay, startSavingEmailDelay] = useTransition();

  function openTemplate(key: string) {
    setActiveTemplate(key);
    setEditSubject(templates[key]?.subject ?? "");
    setEditBody(templates[key]?.body ?? "");
  }

  function handleSaveTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTemplate) return;
    startSavingTemplate(async () => {
      const res = await fetch(`/api/admin/email-templates/${activeTemplate}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: editSubject, body: editBody }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        flash(data.error ?? "Failed to save template", "err");
        return;
      }
      setTemplates((prev) => ({ ...prev, [activeTemplate]: { subject: editSubject, body: editBody } }));
      flash("Template saved", "ok");
    });
  }

  function handleSaveEmailDelay(e: React.FormEvent) {
    e.preventDefault();
    startSavingEmailDelay(async () => {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          RETENTION_DAYS: Number(settings.RETENTION_DAYS ?? 90),
          STATUS_EMAIL_DELAY_HOURS: Number(emailDelayHours),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        flash(data.error ?? "Failed to save settings", "err");
        return;
      }
      const data = await res.json();
      setSettings((prev) => ({ ...prev, STATUS_EMAIL_DELAY_HOURS: String(data.STATUS_EMAIL_DELAY_HOURS) }));
      flash("Email delay saved", "ok");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="-mt-2 text-sm text-muted-foreground">
        Personnalisez les e-mails envoyés aux candidats. Variables disponibles : <code className="rounded bg-muted px-1 py-0.5 text-sm">{TEMPLATE_VARS}</code>
      </p>

      <Card className="border-[#d8e0e8] bg-white shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold">Délai d’envoi</CardTitle>
          <CardDescription className="text-sm">
            Les e-mails de changement de statut sont différés du nombre d’heures indiqué. Choisissez <strong>0</strong> pour un envoi immédiat.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveEmailDelay} className="flex items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email-delay-hours" className="text-xs">Délai (heures)</Label>
              <Input id="email-delay-hours" type="number" min={0} max={168} required value={emailDelayHours} onChange={(e) => setEmailDelayHours(e.target.value)} className="h-11 w-32 bg-white" />
            </div>
            <Button type="submit" disabled={isSavingEmailDelay} className="brand-cta h-11 rounded-xl px-5 font-semibold">
              {isSavingEmailDelay && <CircleNotchIcon className="size-4 animate-spin mr-1" />}
              Enregistrer
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-2">
        {EMAIL_TYPES.map(({ key, label, description }) => (
          <Card key={key} className={`cursor-pointer bg-white transition-colors ${activeTemplate === key ? "border-[#e6ba7c]" : "border-[#d8e0e8] hover:border-[#e6ba7c]"}`} onClick={() => openTemplate(key)}>
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold">{label}</CardTitle>
                  <CardDescription className="mt-0.5 text-sm">{description}</CardDescription>
                </div>
                {templates[key]?.subject ? (
                  <Badge variant="secondary" className="ml-4 shrink-0 text-xs">Configuré</Badge>
                ) : (
                  <Badge variant="outline" className="ml-4 shrink-0 text-xs text-muted-foreground">À configurer</Badge>
                )}
              </div>
            </CardHeader>

            {activeTemplate === key && (
              <CardContent className="px-4 pb-4 border-t pt-4" onClick={(e) => e.stopPropagation()}>
                <form onSubmit={handleSaveTemplate} className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`subject-${key}`} className="text-xs">Objet</Label>
                    <Input id={`subject-${key}`} required value={editSubject} onChange={(e) => setEditSubject(e.target.value)} placeholder="Ex. Votre candidature pour {{jobTitle}}" className="h-11 bg-white" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`body-${key}`} className="text-xs">Contenu (HTML)</Label>
                    <Textarea id={`body-${key}`} required value={editBody} onChange={(e) => setEditBody(e.target.value)} placeholder="<p>Bonjour {{candidateName}}, ...</p>" className="min-h-40 resize-y bg-white font-mono text-sm" />
                  </div>
                  <div className="flex justify-between gap-2">
                    <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={() => setShowPreview(true)} disabled={!editBody}>
                      <EyeIcon className="size-4 mr-1" />
                      Aperçu
                    </Button>
                    <div className="flex gap-2">
                      <Button type="button" variant="ghost" className="h-11" onClick={() => setActiveTemplate(null)}>Annuler</Button>
                      <Button type="submit" disabled={isSavingTemplate} className="brand-cta h-11 rounded-xl px-5 font-semibold">
                        {isSavingTemplate && <CircleNotchIcon className="size-4 animate-spin mr-1" />}
                        Enregistrer le modèle
                      </Button>
                    </div>
                  </div>
                </form>

                <Dialog open={showPreview} onOpenChange={setShowPreview}>
                  <DialogContent className="w-full bg-white sm:max-w-2xl">
                    <DialogHeader>
                      <DialogTitle className="text-lg font-semibold">Aperçu - {interpolatePreview(editSubject || "(sans objet)")}</DialogTitle>
                    </DialogHeader>
                    <div className="rounded-md border overflow-hidden bg-white">
                      <iframe srcDoc={interpolatePreview(editBody)} title="Email preview" className="w-full min-h-[480px] border-0" sandbox="allow-same-origin" />
                    </div>
                    <p className="text-xs text-muted-foreground">Données d’exemple : {Object.entries(SAMPLE_VARS).map(([k, v]) => `{{${k}}} = "${v}"`).join(" · ")}</p>
                  </DialogContent>
                </Dialog>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
