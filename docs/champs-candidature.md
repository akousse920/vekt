# Champs de candidature configurables

Le formulaire public d'une offre peut recevoir des champs supplémentaires : texte court, texte long, nombre, date de naissance, choix unique, choix multiples, oui/non, déclaration à cocher, un document PDF ou plusieurs PDF dans un même champ. Le CV reste obligatoire. Aucun champ supplémentaire n'est ajouté par défaut. Pour toute offre, le candidat confirme aussi avoir lu les critères ; cette déclaration est enregistrée avec la candidature.

Le recruteur ouvre **Configurer l’offre → Formulaire de candidature**. Il peut charger un modèle, ordonner les questions et associer plusieurs réponses ou pièces à un critère. Les modifications sont appliquées ensemble avec **Enregistrer le formulaire**. La configuration est aussi accessible via `PUT /api/job-listings/{id}/application-form`, avec une session du recruteur propriétaire de l'offre ou d'un administrateur. Une fois la première candidature reçue, la définition du formulaire est figée pour conserver le sens des réponses enregistrées.

Deux modèles peuvent être chargés avec `{ "template": "simple" }` ou `{ "template": "profil" }`. Le modèle `profil` contient téléphone, diplôme, expérience et justificatif de diplôme. Il ne demande pas la date de naissance par défaut.

Exemple de configuration explicite pour demander une date de naissance et signaler les dossiers hors d'une tranche d'âge de 25 à 40 ans :

```json
{
  "fields": [
    {
      "key": "date_naissance",
      "label": "Date de naissance",
      "type": "BIRTH_DATE",
      "required": true,
      "options": [],
      "minValue": 25,
      "maxValue": 40,
      "flagOutsideRange": true
    }
  ]
}
```

Pour `BIRTH_DATE`, `minValue` et `maxValue` représentent **l'âge recherché**, et non des années de naissance. Le système calcule l'âge exact à la date du dépôt, selon le calendrier du Bénin. Les bornes sont inclusives : pour une plage de 25 à 40 ans, 25 et 40 ans sont dans la plage.

Ces signaux sont visibles dans le dossier du recruteur. Ils ne modifient ni le statut, ni le score IA, ni la transmission de la candidature. La comparaison est effectuée côté serveur. Les anciens champs `BIRTH_YEAR` sont convertis en `BIRTH_DATE` par la migration ; les réponses historiques, qui ne contiennent que l'année, restent enregistrées telles quelles.

## Réponses attendues sur les autres champs

Le même `PUT` accepte une liste `rules` en plus de `fields`. Chaque règle décrit une ou plusieurs réponses attendues. `mode: "ALL"` demande que toutes les conditions soient satisfaites ; `mode: "ANY"` en demande au moins une. Si la règle échoue, `action: "FLAG"` ajoute seulement un signal au dossier ; `action: "REVIEW"` ajoute le signal et dirige le dossier vers la revue humaine. Aucune de ces actions ne refuse automatiquement une candidature.

Exemple :

```json
{
  "fields": [
    { "key": "diplome", "label": "Diplôme", "type": "SINGLE_SELECT", "required": true, "options": ["Licence", "Master", "Autre"] },
    { "key": "experience", "label": "Années d’expérience", "type": "NUMBER", "required": true }
  ],
  "rules": [
    {
      "key": "qualification",
      "label": "Qualification attendue",
      "mode": "ALL",
      "action": "REVIEW",
      "conditions": [
        { "fieldKey": "diplome", "operator": "IN", "value": ["Licence", "Master"] },
        { "fieldKey": "experience", "operator": "GTE", "value": 3 }
      ]
    }
  ]
}
```

Les choix uniques et les réponses `YES_NO` acceptent `EQUALS`, `NOT_EQUALS` et `IN` (avec les valeurs `"true"` et `"false"` pour oui/non). Les listes composées de valeurs numériques acceptent également `GTE` et `LTE`. Les choix multiples acceptent `CONTAINS_ANY`, `CONTAINS_ALL` et `CONTAINS_NONE`. Les nombres acceptent `EQUALS`, `GTE`, `LTE` et `BETWEEN` (intervalle inclusif, par exemple `[2, 5]`). `PRESENT` vérifie qu'un champ est renseigné, y compris `DECLARATION`, `FILE` ou `FILES`. Les règles de ce moteur ne s'appliquent pas à la date de naissance ni aux caractéristiques personnelles : elles restent des signaux informatifs distincts.

Un champ `FILES` accepte jusqu'à 5 PDF par défaut, ou de 2 à 10 avec `maxFiles`. Chaque PDF est limité à 5 Mo et l'ensemble des pièces complémentaires à 20 Mo. Exemple de champs :

```json
{
  "fields": [
    { "key": "experience_poissonnerie", "label": "Avez-vous travaillé dans la poissonnerie ?", "type": "YES_NO", "required": true },
    { "key": "pieces", "label": "Diplôme, identité et attestations", "type": "FILES", "required": true, "maxFiles": 4 },
    { "key": "declaration", "label": "Je confirme pouvoir assurer les missions décrites", "type": "DECLARATION", "required": true }
  ],
  "rules": [
    { "key": "experience_obligatoire", "label": "Expérience en poissonnerie", "mode": "ALL", "action": "REVIEW", "conditions": [{ "fieldKey": "experience_poissonnerie", "operator": "EQUALS", "value": "true" }] }
  ]
}
```

La date limite se renseigne dans le formulaire de création ou de modification de l'offre. Le jour choisi reste inclus jusqu'à 23 h 59, heure du Bénin ; les nouveaux dépôts sont ensuite refusés côté serveur et l'offre sort de la liste publique.
