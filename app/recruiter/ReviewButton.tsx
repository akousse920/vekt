"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import logger from "@/lib/logger";
import { CheckCircleIcon, SpinnerGapIcon, XCircleIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

type CandidateStatus = "APPLIED" | "ANALYZING" | "SHORTLISTED" | "NEEDS_REVIEW" | "ACCEPTED" | "REJECTED";

const STATUS_META: Record<CandidateStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  APPLIED: { label: "Reçue", variant: "outline" },
  ANALYZING: { label: "En cours", variant: "secondary" },
  SHORTLISTED: { label: "Présélectionnée", variant: "default" },
  NEEDS_REVIEW: { label: "À vérifier", variant: "secondary" },
  ACCEPTED: { label: "Acceptée", variant: "default" },
  REJECTED: { label: "Refusée", variant: "destructive" },
};

export default function ReviewButton({
  candidateId,
  currentStatus,
}: {
  candidateId: string;
  currentStatus: CandidateStatus;
}) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const processing = currentStatus === "APPLIED" || currentStatus === "ANALYZING";

  async function decide(decision: "ACCEPT" | "SHORTLIST" | "REJECT") {
    try {
      setLoading(true);
      const response = await fetch(`/api/recruiter/review/${candidateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (!response.ok) throw new Error(`Review request failed: ${response.status}`);
      setOpen(false);
      router.refresh();
      toast.success(decision === "ACCEPT" ? "Candidature acceptée." : decision === "REJECT" ? "Candidature refusée." : "Candidature présélectionnée.");
    } catch(err)  {
      logger.error({ candidateId, decision, err }, "Failed to update candidate status");
      toast.error("Décision impossible à enregistrer. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={loading || processing}>
          {loading ? (
            <SpinnerGapIcon data-icon="inline-start" className="animate-spin" />
          ) : null}
          {processing ? "Traitement en cours" : "Décider"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Décision sur la candidature</DialogTitle>
          <DialogDescription>
            Consultez le CV et les réponses avant de choisir une décision.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg flex justify-between items-center border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground mb-1">Statut actuel</p>
          <Badge variant={STATUS_META[currentStatus].variant} className="text-xs">
            {STATUS_META[currentStatus].label}
          </Badge>
        </div>

        <DialogFooter className="gap-2 sm:justify-end">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          {currentStatus !== "REJECTED" && (
            <Button
              onClick={() => decide("REJECT")}
              className="bg-destructive/10 text-destructive hover:bg-destructive/20"
            >
              <XCircleIcon data-icon="inline-start" />
              Refuser
            </Button>
          )}
          {currentStatus !== "SHORTLISTED" && (
            <Button
              onClick={() => decide("SHORTLIST")}
              className="bg-blue-500/10 text-blue-700 hover:bg-blue-500/20"
            >
              Présélectionner
            </Button>
          )}
          {currentStatus !== "ACCEPTED" && (
            <Button onClick={() => decide("ACCEPT")}>
              <CheckCircleIcon data-icon="inline-start" />
              Accepter
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
