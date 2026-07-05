// kf review-status — show the review-workflow stage quorum status for a
// target without recording anything. Exits non-zero when a required stage
// is unsatisfied so scripts can gate on it.

import type { Command } from 'commander';
import {
  REVIEW_TARGET_TYPES,
  evaluateReviewWorkflow,
  reviewsForTarget,
} from '@knowledge-foundry/core';
import type { ReviewTargetType } from '@knowledge-foundry/core';
import { fail, kv, line } from '../lib/output.js';
import { formatStageEvaluation, requireConfig, ws } from '../lib/context.js';

interface Options {
  domain: string;
  targetType: string;
  targetId: string;
}

export function register(program: Command): void {
  program
    .command('review-status')
    .description('Show review-workflow stage quorum status for a target')
    .requiredOption('--domain <id>', 'domain id')
    .requiredOption('--target-type <type>', `one of: ${REVIEW_TARGET_TYPES.join(', ')}`)
    .requiredOption('--target-id <id>', 'id of the reviewed artefact (e.g. a release id)')
    .action(async (options: Options, command: Command) => {
      const opts = ws(command);

      if (!(REVIEW_TARGET_TYPES as readonly string[]).includes(options.targetType)) {
        fail(`invalid --target-type "${options.targetType}"`, [
          `allowed: ${REVIEW_TARGET_TYPES.join(', ')}`,
        ]);
      }

      const config = await requireConfig(options.domain, opts);
      const targetType = options.targetType as ReviewTargetType;

      const reviews = await reviewsForTarget(options.domain, targetType, options.targetId, opts);
      const workflow = evaluateReviewWorkflow(config.review_workflow, reviews);

      line(`review workflow status for ${targetType} "${options.targetId}":`);
      kv('reviews_recorded', reviews.length);
      for (const stage of workflow.stages) kv(`stage ${stage.stage}`, formatStageEvaluation(stage));
      kv('all_required_stages_satisfied', workflow.satisfied);

      if (!workflow.satisfied) {
        fail(`review workflow is not satisfied for ${targetType} "${options.targetId}"`, workflow.blockers);
      }
    });
}
