"use client";

import AddUserForm from "@/app/admin/components/AddUserForm";
import EmailTemplatesSection from "@/app/admin/components/EmailTemplatesSection";
import SettingsSection from "@/app/admin/components/SettingsSection";
import StatCard from "@/app/admin/components/StatCard";
import UsersSection from "@/app/admin/components/UsersSection";
import type { TemplateEntry, User } from "@/app/admin/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { BriefcaseIcon, ChartBarIcon, ClipboardTextIcon, EnvelopeIcon, GearIcon, UserCircleIcon, UsersIcon } from "@phosphor-icons/react";
import { useState } from "react";

type Props = {
  currentUserId: string;
  initialUsers: User[];
  initialSettings: Record<string, string>;
  initialTemplates: Record<string, TemplateEntry>;
  stats: { jobCount: number; candidateCount: number; evaluationCount: number };
};

export default function AdminPanel({ currentUserId, initialUsers, initialSettings, initialTemplates, stats, }: Props) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [settings, setSettings] = useState(initialSettings);
  const [templates, setTemplates] = useState<Record<string, TemplateEntry>>(initialTemplates);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function flash(msg: string, kind: "ok" | "err") {
    setSuccess(null);
    setError(null);
    if (kind === "ok") setSuccess(msg);
    else setError(msg);
    setTimeout(() => (kind === "ok" ? setSuccess(null) : setError(null)), 4000);
  }

  return (
    <div className="min-h-[89vh] bg-background">
      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-8 sm:px-8 sm:py-12">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            <GearIcon weight="duotone" className="size-7 text-primary" />
            Administration
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Gérez les comptes recruteurs, la conservation des données et les réglages de la plateforme.</p>
        </div>

        {success && (
          <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900">
            <AlertDescription className="text-green-700 dark:text-green-400">{success}</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard icon={<BriefcaseIcon weight="duotone" className="size-6 text-primary" />} label="Offres" value={stats.jobCount} />
          <StatCard icon={<UsersIcon weight="duotone" className="size-6 text-primary" />} label="Candidatures" value={stats.candidateCount} />
          <StatCard icon={<ChartBarIcon weight="duotone" className="size-6 text-primary" />} label="Évaluations" value={stats.evaluationCount} />
        </div>

        <Separator />

        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <UserCircleIcon weight="duotone" className="size-5 text-primary" />
            <h2 className="text-xl font-semibold">Comptes utilisateurs</h2>
          </div>

          <UsersSection users={users} setUsers={setUsers} currentUserId={currentUserId} flash={flash} />

          <AddUserForm onUserAdded={(user) => setUsers((prev) => [...prev, user])} flash={flash} />
        </section>

        <Separator />

        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <ClipboardTextIcon weight="duotone" className="size-5 text-primary" />
            <h2 className="text-xl font-semibold">Conservation des données</h2>
          </div>

          <SettingsSection settings={settings} setSettings={setSettings} flash={flash} />
        </section>

        <Separator />

        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <EnvelopeIcon weight="duotone" className="size-5 text-primary" />
            <h2 className="text-xl font-semibold">Modèles d’e-mails</h2>
          </div>

          <EmailTemplatesSection templates={templates} setTemplates={setTemplates} settings={settings} setSettings={setSettings} flash={flash} />
        </section>
      </main>
    </div>
  );
}
