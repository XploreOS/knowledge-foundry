// Risk screening (contract-spec §2 RiskRecord). Applies the domain's
// risk_rules deterministically: a rule matches a chunk when any of its
// keywords appears (case-insensitive) OR the chunk's evidence level is listed.

import { ChunkRecord, RiskRecord } from '../schemas/index.js';
import type {
  DomainConfig,
  RiskRecord as RiskRecordType,
  SourceRecord as SourceRecordType,
} from '../schemas/index.js';
import { riskId } from '../ids/index.js';
import { resolveRoot, chunksFile, riskFile, readJsonl, writeJsonl } from '../storage/index.js';
import type { WorkspaceOpts } from '../storage/index.js';

/**
 * Screen a source's chunks against the domain risk rules, writing risk.jsonl
 * (an empty file is a valid "no risks found" result). Rules with neither
 * keywords nor evidence-level matchers never fire.
 */
export async function screenRisk(
  source: SourceRecordType,
  domainConfig: DomainConfig,
  opts?: WorkspaceOpts,
): Promise<RiskRecordType[]> {
  const root = resolveRoot(opts);
  const chunks = await readJsonl(chunksFile(root, source.source_id), ChunkRecord);
  const rules = domainConfig.risk_rules.rules;

  const risks: RiskRecordType[] = [];
  let seq = 1;

  for (const chunk of chunks) {
    const text = chunk.text.toLowerCase();
    for (const rule of rules) {
      const keywords = rule.match.keywords ?? [];
      const keywordMatch =
        keywords.length > 0 && keywords.some((kw) => kw.trim() !== '' && text.includes(kw.toLowerCase()));
      const evidenceMatch =
        chunk.evidence_level !== undefined &&
        (rule.match.evidence_levels ?? []).includes(chunk.evidence_level);

      if (!keywordMatch && !evidenceMatch) continue;

      risks.push(
        RiskRecord.parse({
          risk_id: riskId(source.source_id, seq),
          source_id: source.source_id,
          chunk_id: chunk.chunk_id,
          risk_type: rule.category,
          severity: rule.severity,
          action: rule.action,
          description: rule.description,
          resolved: false,
        }),
      );
      seq += 1;
    }
  }

  await writeJsonl(riskFile(root, source.source_id), risks, 'risk_id');
  return risks;
}
