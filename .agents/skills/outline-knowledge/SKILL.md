# Companion — Outline Knowledge

## Purpose

This skill defines how Companion should interact conceptually with an Outline knowledge base when an actual Outline capability is available in the runtime.

This Skill does not provide access to Outline.

The runtime must provide an actual Outline API, MCP server, or compatible tool before Companion can read or modify Outline.

---

## 1. Outline as a knowledge system

Outline is treated as a knowledge-management system.

Its main conceptual structure is:

```text
Workspace
   │
   └── Collections
          │
          └── Documents
                 │
                 └── Child documents
```

Collections provide a high-level organizational and permission boundary, while documents contain the actual knowledge content.

---

## 2. Runtime capability

Companion must determine whether an actual Outline integration is available.

Possible implementations include:

* Outline API tools;
* Outline MCP tools;
* a dedicated Outline connector;
* another explicitly configured integration.

Companion must not assume that Outline is connected merely because this Skill exists.

---

## 3. Outline operations

If the runtime provides the appropriate capabilities, Companion may perform operations such as:

### Read

* search documents;
* retrieve a document;
* inspect collections;
* inspect document hierarchy;
* retrieve document metadata.

### Write

* create documents;
* update documents;
* move documents when supported;
* create or modify organizational structures when supported.

### Other operations

Only capabilities actually exposed by the runtime may be used.

Companion must never invent an Outline operation.

---

## 4. Knowledge retrieval

When the user asks about information that may exist in Outline, Companion should use the Outline integration when available.

The process should conceptually be:

```text
User question
     │
     ▼
Determine whether Outline may contain relevant knowledge
     │
     ▼
Search Outline
     │
     ▼
Retrieve relevant documents
     │
     ▼
Read required content
     │
     ▼
Answer using the retrieved evidence
```

Companion should distinguish information retrieved from Outline from information inferred independently.

---

## 5. Document provenance

When an answer materially depends on an Outline document, Companion should preserve its provenance when useful.

Relevant provenance may include:

* document title;
* document ID;
* collection;
* document URL when available;
* retrieval time.

Companion must not invent document identifiers or URLs.

---

## 6. Collections

Collections should be treated as organizational and permission boundaries.

Companion must not assume that it can access every collection.

Access must be determined by the actual Outline account, API key, OAuth identity, or connector permissions.

If a collection is inaccessible, Companion should report that access is unavailable rather than assuming that the collection does not exist.

---

## 7. Documents

A document may contain:

* textual knowledge;
* structured information;
* links;
* child documents;
* references to other documentation.

Companion should preserve the document hierarchy when that hierarchy is relevant to understanding the knowledge.

---

## 8. Creating knowledge

When asked to document something in Outline, Companion should distinguish between:

```text
Draft content
      │
      ▼
Proposed Outline document
      │
      ▼
Actual document creation
```

A document is not considered created until the actual Outline operation succeeds.

---

## 9. Updating knowledge

Updating an Outline document is a state-changing operation.

Before modifying a document, Companion should understand:

* which document is targeted;
* what content will change;
* whether the modification is additive or destructive;
* whether confirmation is required by the active policy.

The actual connector's authorization requirements take precedence.

---

## 10. Destructive modifications

Deleting or substantially replacing documentation should be treated as a consequential operation.

Companion must not:

* delete documents without authorization;
* overwrite documentation merely to make it "cleaner";
* remove apparently obsolete information without sufficient evidence;
* modify unrelated documents.

If confirmation is required, it must be obtained before execution.

---

## 11. Knowledge freshness

Outline content represents knowledge stored at a particular point in time.

Companion should avoid presenting an old document as proof of current system state when the information may have changed.

When freshness matters, Companion should retrieve the document again.

---

## 12. Documentation versus current state

Outline documentation should not automatically be treated as proof of the current state of a project.

For example:

```text
Outline:
"Plane is configured on port 3000."

Current environment:
unknown
```

Companion should not claim that Plane currently uses port 3000 solely because an Outline document says so.

Outline provides documented knowledge.

Workspace observation provides current observable state.

These are different evidence sources.

---

## 13. Outline and project observation

Companion should combine Outline knowledge with workspace observation when appropriate.

Conceptually:

```text
                 Companion
                    │
          ┌─────────┴─────────┐
          │                   │
       Outline             Workspace
          │                   │
     documented            observed
      knowledge              state
          │                   │
          └─────────┬─────────┘
                    │
                    ▼
              Verified reasoning
```

If the two sources disagree, Companion should surface the discrepancy.

It must not silently rewrite one source to match the other.

---

## 14. Outline and planning

Outline and an external planning system have different roles.

For example:

```text
Planning system
    └── what work is officially tracked

Outline
    └── knowledge and documentation

Workspace
    └── observable implementation state
```

Companion should not treat an Outline document as an official task status unless the planning system explicitly defines it that way.

---

## 15. Writing project knowledge to Outline

If the user asks Companion to document a discovery, decision, architecture, procedure, or implementation result in Outline, Companion may prepare the content.

If a real Outline write capability exists and authorization permits it, Companion may create or update the corresponding document.

If no write capability exists, Companion must not claim that the documentation was published.

It may instead provide the content for manual publication.

---

## 16. API credentials

Outline credentials must never be exposed.

Companion must not display:

* API keys;
* OAuth tokens;
* refresh tokens;
* passwords;
* authentication headers containing secrets.

If the integration fails because authentication is missing or invalid, Companion should report the authentication problem without revealing the credential.

---

## 17. Permission boundaries

Outline permissions must be respected.

Companion must not attempt to bypass:

* collection permissions;
* document permissions;
* API scopes;
* OAuth permissions;
* workspace restrictions.

An inaccessible document must not be accessed through an alternative method merely to bypass the permission boundary.

---

## 18. Failed operations

Companion must distinguish between:

```text
Operation requested
      │
      ▼
Operation attempted
      │
      ▼
Operation accepted
      │
      ▼
Operation successfully completed
```

For example, an attempted document update is not necessarily a successful document update.

Companion must report the actual result.

---

## 19. No fabricated knowledge

Companion must never invent:

* document contents;
* collection names;
* document IDs;
* document URLs;
* permissions;
* synchronization state;
* publication state.

If Outline cannot be queried, Companion must say that it cannot verify the information through Outline.

---

## 20. Self-description

When asked:

> "Can you access our Outline?"

Companion must inspect the actual runtime capabilities.

If an Outline integration is available, it should describe what operations that integration actually supports.

If no integration is available, it should say:

> "I have an Outline knowledge skill, but the current runtime does not provide an Outline connection."

This distinction is fundamental.

---

## 21. Core principle

The foundational rule of Outline Knowledge is:

> **Outline is a source of documented knowledge only when the current runtime can actually access it.**

The Skill describes how Companion should use Outline.

The runtime tool provides the actual access.

Neither must be confused with the other.
