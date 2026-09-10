# Mastra Documentation

## Overview

Mastra = Framework TypeScript pour créer des agents AI et applications.

## Installation

```bash
npm install @mastra/core@latest zod@latest typescript@latest @types/node@latest mastra@latest
```

## Configuration TypeScript (tsconfig.json)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "outDir": "dist"
  },
  "include": ["src/**/*"]
}
```

## Modèle

Format: `provider/model` (ex: `openai/gpt-5.6-sol`)

```typescript
model: 'openai/gpt-5.6-sol'
// ou
model: 'anthropic/claude-sonnet-4-6'
// ou
model: 'google/gemini-2.5-flash'
```

Variables d'environnement requises:
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GOOGLE_API_KEY`

---

## Créer un Agent

```typescript
import { Agent } from '@mastra/core/agent'

export const myAgent = new Agent({
  id: 'my-agent',
  name: 'My Agent',
  instructions: 'Tu es un assistant...',
  model: 'openai/gpt-5.6-sol',
  // optional
  tools: { /* ... */ },
  skills: [/* ... */],
  agents: { /* subagents */ },
  memory: new Memory({ /* ... */ }),
  workspace: new Workspace({ /* ... */ }),
})
```

---

## Outils (Tools)

### Créer un outil

```typescript
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

export const myTool = createTool({
  id: 'my-tool',
  description: 'Description de l\'outil',
  inputSchema: z.object({
    param1: z.string(),
    param2: z.number().optional(),
  }),
  outputSchema: z.object({
    result: z.string(),
  }),
  execute: async ({ param1 }, context) => {
    // context = { requestContext, tracingContext, abortSignal }
    return { result: 'ok' }
  },
})
```

### Utiliser un outil dans un agent

```typescript
const agent = new Agent({
  id: 'agent',
  model: 'openai/gpt-5.6-sol',
  tools: { myTool },
})
```

---

## Subagents

```typescript
const subAgent = new Agent({
  id: 'sub-agent',
  name: 'Sub Agent',
  description: 'Description pour le parent (utilisée pour la délégation)',
  model: 'openai/gpt-5-mini',
})

const parentAgent = new Agent({
  id: 'parent',
  model: 'openai/gpt-5.6-sol',
  agents: { subAgent },  // <-- subagents ici
})
```

Le parent délègue automatiquement selon les instructions et descriptions.

### Delegation Hooks

```typescript
parentAgent.stream('任务', {
  maxSteps: 10,
  delegation: {
    onDelegationStart: async (context) => {
      console.log(`Délégation vers: ${context.primitiveId}`)
      return { proceed: true }
    },
    onDelegationComplete: async (context) => {
      console.log(`Terminé: ${context.primitiveId}`)
    },
  },
})
```

---

## Skills

### Inline skill

```typescript
import { createSkill } from '@mastra/core/skills'

const mySkill = createSkill({
  name: 'my-skill',
  description: 'Utiliser pour...',
  instructions: 'Instructions...',
})

const agent = new Agent({
  id: 'agent',
  model: 'openai/gpt-5.6-sol',
  skills: [mySkill],
})
```

### Skill depuis fichier

```typescript
const agent = new Agent({
  id: 'agent',
  model: 'openai/gpt-5.6-sol',
  skills: ['./skills/my-skill'],  // doit contenir SKILL.md
})
```

---

## Workflows

```typescript
import { createWorkflow, createStep } from '@mastra/core/workflows'
import { z } from 'zod'

const step1 = createStep({
  id: 'step-1',
  description: 'Description',
  inputSchema: z.object({ input: z.string() }),
  outputSchema: z.object({ output: z.string() }),
  execute: async ({ inputData }) => {
    return { output: inputData.input.toUpperCase() }
  },
})

const step2 = createStep({
  id: 'step-2',
  // ...
})

export const myWorkflow = createWorkflow({
  id: 'my-workflow',
  inputSchema: z.object({ input: z.string() }),
  outputSchema: z.object({ output: z.string() }),
})
  .then(step1)
  .then(step2)
  .commit()
```

### Appeler un agent dans un workflow

```typescript
const agentStep = createStep({
  execute: async ({ inputData, mastra }) => {
    const agent = mastra.getAgent('myAgent')
    const response = await agent.generate(`Prompt: ${inputData.text}`)
    return { result: response.text }
  },
})
```

---

## Memory

```typescript
import { Memory } from '@mastra/memory'
import { LibSQLStore } from '@mastra/libsql'

const agent = new Agent({
  id: 'agent',
  model: 'openai/gpt-5.6-sol',
  memory: new Memory({
    storage: new LibSQLStore({ id: 'storage', url: 'file:mastra.db' }),
    options: { generateTitle: false },
  }),
})
```

---

## Structured Output

```typescript
import { z } from 'zod'

const schema = z.object({
  name: z.string(),
  age: z.number(),
})

const response = await agent.generate(prompt, {
  structuredOutput: { schema },
})

console.log(response.object)  // { name: '...', age: 30 }
```

---

## Enregistrement (index.ts)

```typescript
import { Mastra } from '@mastra/core/mastra'
import { myAgent } from './agents/my-agent'

export const mastra = new Mastra({
  agents: { myAgent },
  tools: { /* ... */ },
  workflows: { /* ... */ },
  storage: /* ... */,
  server: { apiRoutes: [/* ... */] },
})
```

---

## Commandes

```bash
pnpm dev     # Développement
pnpm build   # Build production
pnpm start   # Démarrer production
```

## Workspaces

Compagnon tient sa tenancy par **workspace** : un workspace est un alias
application sur le `resourceId` Mastra. Les threads, conversations, mémoires
et connexions sont scopés par workspace ; le runtime (agents activés, racine
fichiers, modèle, instructions) est construit par workspace.

**Résolution du workspace** (dans cet ordre) :

1. header `x-workspace-id`
2. body/JSON `workspaceId`
3. query `workspaceId`
4. `default` (bootstrap automatique)

**API**

```
GET  /workspaces            # lister les workspaces (id, name, slug, config)
GET  /workspaces/:id        # détail d'un workspace
POST /workspaces            # créer { name, slug?, config? } → 201 + workspace
```

`config` (optionnel) : `projectPath` (racine des outils fichiers),
`enabledAgents` (sous-agents montés), `model`, `instructions`.

**Runtime** : `src/mastra/workspaces/runtime.ts` expose
`getWorkspaceRuntime(workspaceId)` (mis en cache, construit le companion +
les sous-agents activés, tools MCP filtrés aux agents activés) et
`dropWorkspaceRuntime(id)` (mise à jour de la config). Les routes et l'`index.ts`
résolvent tous les agents par le runtime — plus aucun singleton d'agent.

**Exemple**

```bash
# créer un workspace
curl -X POST http://localhost:4111/workspaces \
  -H 'content-type: application/json' \
  -d '{"name":"Guest A","workspaceId":"guest-a","config":{"projectPath":"/ws/guest-a","enabledAgents":["memory","planner"]}}'

# chatter dans ce workspace (mémoire/conversations scopées)
curl -X POST http://localhost:4111/chat \
  -H 'content-type: application/json' -H 'x-workspace-id: guest-a' \
  -d '{"messages":[{"role":"user","content":"Liste les fichiers du projet"}]}'
```

---

## Points clés

1. **Tools** = fonctions avec `createTool()`, Zod pour schémas
2. **Subagents** = agent dans propriété `agents` du parent
3. **Skills** = instructions réutilisables
4. **Workflows** = chaînes d'étapes avec `createStep()`
5. **Memory** = persistance conversationnelle
6. **Structured Output** = réponse typée Zod
