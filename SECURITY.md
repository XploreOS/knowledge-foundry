# Security Policy

## Supported versions

Only the latest published version of each `@knowledge-foundry/*` package is
supported with security fixes.

## Reporting a vulnerability

Please **do not** open a public issue for security reports. Instead, use
GitHub private vulnerability reporting:

1. Go to <https://github.com/XploreOS/knowledge-foundry/security/advisories/new>
2. Describe the issue, affected package(s)/version(s), and a reproduction if
   you have one.

You should receive an acknowledgement within 7 days. Once a fix is available
we will publish patched packages and credit the reporter in the release notes
(unless you prefer otherwise).

## Scope notes

- The deterministic gates in `@knowledge-foundry/core` (license, citation,
  risk, review-quorum, release) are safety-critical: anything that lets
  content bypass a gate — e.g. a Red-classed source reaching ingestion, or a
  release reaching `approved` without its recorded sign-off quorum — is a
  vulnerability here even if it is not a classic memory/injection issue.
- The toolkit runs locally against files you choose; it does not run a
  network service. Vulnerabilities in how untrusted *corpus content* is
  parsed (Markdown/JSON/CSV/web adapters) are in scope.
