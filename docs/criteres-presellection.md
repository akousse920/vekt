# Critères de présélection par offre

L'administrateur ou le recruteur propriétaire configure au plus une règle par question depuis la page d'une offre, avant la première candidature. Les règles sont ensuite figées pour préserver les décisions prises avec cette grille.

Les questions existantes sont à choix simple ou multiple. Les règles `EQUALS`, `NOT_EQUALS` et `IN` comparent le texte exact des options. `GTE` et `LTE` demandent une question à choix simple dont toutes les options sont numériques. `IN` accepte plusieurs options.

L'API `GET/PUT /api/job-listings/[id]/rules` permet aussi la configuration. Exemple de corps `PUT` :

```json
{
  "rules": [
    { "questionId": "<id de question>", "operator": "GTE", "value": "5", "mandatory": true }
  ]
}
```

Une réponse absente, ambiguë ou non interprétable impose une revue humaine lorsqu'une règle est configurée. Une règle obligatoire non satisfaite impose aussi cette revue, quel que soit le score IA ou le réglage d'auto-rejet. Une règle facultative non satisfaite enregistre un motif sans bloquer la transmission. En mode sans IA, les dossiers sans critère bloquant sont transmis directement au recruteur ; l'absence de texte extrait du CV ne les retient pas. Avec IA, un CV sans texte extrait impose une revue humaine. Les motifs et le score éventuel sont conservés dans `DecisionReason` et visibles par l'administrateur sur la page de l'offre.

L'administrateur peut aussi définir une grille de compétences sur la page de l'offre. L'API `GET/PUT /api/job-listings/[id]/rubric` accepte au plus dix critères `{ label, weight, required }`, dont les poids totalisent 100 %. Les critères sont figés après la première candidature. Le modèle renvoie une note et une justification par compétence ; l'application calcule le score pondéré. Une compétence obligatoire évaluée sous 50/100 impose une revue humaine. La grille et le détail des notes sont conservés avec l'évaluation et affichés sur la page de l'offre. Sans grille, le score historique de Vekt reste utilisé.

Le traitement des scores proches du seuil reste à réaliser. Le gestionnaire du chemin Inngest est testé avec des étapes simulées, mais sa durabilité réelle avec un serveur Inngest n'a pas été vérifiée. Aucune candidature réelle ne doit être traitée avant la qualification complète du filtre.
