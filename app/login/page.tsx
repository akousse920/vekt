"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SpinnerGapIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type LoginState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string };

export default function LoginPage() {
  const [state, setState] = useState<LoginState>({ status: "idle" });
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState({ status: "loading" });

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.status === 429) {
      setState({
        status: "error",
        message: "Trop de tentatives. Attendez quelques minutes avant de réessayer.",
      });
      return;
    }

    if (result?.error) {
      setState({ status: "error", message: "Adresse email ou mot de passe incorrect." });
      return;
    }

    router.push("/recruiter");
    router.refresh();
  }

  return (
    <div className="flex min-h-[82vh] flex-col bg-background">
      <main className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">
          <div className="mb-7 text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">Espace privé</p>
            <h1 className="mt-2 text-4xl font-bold">Bienvenue</h1>
            <p className="mt-2 text-sm text-muted-foreground">Connectez-vous pour gérer vos offres et vos candidatures.</p>
          </div>
          <Card className="border-[#d8e0e8] bg-white p-2 shadow-lg shadow-slate-900/5">
            <CardHeader>
              <CardTitle>Connexion</CardTitle>
              <CardDescription>
                Saisissez vos identifiants pour accéder à votre espace.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Adresse email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="vous@exemple.com"
                    className="h-12 bg-white"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="password">Mot de passe</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    placeholder="Votre mot de passe"
                    className="h-12 bg-white"
                  />
                </div>

                {state.status === "error" && (
                  <Alert variant="destructive">
                    <WarningCircleIcon />
                    <AlertTitle>Connexion impossible</AlertTitle>
                    <AlertDescription>{state.message}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  disabled={state.status === "loading"}
                  className="brand-cta h-12 w-full rounded-xl font-semibold"
                >
                  {state.status === "loading" && (
                    <SpinnerGapIcon
                      data-icon="inline-start"
                      className="animate-spin"
                    />
                  )}
                  {state.status === "loading" ? "Connexion…" : "Se connecter"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
