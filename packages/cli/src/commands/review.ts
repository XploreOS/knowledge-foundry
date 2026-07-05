// kf review — record one reviewer's sign-off (or rejection) on a target
// artefact, then show the resulting review-workflow stage quorum status.

import type { Command } from 'commander';
import {
  REVIEW_DECISIONS,
  REVIEW_TARGET_TYPES,
  evaluateReviewWorkflow,
  exists,
  recordReview,
  releaseManifestFile,
  resolveRoot,
  reviewsForTarget,
  reviewsFile,
} from '@knowledge-foundry/core';
import type { ReviewDecision, ReviewTargetType } from '@knowledge-foundry/core';
import { fail, kv, line } from '../lib/output.js';
import { formatStageEvaluation, requireConfig, requireSource, ws } from '../lib/context.js';

interface Options {
  domain: string;
  targetType: string;
  targetId: string;
  role: string;
  decision: string;
  reviewer: string;
  note?: string;
}

export function register(program: Command): void {
  program
    .command('review')
    .description('Record a reviewer sign-off on a target and show stage quorum status')
    .requiredOption('--domain <id>', 'domain id')
    .requiredOption('--target-type <type>', `one of: ${REVIEW_TARGET_TYPES.join(', ')}`)
    .requiredOption('--target-id <id>', 'id of the reviewed artefact (e.g. a release id)')
    .requiredOption('--role <role>', 'reviewer role declared in domain.yaml review_roles')
    .requiredOption('--decision <d>', `one of: ${REVIEW_DECISIONS.join(', ')}`)
    .requiredOption('--reviewer <name>', 'reviewer identity (name or handle)')
    .option('--note <s>', 'free-form review note')
    .action(async (options: Options, command: Command) => {
      const opts = ws(command);

      if (!(REVIEW_TARGET_TYPES as readonly string[]).includes(options.targetType)) {
        fail(`invalid --target-type "${options.targetType}"`, [
          `allowed: ${REVIEW_TARGET_TYPES.join(', ')}`,
        ]);
      }
      if (!(REVIEW_DECISIONS as readonly string[]).includes(options.decision)) {
        fail(`invalid --decision "${options.decision}"`, [
          `allowed: ${REVIEW_DECISIONS.join(', ')}`,
        ]);
      }

      const config = await requireConfig(options.domain, opts);
      const targetType = options.targetType as ReviewTargetType;

      if (!config.domain.review_roles.includes(options.role)) {
        fail(`role "${options.role}" is not declared in domain "${options.domain}"`, [
          `declared review_roles: ${config.domain.review_roles.join(', ')}`,
        ]);
      }

      // Catch target-id typos for the two target types we can cheaply verify.
      if (targetType === 'source') {
        await requireSource(options.domain, options.targetId, opts);
      }
      if (
        targetType === 'release' &&
        !(await exists(releaseManifestFile(resolveRoot(opts), options.domain, options.targetId)))
      ) {
        fail(`release "${options.targetId}" not found in domain "${options.domain}"`, [
          `build it first: kf build-release --domain ${options.domain} --release-id ${options.targetId}`,
        ]);
      }

      const record = await recordReview(config, {
        ...opts,
        domainId: options.domain,
        targetType,
        targetId: options.targetId,
        role: options.role,
        decision: options.decision as ReviewDecision,
        reviewer: options.reviewer,
        ...(options.note !== undefined ? { note: options.note } : {}),
      });

      line(`recorded review "${record.review_id}"`);
      kv('target', `${record.target_type} ${record.target_id}`);
      kv('role', record.role);
      kv('decision', record.decision);
      kv('reviewer', record.reviewer);
      kv('reviews_file', reviewsFile(resolveRoot(opts), options.domain));

      const reviews = await reviewsForTarget(options.domain, targetType, options.targetId, opts);
      const workflow = evaluateReviewWorkflow(config.review_workflow, reviews);
      line();
      line(`review workflow status for ${targetType} "${options.targetId}":`);
      for (const stage of workflow.stages) kv(`stage ${stage.stage}`, formatStageEvaluation(stage));
      kv('all_required_stages_satisfied', workflow.satisfied);
    });
}
