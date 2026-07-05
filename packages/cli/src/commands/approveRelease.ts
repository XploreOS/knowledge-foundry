// kf approve-release — promote a draft release to `approved`. Enforced, not
// declared: requires a clean pre-release gate, an attached EvaluationResult,
// and every required review_workflow.yaml stage's recorded sign-off quorum.

import type { Command } from 'commander';
import { approveRelease, exists, releaseManifestFile, resolveRoot } from '@knowledge-foundry/core';
import { blocked, fail, kv, line } from '../lib/output.js';
import { formatStageEvaluation, requireConfig, ws } from '../lib/context.js';

interface Options {
  domain: string;
  releaseId: string;
}

export function register(program: Command): void {
  program
    .command('approve-release')
    .description('Approve a draft release (gate + evaluation + recorded sign-offs enforced)')
    .requiredOption('--domain <id>', 'domain id')
    .requiredOption('--release-id <rid>', 'release id')
    .action(async (options: Options, command: Command) => {
      const opts = ws(command);
      const config = await requireConfig(options.domain, opts);
      const manifestPath = releaseManifestFile(resolveRoot(opts), options.domain, options.releaseId);

      if (!(await exists(manifestPath))) {
        fail(`release "${options.releaseId}" not found in domain "${options.domain}"`, [
          `build it first: kf build-release --domain ${options.domain} --release-id ${options.releaseId}`,
        ]);
      }

      const result = await approveRelease(config, {
        ...opts,
        domainId: options.domain,
        releaseId: options.releaseId,
      });

      for (const stage of result.stages) kv(`stage ${stage.stage}`, formatStageEvaluation(stage));

      if (!result.approved) {
        blocked('RELEASE APPROVAL BLOCKED', result.blockers);
      }

      line(`approved release "${result.manifest.release_id}"`);
      kv('state', result.manifest.state);
      kv('updated_at', result.manifest.updated_at);
      kv('manifest', manifestPath);
    });
}
