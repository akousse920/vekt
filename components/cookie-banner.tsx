"use client";

import { Button } from "@/components/ui/button";
import { CookieIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";

const CONSENT_KEY = "cookie-consent";

export default function CookieBanner() {
  const [visible, setVisible] = useState(
    () => typeof window !== "undefined" && !localStorage.getItem(CONSENT_KEY),
  );

  function dismiss() {
    localStorage.setItem(CONSENT_KEY, "acknowledged");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Information sur les cookies"
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur-sm shadow-lg"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Info */}
        <div className="flex items-start gap-3 min-w-0">
          <CookieIcon weight="duotone" className="size-5 text-primary mt-0.5 shrink-0" />
          <div className="flex flex-col gap-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              Ce site utilise uniquement les cookies nécessaires
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Un cookie de session permet la connexion. Aucun cookie publicitaire
              ou de suivi n’est utilisé. Consultez notre{" "}
              <Link
                href="/privacy"
                className="underline underline-offset-3 hover:text-foreground transition-colors"
              >
                politique de confidentialité
              </Link>{" "}
              pour en savoir plus.
            </p>
          </div>
        </div>

        {/* Action */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <Button size="sm" onClick={dismiss}>
            J’ai compris
          </Button>
        </div>
      </div>
    </div>
  );
}
