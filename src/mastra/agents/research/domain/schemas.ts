import { z } from "zod";
import {
  ConfidenceLevel,
  FindingImportance,
  FreshnessRequirement,
  ResearchDepth,
  ResearchStatus,
  ResearchStopReason,
  SourceCategory,
} from "./enums";

// ---------------------------------------------------------------------------
// Research request contract
// ---------------------------------------------------------------------------

export const researchRequestSchema = z.object({
  question: z.string().min(1).describe("The research question to investigate."),
  objective: z
    .string()
    .optional()
    .describe("The user's actual objective behind the question."),
  scope: z
    .string()
    .optional()
    .describe("Optional scope: what is in and out of scope."),
  constraints: z
    .array(z.string().min(1))
    .optional()
    .describe("Hard constraints the research must respect."),
  freshnessRequirement: z
    .enum([
      FreshnessRequirement.CURRENT,
      FreshnessRequirement.RECENT,
      FreshnessRequirement.HISTORICAL,
      FreshnessRequirement.ANY,
    ])
    .optional()
    .describe(
      "How fresh the evidence must be. 'current' for latest versions/pricing/state.",
    ),
  preferredSources: z
    .array(z.string().min(1))
    .optional()
    .describe("Source kinds or hosts to prefer (e.g. official docs)."),
  excludedSources: z
    .array(z.string().min(1))
    .optional()
    .describe("Hosts or source kinds to avoid."),
  expectedOutput: z
    .string()
    .optional()
    .describe("What the consumer expects from the report (e.g. comparison)."),
  depth: z
    .enum([ResearchDepth.QUICK, ResearchDepth.STANDARD, ResearchDepth.DEEP])
    .optional()
    .describe("Optional override for the automatic research depth."),
});

// ---------------------------------------------------------------------------
// Evidence model: Claim → Evidence → Source
// ---------------------------------------------------------------------------

export const sourceSchema = z.object({
  id: z.string().min(1),
  url: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  publisher: z.string().min(1).optional(),
  category: z.enum([
    SourceCategory.OFFICIAL_DOCUMENTATION,
    SourceCategory.OFFICIAL_REPOSITORY,
    SourceCategory.PRIMARY_SOURCE,
    SourceCategory.OFFICIAL_ANNOUNCEMENT,
    SourceCategory.ACADEMIC,
    SourceCategory.TECHNICAL_PUBLICATION,
    SourceCategory.COMMUNITY_DISCUSSION,
    SourceCategory.SEARCH_SUMMARY,
    SourceCategory.OTHER,
  ]),
  publishedAt: z.string().optional().describe("ISO date the source was published."),
  accessedAt: z.string().describe("ISO date the source was consulted."),
  retrievalMethod: z
    .enum(["search", "fetch", "github", "documentation", "other"])
    .optional(),
  note: z
    .string()
    .optional()
    .describe("What the source says, relevant to the research question."),
});

export const evidenceSchema = z.object({
  id: z.string().min(1),
  claim: z.string().min(1).describe("The specific claim this evidence supports."),
  quote: z
    .string()
    .optional()
    .describe("Verbatim excerpt from the source, when available."),
  supports: z
    .boolean()
    .describe("true = supports the claim, false = contradicts the claim."),
  sourceIds: z.array(z.string().min(1)),
});

export const findingSchema = z.object({
  id: z.string().min(1),
  statement: z.string().min(1).describe("An evidence-backed finding."),
  confidence: z.enum([
    ConfidenceLevel.HIGH,
    ConfidenceLevel.MEDIUM,
    ConfidenceLevel.LOW,
  ]),
  confidenceBasis: z
    .array(z.string().min(1))
    .describe(
      "Why this confidence: highest-authority source category and corroborating evidence count.",
    ),
  importance: z.enum([
    FindingImportance.CORE,
    FindingImportance.SUPPORTING,
    FindingImportance.CONTEXTUAL,
  ]),
  evidenceIds: z.array(z.string().min(1)),
});

export const contradictionSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1).describe("What the sources disagree about."),
  claims: z
    .array(z.string().min(1))
    .describe("The conflicting statements found in the sources."),
  evidenceIds: z.array(z.string().min(1)),
  resolved: z.boolean(),
  resolution: z
    .string()
    .optional()
    .describe("Outcome of the verification step, when resolved."),
});

export const uncertaintySchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1).describe("What remains unknown or uncertain."),
  impact: z
    .string()
    .optional()
    .describe("Why this uncertainty matters for the consumer."),
  sourceIds: z.array(z.string().min(1)),
});

export const recommendationSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  confidence: z.enum([
    ConfidenceLevel.HIGH,
    ConfidenceLevel.MEDIUM,
    ConfidenceLevel.LOW,
  ]),
  evidenceIds: z.array(z.string().min(1)),
});

// ---------------------------------------------------------------------------
// Research limits + telemetry
// ---------------------------------------------------------------------------

export const researchLimitsSchema = z.object({
  requestedDepth: z.enum([
    ResearchDepth.QUICK,
    ResearchDepth.STANDARD,
    ResearchDepth.DEEP,
  ]),
  maxIterations: z.number().int().positive(),
  maxSearches: z.number().int().positive(),
  maxReads: z.number().int().positive(),
  maxRuntimeMs: z.number().int().positive(),
  iterationsUsed: z.number().int().nonnegative(),
  searchesUsed: z.number().int().nonnegative(),
  readsUsed: z.number().int().nonnegative(),
  stoppedReason: z.enum([
    ResearchStopReason.COMPLETED,
    ResearchStopReason.LIMIT_REACHED,
    ResearchStopReason.TIME_EXPIRED,
    ResearchStopReason.BLOCKED,
    ResearchStopReason.FAILED,
    ResearchStopReason.NO_TOOLS,
  ]),
});

// ---------------------------------------------------------------------------
// Research result contract
// ---------------------------------------------------------------------------

export const researchResultSchema = z.object({
  status: z.enum([
    ResearchStatus.SUCCESS,
    ResearchStatus.PARTIAL,
    ResearchStatus.BLOCKED,
    ResearchStatus.FAILED,
  ]),
  question: z.string().min(1),
  answer: z.string().describe("Direct answer to the research question."),
  executiveSummary: z
    .string()
    .describe("Short summary for the orchestrator to present."),
  findings: z.array(findingSchema),
  evidence: z.array(evidenceSchema),
  sources: z.array(sourceSchema),
  contradictions: z.array(contradictionSchema).optional(),
  uncertainties: z.array(uncertaintySchema).optional(),
  recommendations: z.array(recommendationSchema).optional(),
  errors: z.array(z.string().min(1)).optional(),
  warnings: z.array(z.string().min(1)).optional(),
  limits: researchLimitsSchema,
  researchedAt: z.string().describe("ISO timestamp the research completed."),
});

// ---------------------------------------------------------------------------
// Research plan contract (phase: planning)
// ---------------------------------------------------------------------------

export const researchStepSchema = z.object({
  id: z.string().min(1),
  intent: z.string().min(1).describe("What this step needs to establish."),
  queries: z
    .array(z.string().min(1))
    .describe("Suggested search queries for this step."),
  tools: z
    .array(z.string().min(1))
    .describe("Tools to use: web_search, web_fetch, github, documentation."),
});

export const researchPlanSchema = z.object({
  depth: z.enum([
    ResearchDepth.QUICK,
    ResearchDepth.STANDARD,
    ResearchDepth.DEEP,
  ]),
  freshnessRequirement: z.string().min(1),
  subQuestions: z.array(z.string().min(1)),
  steps: z.array(researchStepSchema),
});

// ---------------------------------------------------------------------------
// Research pass contract (phase: iterative research loop)
// ---------------------------------------------------------------------------

export const researchPassResultSchema = z
  .object({
    status: z.enum(["completed", "incomplete", "blocked"]),
    searchesPerformed: z.number().int().nonnegative(),
    readsPerformed: z.number().int().nonnegative(),
    sources: z.array(sourceSchema),
    evidence: z.array(evidenceSchema),
    gaps: z.array(z.string().min(1)),
    toolFailures: z.array(z.string().min(1)),
    toolsAvailable: z.boolean(),
    blockedReason: z.string().min(1).optional(),
    additionalSearchesSuggested: z
      .boolean()
      .optional()
      .describe("Set true when more research would materially improve the result."),
  })
  .strict();

// ---------------------------------------------------------------------------
// Synthesis contract (phase: final report)
// ---------------------------------------------------------------------------

export const researchSynthesisSchema = z
  .object({
    answer: z.string().min(1),
    executiveSummary: z.string().min(1),
    findings: z.array(findingSchema),
    contradictions: z.array(contradictionSchema),
    uncertainties: z.array(uncertaintySchema),
    recommendations: z.array(recommendationSchema),
    insufficientEvidence: z.boolean(),
    notes: z.array(z.string().min(1)).optional(),
  })
  .strict();