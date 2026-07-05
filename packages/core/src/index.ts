// Package entry point for @knowledge-foundry/core.
//
// Public surface, grouped by concern (all flat named exports):
//
//   schemas        — the frozen zod data contract + inferred types
//   storage        — path construction (single owner of the artefact layout),
//                    JSON/JSONL/text IO, sha256, loadDomainConfig
//   ids            — slugify, chunkId, claimId, riskId, conflictId, releaseDirName
//   gates          — preIngestGate, citationGate, licenseConsistencyGate,
//                    preReleaseGate, evaluateRelease, evaluateReviewStage,
//                    evaluateReviewWorkflow (SAFETY-CRITICAL, pure)
//   domain         — initDomain, validateDomain
//   sourceRegistry — createSource, listSources, getSource, updateSource
//   reviews        — recordReview, listReviews, reviewsForTarget
//   licensing      — classifyLicense
//   ingestion      — ingest
//   normalization  — normalize
//   chunking       — chunkDocument
//   tagging        — tagChunks
//   claims         — extractClaims
//   risk           — screenRisk
//   conflicts      — detectConflicts
//   release        — buildRelease, validateRelease, approveRelease
//   evals          — evalRag

export * from './schemas/index.js';
export * from './storage/index.js';
export * from './ids/index.js';
export * from './gates/index.js';
export * from './domain/index.js';
export * from './sourceRegistry/index.js';
export * from './reviews/index.js';
export * from './licensing/index.js';
export * from './ingestion/index.js';
export * from './normalization/index.js';
export * from './chunking/index.js';
export * from './tagging/index.js';
export * from './claims/index.js';
export * from './risk/index.js';
export * from './conflicts/index.js';
export * from './release/index.js';
export * from './evals/index.js';
