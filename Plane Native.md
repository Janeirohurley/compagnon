# Plane Native Tooling Layer — Instructions d'implémentation

## 1. Mission

Implémenter dans Compagnon une couche native et production-grade d'intégration avec Plane.

Cette intégration doit remplacer la dépendance opérationnelle à un serveur MCP Plane générique pour les opérations applicatives de Compagnon.

L'objectif n'est pas de créer quelques wrappers HTTP isolés.

L'objectif est de construire une véritable couche d'intégration Plane composée de :

* client HTTP centralisé ;
* configuration et gestion sécurisée des connexions ;
* types TypeScript ;
* validation des entrées et sorties ;
* services métier Plane ;
* outils Mastra spécialisés ;
* gestion des erreurs ;
* pagination ;
* retries contrôlés ;
* idempotence lorsque nécessaire ;
* observabilité ;
* tests unitaires et d'intégration ;
* documentation ;
* séparation stricte entre transport, domaine et outils agent.

L'intégration doit être suffisamment modulaire pour qu'un futur agent puisse manipuler Plane sans connaître les détails HTTP de l'API.

---

# 2. Principe architectural obligatoire

Ne pas laisser les agents appeler directement `fetch()` vers Plane.

Ne pas mettre des URLs Plane dans les outils.

Ne pas dupliquer les headers d'authentification dans chaque outil.

Ne pas dupliquer les règles de pagination.

Ne pas dupliquer les conversions d'erreurs.

Ne pas mélanger logique Plane et logique Mastra Tool.

L'architecture attendue est :

```text
Agent
  ↓
Mastra Tool
  ↓
Plane Service
  ↓
Plane Client
  ↓
Plane REST API
```

Avec séparation stricte :

```text
Plane Client
    transport HTTP uniquement

Plane Services
    opérations métier et orchestration

Plane Tools
    interface agent + validation d'entrée/sortie
```

---

# 3. Architecture cible

Créer ou adapter une structure similaire à :

```text
src/mastra/
├── plane/
│   ├── client/
│   │   ├── plane-client.ts
│   │   ├── plane-errors.ts
│   │   ├── plane-http.ts
│   │   └── plane-pagination.ts
│   │
│   ├── config/
│   │   └── plane-config.ts
│   │
│   ├── domain/
│   │   ├── plane-types.ts
│   │   ├── plane-schemas.ts
│   │   └── plane-enums.ts
│   │
│   ├── services/
│   │   ├── workspace-service.ts
│   │   ├── project-service.ts
│   │   ├── work-item-service.ts
│   │   ├── cycle-service.ts
│   │   ├── module-service.ts
│   │   ├── comment-service.ts
│   │   ├── member-service.ts
│   │   └── relation-service.ts
│   │
│   ├── tools/
│   │   ├── workspace/
│   │   ├── projects/
│   │   ├── work-items/
│   │   ├── cycles/
│   │   ├── modules/
│   │   ├── comments/
│   │   ├── members/
│   │   └── relations/
│   │
│   └── tests/
│       ├── client/
│       ├── services/
│       └── tools/
```

Respecter la structure existante du projet si une convention équivalente existe déjà.

Ne pas créer une seconde couche de connexion Plane si une infrastructure de connexion/configuration existe déjà.

---

# 4. Documentation API comme source de vérité

Avant d'implémenter chaque ressource Plane :

1. consulter la documentation API officielle actuelle ;
2. identifier l'endpoint exact ;
3. identifier la méthode HTTP ;
4. identifier les paramètres de chemin ;
5. identifier les query parameters ;
6. identifier le body ;
7. identifier les réponses ;
8. identifier les codes HTTP ;
9. identifier les contraintes de pagination ;
10. identifier les ressources liées.

Ne jamais utiliser les anciens endpoints `/issues/` lorsque `/work-items/` est disponible.

Utiliser les endpoints `/work-items/` de la version actuelle de l'API.

Ne jamais déduire une route uniquement à partir du nom intuitif d'une ressource.

Si une route n'est pas vérifiée dans la documentation actuelle, ne pas l'inventer.

---

# 5. Client Plane centralisé

Créer un client Plane unique.

Il doit centraliser :

* base URL ;
* authentification ;
* headers ;
* sérialisation JSON ;
* timeout ;
* retry ;
* traitement des erreurs ;
* pagination ;
* observabilité ;
* correlation ID si disponible.

Exemple conceptuel :

```ts
interface PlaneClient {
  request<T>(options: PlaneRequestOptions): Promise<T>;
}
```

Le client doit supporter :

```text
GET
POST
PATCH
PUT si réellement nécessaire
DELETE
```

Ne pas exposer directement `fetch()` aux agents.

---

# 6. Configuration

La configuration doit supporter au minimum :

```text
PLANE_BASE_URL
PLANE_API_KEY
PLANE_WORKSPACE_SLUG
```

Pour une instance self-hosted :

```text
PLANE_BASE_URL
```

doit pouvoir pointer vers l'installation correspondante.

Pour Plane Cloud, la base API officielle est `https://api.plane.so/`.

L'API key doit être traitée comme un secret.

Ne jamais :

* l'écrire dans les logs ;
* l'inclure dans les messages agent ;
* la retourner dans une ToolResult ;
* la placer dans un fichier versionné ;
* l'inclure dans une erreur HTTP affichée à l'utilisateur.

Plane recommande explicitement de conserver l'API key secrète et de la régénérer si elle est compromise.

---

# 7. Gestion des connexions

L'intégration doit respecter le système actuel de connexions de Compagnon.

Si plusieurs connexions Plane sont supportées :

```text
connectionId
    ↓
connection provider
    ↓
resolved Plane configuration
    ↓
PlaneClient
```

Ne pas transformer `PLANE_API_KEY` en dépendance globale si l'architecture actuelle permet déjà des connexions dynamiques.

Le service doit pouvoir sélectionner explicitement une connexion.

---

# 8. Types du domaine

Créer des types TypeScript explicites pour les ressources réellement utilisées :

```text
PlaneWorkspace
PlaneProject
PlaneWorkItem
PlaneCycle
PlaneModule
PlaneComment
PlaneMember
PlaneRelation
PlaneState
PlaneLabel
PlanePriority
PlanePagination
```

Ne pas utiliser `any`.

Ne pas exposer directement toutes les réponses HTTP brutes à l'agent si un modèle de domaine plus propre est possible.

Conserver les identifiants Plane sous forme de chaînes strictement typées si cela correspond aux conventions du projet.

---

# 9. Validation Zod

Les entrées des tools doivent être validées avec Zod.

Exemple conceptuel :

```ts
const getWorkItemInputSchema = z.object({
  workspaceSlug: z.string().min(1),
  projectId: z.string().uuid(),
  workItemId: z.string().uuid(),
});
```

Adapter les validations aux identifiants réellement utilisés par l'API.

Valider également les sorties lorsque cela apporte une garantie importante.

Ne pas laisser le LLM générer des structures arbitraires.

---

# 10. Workspace

Les opérations Plane doivent être capables de travailler explicitement dans un workspace.

Le `workspaceSlug` doit être traité comme un paramètre important.

Le service doit éviter les appels implicites vers un workspace aléatoire.

Lorsque la connexion possède déjà un workspace par défaut :

```text
connection
    ↓
workspaceSlug
```

peut être résolu automatiquement.

Lorsque plusieurs workspaces sont possibles, l'outil doit permettre une sélection explicite.

---

# 11. Outils Workspace

Implémenter des outils pour :

```text
get_workspace
list_workspaces
```

si l'API et les permissions disponibles le permettent.

L'objectif est de permettre à l'agent de comprendre le contexte Plane avant d'effectuer des opérations destructrices ou fortement contextuelles.

---

# 12. Outils Project

Implémenter au minimum :

```text
list_projects
get_project
create_project
update_project
archive_project
```

Ne créer que les opérations réellement supportées par l'API et nécessaires au produit.

Chaque outil doit :

* valider ses entrées ;
* appeler le service approprié ;
* retourner une réponse structurée ;
* masquer les secrets ;
* convertir les erreurs Plane en erreurs agent compréhensibles.

Les projets sont des ressources de premier niveau contenant notamment work items, cycles et modules.

---

# 13. Outils Work Items

Les Work Items sont la ressource centrale de travail de Plane.

Implémenter au minimum :

```text
list_work_items
search_work_items
get_work_item
create_work_item
update_work_item
delete_work_item
```

et, selon l'API réellement disponible :

```text
assign_work_item
change_work_item_state
set_work_item_priority
set_work_item_estimate
set_work_item_labels
set_work_item_cycle
set_work_item_module
```

Ne créer des outils spécialisés que lorsque cela améliore réellement l'utilisation par l'agent.

Éviter un tool "plane_raw_request" permettant au LLM d'envoyer n'importe quelle requête.

---

# 14. Recherche de Work Items

Créer une capacité de recherche structurée.

Le service doit permettre selon les possibilités actuelles de l'API :

```text
query
project
state
assignee
priority
labels
cycle
module
date filters
pagination
```

Ne pas faire dépendre l'agent d'un simple `GET` massif de toutes les issues/work items.

Utiliser la pagination et les filtres de l'API.

Plane documente notamment la pagination par curseur ainsi que les paramètres `fields` et `expand`.

---

# 15. Pagination

La pagination doit être gérée au niveau du client/service, pas par chaque tool.

Supporter les réponses contenant notamment :

```text
next_cursor
prev_cursor
next_page_results
prev_page_results
results
```

selon la réponse de l'endpoint utilisé.

Les tools doivent offrir deux comportements :

```text
page mode
→ retourner une page contrôlée

collect mode
→ récupérer plusieurs pages jusqu'à une limite sûre
```

Ne jamais récupérer un nombre illimité de ressources.

Définir une limite maximale.

---

# 16. Cycles

Implémenter les opérations nécessaires pour :

```text
list_cycles
get_cycle
create_cycle
update_cycle
delete_cycle
list_cycle_work_items
add_work_items_to_cycle
remove_work_items_from_cycle
```

L'API actuelle documente notamment la création de cycles et l'association de work items à un cycle.

---

# 17. Modules

Implémenter :

```text
list_modules
get_module
create_module
update_module
delete_module
list_module_work_items
add_work_items_to_module
remove_work_items_from_module
```

L'API actuelle expose notamment les opérations d'association de work items aux modules.

---

# 18. Comments

Implémenter :

```text
list_work_item_comments
create_work_item_comment
```

Puis les opérations de modification/suppression uniquement si elles sont nécessaires et supportées par l'API actuelle.

Les commentaires actuels utilisent les endpoints `/work-items/{work_item_id}/comments/`.

Le tool doit clairement distinguer :

```text
comment_stripped
comment_html
comment_json
access
attachments
```

lorsque ces données sont disponibles.

Ne jamais exposer inutilement tout le payload brut à l'agent.

---

# 19. Members et assignees

Implémenter les capacités nécessaires pour :

```text
list_project_members
get_member
resolve_member
```

et permettre aux autres tools de résoudre un assignee de manière fiable.

Ne pas obliger le LLM à connaître les UUID directement lorsqu'il peut utiliser un nom ou identifiant logique résolu par le service.

---

# 20. Relations

Implémenter une couche dédiée aux relations entre work items si l'API actuelle le permet.

Supporter autant que possible :

```text
create_relation
list_relations
delete_relation
```

avec types explicitement modélisés.

Ne jamais demander à l'agent de construire directement les structures internes Plane.

---

# 21. Idempotence

Les opérations créant ou modifiant des données doivent être conçues pour limiter les doublons.

Exemples :

```text
create_work_item
create_comment
create_cycle
create_module
```

Avant une création répétable :

* rechercher un élément existant lorsqu'une clé logique fiable existe ;
* utiliser un identifiant externe lorsque l'API le supporte ;
* refuser les créations ambiguës lorsque nécessaire.

Un agent ne doit jamais créer cinq work items identiques parce qu'il a été relancé.

---

# 22. Actions destructrices

Les actions suivantes doivent être traitées comme sensibles :

```text
delete_work_item
delete_comment
delete_cycle
delete_module
archive_project
bulk modifications
```

Le tool doit fournir des garde-fous.

Pour une action à fort impact :

```text
request
 ↓
validation
 ↓
confirmation policy
 ↓
execute
```

Ne jamais cacher une opération destructive derrière un nom anodin.

---

# 23. Erreurs

Créer une hiérarchie d'erreurs :

```text
PlaneAuthenticationError
PlaneAuthorizationError
PlaneNotFoundError
PlaneValidationError
PlaneRateLimitError
PlaneConflictError
PlaneServerError
PlaneNetworkError
PlaneUnknownError
```

Chaque erreur doit conserver :

```text
status
resource
operation
retryable
correlationId
```

sans contenir de secret.

---

# 24. Retry

Les retries doivent être contrôlés.

Retry automatique uniquement pour les erreurs réellement transitoires :

```text
network timeout
connection reset
429
5xx
```

Ne pas retry :

```text
400
401
403
404
validation errors
conflict errors
```

Utiliser backoff exponentiel avec jitter.

Définir un nombre maximal de tentatives.

---

# 25. Rate limiting

Prévoir une stratégie de protection contre les limites API :

```text
429
Retry-After
backoff
```

Ne pas lancer de boucles parallèles incontrôlées lors de la synchronisation ou de la récupération de données.

---

# 26. Observabilité

Chaque opération Plane doit pouvoir être tracée avec :

```text
operation
resource
workspace
project
requestId/correlationId
duration
status
retryCount
```

Ne jamais enregistrer :

```text API key
Authorization header
secret values
tokens
```

Pour les outils sensibles, logger uniquement les métadonnées nécessaires.

---

# 27. Tool descriptions

Les descriptions des tools sont importantes parce qu'elles servent d'interface au LLM.

Chaque tool doit décrire :

```text
Purpose
When to use
Required identifiers
Side effects
Danger level
Expected result
Common failure cases
```

Exemple :

```text
create_work_item

Purpose:
Create one work item in a Plane project.

Use when:
A new actionable piece of work must be recorded in Plane.

Side effects:
Creates persistent project data.

Do not use when:
A work item may already exist and no duplication check has been performed.
```

Les descriptions doivent être précises, courtes et opérationnelles.

---

# 28. Ne jamais exposer un outil générique dangereux

Ne pas créer :

```text
plane_request
plane_raw_api
plane_execute
```

permettant au LLM de choisir arbitrairement :

```text
method
url
headers
body
```

Cela détruirait les garanties de typage et de sécurité que cette architecture est censée fournir.

Les outils doivent être spécialisés.

---

# 29. Séparation Agent / Plane

Le Planner ne doit pas connaître l'API Plane.

Le Developer ne doit pas connaître l'API Plane.

Le Verification Agent ne doit pas construire manuellement les appels Plane.

Ils doivent utiliser :

```text
agent
 ↓
tool
 ↓
service
 ↓
PlaneClient
```

Chaque agent ne voit que les outils dont il a réellement besoin.

---

# 30. Permissions par agent

Définir des ensembles d'outils.

Exemple :

```text
Planner:
    read-only Plane tools

Developer:
    read/write work items
    comments
    state updates

Verification:
    read work items
    comments
    verification metadata

DevOps:
    read/write relevant project work items

Companion:
    orchestration-level tools
```

Ne pas donner tous les outils Plane à tous les agents.

Respecter le principe du moindre privilège.

---

# 31. Sécurité

Traiter Plane comme une intégration externe de production.

Contrôler :

* secrets ;
* permissions ;
* validation ;
* SSRF ;
* URLs de base autorisées ;
* timeouts ;
* redirections HTTP ;
* payload size ;
* pagination limits ;
* retries ;
* destructive operations ;
* logs.

Le `PLANE_BASE_URL` ne doit pas pouvoir être transformé arbitrairement par le modèle ou par une entrée utilisateur en URL de destination non approuvée.

---

# 32. Tests

Créer plusieurs niveaux de tests.

### Unit tests

Tester :

```text
configuration
client
pagination
error mapping
request builders
schema validation
services
```

### Integration tests

Tester avec un serveur Plane de test/self-hosted ou un mock HTTP contrôlé :

```text
create project
create work item
update work item
search work items
comments
cycles
modules
pagination
errors
429
5xx
```

### Tool tests

Tester chaque Tool Mastra indépendamment :

```text
valid input
invalid input
successful API
API failure
permission failure
not found
```

### Regression tests

Tester les scénarios critiques de Compagnon :

```text
create Plane issue
find issue
update issue
comment issue
move issue to cycle
assign issue
search project
```

---

# 33. Contrat de service

Les services doivent retourner des modèles stables.

Ne pas exposer directement :

```ts
Response
fetch Response
unknown
any
```

aux agents.

Préférer :

```ts
Promise<PlaneWorkItem>
Promise<PlaneProject>
Promise<PlanePaginated<PlaneWorkItem>>
```

---

# 34. Contrat des tools

Chaque Tool doit avoir :

```text
inputSchema
execute
structured result
clear errors
```

Exemple :

```ts
export const createWorkItemTool = createTool({
  id: "plane_create_work_item",

  description: "...",

  inputSchema: createWorkItemInputSchema,

  execute: async ({ context }) => {
    return workItemService.create(context);
  },
});
```

Adapter au mécanisme Tool réel utilisé dans la version de Mastra du projet.

---

# 35. API compatibility

Toutes les implémentations doivent utiliser les endpoints actuels de l'API Plane.

Le code doit éviter explicitement les routes `/issues/` historiques et privilégier `/work-items/`. Plane indique que les anciennes routes `/issues/` sont dépréciées et que leur fin de support est fixée au 31 mars 2026.

Ne pas recopier de vieux exemples de MCP ou de clients communautaires lorsque l'API officielle actuelle fournit une route équivalente.

---

# 36. Recherche de documentation pendant l'implémentation

Si une opération Plane n'est pas suffisamment documentée localement :

1. consulter la documentation API officielle ;
2. vérifier la version actuelle ;
3. confirmer l'endpoint ;
4. confirmer la structure ;
5. implémenter ;
6. tester ;
7. documenter la décision.

Ne pas inventer les endpoints.

---

# 37. Migration depuis l'ancien Plane MCP

Si un ancien MCP Plane existe déjà :

1. identifier tous les usages ;
2. cartographier chaque capacité ;
3. identifier les outils réellement utilisés ;
4. implémenter leurs équivalents natifs ;
5. écrire les tests ;
6. migrer les agents vers les nouveaux tools ;
7. vérifier les workflows ;
8. supprimer progressivement la dépendance MCP ;
9. conserver temporairement le mécanisme uniquement comme fallback si nécessaire ;
10. supprimer le fallback une fois la migration validée.

Ne jamais supprimer immédiatement l'ancien chemin sans avoir prouvé que les fonctionnalités critiques sont couvertes.

---

# 38. Compatibilité avec Plane self-hosted

Ne pas supposer que Plane est toujours sur Plane Cloud.

Le client doit fonctionner avec :

```text
Plane Cloud
self-hosted Plane
```

via :

```text
baseUrl configurable
```

Le chemin API reste construit relativement à cette base.

---

# 39. Documentation

Créer une documentation interne couvrant :

```text
Architecture
Configuration
Authentication
Connections
Resources
Tools
Error handling
Retries
Pagination
Security
Testing
Migration from MCP
Adding a new Plane resource
```

Une nouvelle ressource Plane doit être ajoutable sans modifier le cœur HTTP.

---

# 40. Definition of Done

L'implémentation n'est considérée comme terminée que lorsque :

* le client Plane centralisé fonctionne ;
* les connexions/configurations sont sécurisées ;
* les types sont stricts ;
* les schémas sont validés ;
* les services métier fonctionnent ;
* les tools Mastra fonctionnent ;
* pagination et retries sont testés ;
* les erreurs sont normalisées ;
* les opérations destructrices sont protégées ;
* les secrets ne sont jamais loggés ;
* les agents ont uniquement les tools nécessaires ;
* les tests unitaires passent ;
* les tests d'intégration passent ;
* les usages MCP existants sont couverts ou migrés ;
* la documentation est à jour ;
* aucun endpoint `/issues/` déprécié n'est introduit.

---

# 41. Ordre d'implémentation obligatoire

Ne pas implémenter tous les tools en même temps.

Suivre cet ordre :

```text
Phase 1
Configuration + connexion + client HTTP

Phase 2
Types + schemas + erreurs + pagination

Phase 3
Workspace + Project

Phase 4
Work Items

Phase 5
Comments

Phase 6
Cycles + Modules

Phase 7
Members + Relations

Phase 8
Mastra Tools

Phase 9
Tests complets

Phase 10
Migration des agents

Phase 11
Décommissionnement progressif du MCP Plane
```

Chaque phase doit être validée avant de dépendre de la suivante.

---

# 42. Principe final

Le Plane Tooling Layer doit devenir une infrastructure interne fiable de Compagnon.

Les agents doivent penser :

```text
"Je veux créer un travail dans Plane."
```

et non :

```text
"Je dois appeler POST /api/v1/workspaces/..."
```

Le service doit absorber toute la complexité de Plane.

L'agent doit recevoir une interface métier claire, typée, limitée et sécurisée.

L'API Plane peut évoluer.

Les outils Compagnon doivent rester stables.

Le MCP Plane ne doit pas être requis pour le fonctionnement normal de Compagnon.

Toute opération critique doit être :

```text
déclarée
→ validée
→ exécutée
→ observée
→ vérifiable
```

Le résultat attendu est une intégration Plane native, modulaire, testable et détachable, utilisable par plusieurs agents sans coupler ces agents à l'API HTTP de Plane.
