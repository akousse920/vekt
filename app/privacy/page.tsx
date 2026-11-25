import { getCompanyName, PRIVACY_POLICY_VERSION } from "@/lib/brand";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `Politique de confidentialité - ${await getCompanyName()}` };
}

const PRIVACY_EMAIL = process.env.PRIVACY_CONTACT_EMAIL || "privacy@example.com";

export default async function PrivacyPolicyPage() {
  const companyName = await getCompanyName();
  const aiEnabled = (process.env.AI_PROVIDER ?? "none").toLowerCase() !== "none";
  return (
    <div className="flex min-h-[89vh] flex-col bg-background">
      <main className="flex-1">
        <div className="mx-auto max-w-2xl px-6 py-12">
          <h1 className="text-2xl font-bold mb-1">Politique de confidentialité</h1>
          <p className="text-sm text-muted-foreground mb-8">
            Dernière mise à jour : {PRIVACY_POLICY_VERSION} &nbsp;·&nbsp; Version{" "}
            {PRIVACY_POLICY_VERSION}
          </p>

          <section className="prose prose-sm dark:prose-invert max-w-none text-foreground space-y-8">

            <div>
              <h2 className="text-base font-semibold mb-2">1. Responsable du traitement</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {companyName} est responsable du traitement des données personnelles que vous
                transmettez via cette plateforme de recrutement. Pour toute question sur l’utilisation
                de vos données, contactez-nous à{" "}
                <a href={`mailto:${PRIVACY_EMAIL}`} className="text-primary underline underline-offset-3">
                  {PRIVACY_EMAIL}
                </a>
                .
              </p>
            </div>

            <div>
              <h2 className="text-base font-semibold mb-2">2. Données collectées</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-2">
                Lorsque vous postulez à une offre, nous collectons les données suivantes :
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>Nom et prénom</li>
                <li>Adresse e-mail</li>
                <li>CV (fichier PDF)</li>
                <li>L’offre à laquelle vous postulez</li>
                <li>Vos réponses aux questions de l’offre, le cas échéant</li>
                <li>La date et l’heure de votre candidature</li>
                <li>La preuve de votre consentement (date et version de cette politique)</li>
              </ul>
            </div>

            <div>
              <h2 className="text-base font-semibold mb-2">3. Finalités et bases légales</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                Vos données sont utilisées pour les finalités suivantes :
              </p>
              <div className="space-y-3">
                <div className="rounded-md border p-3">
                  <p className="text-sm font-medium">Étude de votre candidature</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Votre candidature et votre CV sont examinés pour évaluer votre adéquation avec le
                    poste. <strong>Base légale :</strong> votre consentement (art. 6(1)(a) RGPD) et
                    les mesures précontractuelles prises à votre demande (art. 6(1)(b) RGPD).
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-sm font-medium">Suivi interne</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Conservation de l’historique des candidatures et des décisions de recrutement.{" "}
                    <strong>Base légale :</strong> intérêt légitime (art. 6(1)(f) RGPD).
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-sm font-medium">Connexion des recruteurs</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Un cookie de session est déposé lorsqu’un recruteur se connecte, afin de maintenir
                    sa connexion. Ce cookie est strictement nécessaire au fonctionnement de la
                    plateforme et n’est pas soumis au consentement (art. 5(3) de la directive
                    ePrivacy). <strong>Base légale :</strong> intérêt légitime / exécution du contrat
                    (art. 6(1)(b) RGPD).
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-base font-semibold mb-2">4. Examen des candidatures</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Certaines offres comportent des questions (disponibilités, date de démarrage…). Vos
                réponses sont comparées aux critères de l’offre pour orienter votre dossier : lorsqu’elles
                y correspondent, votre candidature est transmise directement au recruteur ; sinon, un
                membre de l’équipe l’examine.{" "}
                {aiEnabled
                  ? "Un outil d’intelligence artificielle aide également à comparer votre CV aux critères de l’offre, après retrait des informations permettant de vous identifier."
                  : "Votre CV n’est pas analysé par une intelligence artificielle."}{" "}
                Aucune candidature n’est écartée sans qu’une personne puisse la réexaminer, et vous
                pouvez à tout moment demander comment la vôtre a été examinée.
              </p>
            </div>

            <div>
              <h2 className="text-base font-semibold mb-2">5. Cookies</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                Cette plateforme utilise <strong>uniquement des cookies strictement nécessaires</strong>.
                Aucun cookie de suivi, de mesure d’audience ou publicitaire n’est utilisé.
              </p>
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Cookie</th>
                      <th className="text-left px-3 py-2 font-medium">Rôle</th>
                      <th className="text-left px-3 py-2 font-medium">Durée</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr className="border-t">
                      <td className="px-3 py-2 font-mono">next-auth.session-token</td>
                      <td className="px-3 py-2">Maintient la connexion des recruteurs</td>
                      <td className="px-3 py-2">Session</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Ces cookies étant strictement nécessaires au fonctionnement du service, ils ne
                requièrent pas votre consentement au titre de la directive ePrivacy. Un bandeau vous
                en informe lors de votre première visite.
              </p>
            </div>

            <div>
              <h2 className="text-base font-semibold mb-2">6. Durée de conservation</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Les données de candidature sont conservées pendant une durée limitée à compter de leur
                envoi, puis définitivement supprimées. Cette durée est fixée par l’administrateur de la
                plateforme (90 jours par défaut). Vous êtes prévenu(e) par e-mail avant la suppression.
                Si vous êtes recruté(e), les données liées à votre emploi relèvent d’une politique de
                conservation distincte.
              </p>
            </div>

            <div>
              <h2 className="text-base font-semibold mb-2">7. Destinataires des données</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Vos données sont accessibles uniquement aux recruteurs et responsables du recrutement
                habilités de {companyName}. Elles ne sont ni partagées, ni vendues, ni transférées à des
                tiers. Toutes les données, y compris les e-mails, sont hébergées sur des serveurs que nous
                administrons directement.
              </p>
            </div>

            <div>
              <h2 className="text-base font-semibold mb-2">8. Vos droits</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-2">
                Conformément au RGPD, vous disposez des droits suivants :
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li><strong>Accès</strong> - obtenir une copie des données que nous détenons sur vous</li>
                <li><strong>Rectification</strong> - faire corriger des données inexactes</li>
                <li><strong>Effacement</strong> - demander la suppression de vos données (« droit à l’oubli »)</li>
                <li><strong>Limitation</strong> - demander à restreindre l’utilisation de vos données</li>
                <li><strong>Portabilité</strong> - recevoir vos données dans un format lisible par machine</li>
                <li><strong>Opposition</strong> - vous opposer à un traitement fondé sur l’intérêt légitime</li>
                <li><strong>Retrait du consentement</strong> - retirer votre consentement à tout moment, sans remettre en cause les traitements déjà effectués</li>
                <li><strong>Explication</strong> - savoir comment votre candidature a été examinée et obtenir l’avis d’une personne</li>
              </ul>
              <p className="text-sm text-muted-foreground leading-relaxed mt-3">
                Pour exercer ces droits, écrivez-nous à{" "}
                <a href={`mailto:${PRIVACY_EMAIL}`} className="text-primary underline underline-offset-3">
                  {PRIVACY_EMAIL}
                </a>
                . Nous vous répondrons sous 30 jours.
              </p>
            </div>

            <div>
              <h2 className="text-base font-semibold mb-2">9. Sécurité</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Toutes les données transitent de manière chiffrée (HTTPS). L’accès aux candidatures est
                réservé aux recruteurs connectés. Les CV sont stockés sur le serveur hors de l’espace
                public et ne peuvent être consultés que par un recruteur authentifié.
              </p>
            </div>

            <div>
              <h2 className="text-base font-semibold mb-2">10. Réclamation</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Si vous estimez que vos droits ne sont pas respectés, vous pouvez introduire une
                réclamation auprès de l’autorité de protection des données compétente (par exemple la
                CNIL en France).
              </p>
            </div>

          </section>
        </div>
      </main>
    </div>
  );
}
