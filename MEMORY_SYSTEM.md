# Système de Mémoire - Compagnon

## Vue d'ensemble

Le système de mémoire de Compagnon permet à l'agent de retenir des informations importantes, d'apprendre de ses expériences, et de改善 ses futures actions sans polluer le contexte.

---

## Ce que permet la mémoire

### 1. Mémoriser des faits durables

```
Utilisateur: "N'oublie pas que Novaris utilise Typesense"
→ Agent appelle memory_remember
→ Stocké avec scope "project", confidence 0.8
```

### 2. Connaître le contexte avant d'agir

```
Utilisateur: "Implémente le search pour Novaris"
→ Agent appelle memory_search
→ Retrieves: "Novaris utilise Typesense"
→ Sait déjà quelle techno utiliser
```

### 3. Enregistrer les décisions

```
Décision: "Utiliser Typesense pour le search"
→ memory_record_decision
→ Conserve: contexte, alternatives, rationale
```

### 4. Apprendre des expériences

```
Tâche réussie avec plusieurs outils
→ memory_record_episode
→ Conserve: trigger, observations, actions, outcome
```

### 5. Créer des procédures

```
3 mêmes erreurs Nginx 504 répétées
→ memory_consolidate
→ Crée procédure "Diagnostiquer Nginx 504"
```

### 6. Détecter les conflits

```
Ancien: "Novaris utilise Typesense"
Nouveau: "Novaris utilise OpenSearch"
→ Détection automatique de conflit
→ Demande résolution à l'utilisateur
```

### 7. Vérifier et mettre à jour

```
Configuration change dans le projet
→ memory_verify
→ Confiance mise à jour
→ Status: "stale" si différent
```

---

## Tools disponibles (16)

| Tool | Rôle |
|------|------|
| `memory_search` | Rechercher dans tous les types |
| `memory_remember` | Stocker un fait |
| `memory_update` | Modifier valeur/confiance |
| `memory_forget` | Archiver une mémoire |
| `memory_get` | Récupérer par ID |
| `memory_list` | Lister par scope |
| `memory_record_episode` | Enregistrer expérience |
| `memory_record_decision` | Enregistrer décision |
| `memory_get_procedure` | Récupérer procédure |
| `memory_update_procedure` | Modifier procédure |
| `memory_verify` | Vérifier exactitude |
| `memory_retrieve_context` | Récupérer contexte avant tâche |
| `memory_extract_facts` | Extraire faits du texte |
| `memory_consolidate` | Transformer épisodes en procédures |
| `memory_find_stale` | Trouver mémoires obsolètes |
| `memory_archive_stale` | Archiver vieux souvenirs |

---

## Types de mémoire

### Semantic Memory
Faits, configurations, connaissances
```
subject: "Novaris"
predicate: "uses"
value: "Typesense"
scope: "project"
confidence: 0.9
```

### Episode
Expérience complète
```
trigger: "Fix Plane API 504"
observations: ["Nginx timeout", "API unhealthy"]
actions: ["inspect logs", "check container"]
outcome: "API restarted, now working"
success: true
```

### Procedure
Méthode réutilisable
```
name: "Diagnostiquer Nginx 504"
steps: [{order:1, action: "inspect nginx logs"}, ...]
confidence: 0.85
```

### Decision
Décision architecturale
```
title: "Choisir moteur de search"
alternatives: ["Typesense", "Elasticsearch", "OpenSearch"]
decision: "Typesense"
rationale: "Opérationnelement plus simple"
```

---

## Scopes

```
global       → Tout projet
organization → Organisation
project      → Projet spécifique
repository   → Repository spécifique
task         → Tâche spécifique
```

---

## Comment l'agent utilise la mémoire

### Avant une tâche
```
1. Lire le task
2. Appeler memory_retrieve_context
3. Obtenir faits, décisions, procédures pertinentes
4. Comprendre le contexte avant d'agir
```

### Après une tâche réussie
```
1. Évaluer si expérience mérite d'être mémorisée
2. Si oui: memory_record_episode
3. Si décision: memory_record_decision
4. Si fait nouveau: memory_remember
```

### Périodiquement
```
1. Appeler memory_consolidate
2. Transformer episodes répétés en procédures
3. Appeler memory_find_stale
4. Archiver les vieux souvenirs
```

---

## API REST

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/memory/search?q=...` | GET | Rechercher |
| `/memory/remember` | POST | Créer fait |
| `/memory/list` | GET | Lister toutes |

---

## Exemple de flux

```bash
# 1. Créer un fait
curl -X POST .../memory/remember \
  -d '{"subject":"Novaris","predicate":"uses","value":"Typesense"}'

# 2. Rechercher
curl .../memory/search?q=Novaris

# 3. Lister
curl .../memory/list
```

---

## Ce qui n'est PAS stocké

- Conversations triviales
- Sorties de debug temporaires
- Hypothèses non vérifiées
- Secrets, mots de passe, tokens
- Connaissances génériques (docs, StackOverflow)

---

## Prochaines étapes possibles

- Intégration avec vecteur search (pgvector)
- Métriques d'observabilité
- Tests automatisés
- UI pour visualiser les mémoires
