# Spike de décision — plateforme de recrutement

## État du dépôt

Vekt est déjà présent dans ce dossier. Le modèle possède `NEEDS_REVIEW`, la provenance des évaluations et une option d'auto-rejet désactivée par défaut. Le parcours candidat accepte un PDF de 5 Mo et les réponses aux questions.

## Constat et corrections

- Le pipeline direct rejetait tout score sous le seuil et envoyait un email de refus. Il utilise désormais la même décision et la même politique d'email que le pipeline Inngest, avec la provenance enregistrée.
- Quand l'extraction du CV ne fournit aucun texte, les deux chemins envoient le dossier en revue humaine sans email de décision automatique.
- Les pages `/recruiter/all` et `/recruiter/jobs/[jobId]`, `GET /api/candidates`, la file recruteur, les PDF et la route de décision appliquent la même règle de visibilité côté serveur. Un recruteur voit ses candidats `SHORTLISTED` et `ACCEPTED`. L'administrateur conserve l'accès à toutes les files.
- Le nom du candidat reste fourni localement à `evaluateCandidate` pour être supprimé du texte du CV avant l'appel IA. Il n'est pas inséré comme champ dans le prompt.

## Vérification réalisée

- Dépendances installées avec Node 22 et pnpm 11.18.0.
- 24 tests passent avec `npm test`, dont un test sur SQLite des trois issues des deux pipelines, du CV sans texte, d'une règle obligatoire non satisfaite, du score pondéré et de l'échec du fournisseur IA. Le gestionnaire Inngest est appelé avec des étapes simulées. La suppression des champs d'âge et de nationalité en français est aussi testée.
- `tsc --noEmit`, ESLint sur les fichiers modifiés et `git diff --check` passent.
- `next build` passe avec la base SQLite de test ; les nouvelles pages et routes sont incluses dans la compilation de production.
- Sur un serveur Next.js local et une base SQLite isolée, les requêtes HTTP avec comptes fictifs confirment : accès refusé sans session ; le recruteur propriétaire voit `SHORTLISTED` et `ACCEPTED` dans `/api/candidates`, `/api/recruiter/queue`, `/recruiter/all` et `/recruiter/jobs/[jobId]` ; le PDF d'un `NEEDS_REVIEW` et celui d'une autre offre répondent 404 ; la route de décision répond 404 pour ces deux candidats. L'administrateur voit les dossiers en revue et leurs PDF.
- Ces contrôles HTTP sont reproductibles avec `npm run test:access`. Le même test confirme qu'après une décision `SHORTLIST` de l'administrateur, le profil et son PDF deviennent visibles au recruteur propriétaire de l'offre.
- Un test automatisé avec le vrai serveur Inngest local (`npm run test:inngest`) confirme l'envoi d'un événement après soumission PDF, le rappel de la fonction, l'enregistrement d'une évaluation et le statut final `NEEDS_REVIEW` avec le fournisseur fictif. Il valide le chemin de traitement immédiat ; la reprise après interruption et l'email différé restent à éprouver séparément.
- Trois PDF fictifs ont été soumis au parcours public complet avec Ollama `qwen2.5:3b` et une offre de référence. Le résultat détaillé est dans [qualification-synthetique-qwen2.5-3b.json](qualification-synthetique-qwen2.5-3b.json). Le profil pertinent a reçu `NEEDS_REVIEW` avec 34/100, alors que le texte extrait contenait bien les compétences attendues : un faux négatif sur un profil pertinent. Le profil moyen est resté en revue avec 0/100 ; le profil hors sujet est aussi resté en revue après erreur du fournisseur. Aucun faux positif n'a été observé sur ce très petit jeu fictif. Ces trois cas ne mesurent pas un taux d'erreur fiable.
- Le modèle local `qwen3.5:9b` n'a pas terminé une évaluation dans le délai pratique de l'essai. Un délai maximal de 120 secondes est maintenant appliqué aux appels IA et une erreur place le dossier en revue humaine.
- Le mode `AI_PROVIDER=none` est le mode par défaut. Il applique les règles structurées, garde leurs motifs et transmet directement au recruteur les candidatures sans critère bloquant ou réponse ambiguë, sans appel IA, sans score fictif et sans décision défavorable automatique. Les autres dossiers attendent une revue humaine.
- Les questions sont configurables par offre : choix unique, choix multiple et saisie libre (2 000 caractères au maximum). Les réponses libres sont liées à l'offre et visibles dans la revue du dossier ; elles ne déclenchent aucune règle automatique. L'édition des questions est verrouillée après la première candidature pour conserver l'historique des réponses.
- La suite HTTP vérifie la création d'une question libre par le propriétaire de l'offre, le refus de modification par un autre recruteur et le refus d'une règle automatique sur ce type de question. Le parcours Inngest soumet une réponse libre réelle et ignore une réponse visant une autre offre. La suite d'accès confirme que seul l'administrateur voit la réponse avant transmission, puis que le recruteur propriétaire y accède après décision.

## Vérification encore nécessaire

- La reprise d'une fonction après interruption et l'envoi d'email différé avec un vrai serveur Inngest restent à vérifier.
- `prisma migrate deploy` renvoie parfois `Schema engine error` sans détail dans cet environnement quand `RUST_LOG` n'est pas défini. Avec `RUST_LOG=info`, les 16 migrations ont été appliquées avec succès à une base SQLite neuve. Ce comportement doit être vérifié dans l'environnement cible ; les tests isolés utilisent les fichiers SQL des migrations.
- Le contrôle HTTP est automatisé localement, mais il n'est pas encore exécuté en CI.
- La qualité de la présélection exige une grille de profils beaucoup plus large et une calibration avant toute utilisation réelle. Le modèle local testé n'a pas franchi ce seuil.

## Estimation des critères par offre

Pour un prototype avec règles sur les options de réponses existantes : 3 à 5 jours de développement, migration, interface de configuration et tests compris. Les comparaisons numériques (`GTE`, `LTE`) demandent un format de réponse normalisé ; les questions actuelles ne proposent que des options simples ou multiples. Une grille IA configurable et l'analyse des faux négatifs ajoutent du travail distinct.

## Décision

**GO pour poursuivre le prototype ; NO GO pour une présélection automatique en production.** Le contrôle de visibilité et le traitement immédiat Inngest sont vérifiés localement. Les règles ainsi que la grille de score sont décrites dans [criteres-presellection.md](criteres-presellection.md). Le modèle Ollama testé a manqué le profil pertinent. Il faut corriger et mesurer la qualité sur un jeu de référence représentatif, vérifier la reprise et l'email différé d'Inngest, puis confirmer la migration dans l'environnement cible avant tout traitement réel.
