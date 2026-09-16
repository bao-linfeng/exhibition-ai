# T019 Remaining TODO

> Updated: 2026-09-16
> Status: Development paused. Current worktree changes are uncommitted.
> Goal: Complete and verify the official OpenAI image generation and parent-image edit path without duplicate paid calls or incorrect accounting.

## Current Boundary

- [x] Official OpenAI direct image generation was proven with `gpt-image-2.5-flare`.
- [x] OpenAI SDK retries are disabled with `maxRetries: 0`.
- [x] Parent image MIME type and extension are propagated to `images.edit`.
- [x] Migration `0012` repairs databases that skipped migrations `0005` through `0011`.
- [x] Empty, complete-old, skipped-migration, and legacy default-FK migration paths were verified.
- [x] Generation creation, quota reservation, reserve ledger, request, and Outbox are in one transaction.
- [x] Gate 1 review passed.
- [ ] Phase 2 Worker settlement code is implemented but has not received post-change typecheck, integration verification, or Oracle Gate 2 review.
- [ ] No real business API-to-queue-to-RustFS generation/edit test has been completed after the accounting changes.

## P0: Correctness Before Any Real Call

- [ ] Run post-Phase-2 engineering checks in Docker.
  - `docker compose --env-file .env -f infra/compose.dev.yaml run --rm devtools pnpm check`
  - Do not make a paid OpenAI call until this passes.

- [ ] Fix image retry tasks so they cannot call a paid Provider without a reservation.
  - `TaskRepository.createRetryTask()` currently copies the original snapshot but does not create a reserve ledger entry or reserve quota.
  - Existing or legacy image tasks with `canRetry=true` may create a retry task with no reservation.
  - Preferred minimal fix: reject generic retry for `image_generation` until retry creation can atomically reserve only the retry outputs.
  - Files: `packages/backend/src/modules/tasks/tasks.repository.ts`, `packages/backend/src/modules/tasks/tasks.service.ts`, `apps/worker/src/processors/image-generation.processor.ts`.

- [ ] Make settlement outcomes explicit instead of returning `void` for every condition.
  - `QuotaService.settleTask()` currently returns successfully when no reserve exists or a final/unknown ledger entry already exists.
  - The Worker then sets `settled = true` and may publish outputs even though no actual settlement occurred.
  - Return a result such as `settled | already_settled | unknown | missing_reserve` and only publish after a valid actual settlement.
  - Files: `packages/backend/src/modules/settings/quota.service.ts`, `apps/worker/src/processors/image-generation.processor.ts`.

- [ ] Preserve existing `ProviderError` instances in the OpenAI adapter.
  - `resolveParentImageMimeType()` can throw a known rejected `ProviderError` inside the provider `try` block.
  - The catch currently passes it to `toProviderError()`, which can reclassify it as `accepted_unknown` because it has no HTTP status.
  - Add `if (error instanceof ProviderError) return error` before HTTP error mapping.
  - File: `packages/ai/src/providers/openai/openai-image.provider.ts`.

- [ ] Verify all claimed-task pre-Provider failures safely release the reservation.
  - Include missing request, invalid snapshot, unavailable registry/model, zero outputs, parent image load failure, prompt errors, and unexpected local exceptions.
  - If release itself fails, the task must not remain silently `running`; move it to a diagnosable reconciliation state without calling the Provider.

- [ ] Verify Provider-success settlement failures cannot publish assets or cause another Provider call.
  - Task must become `reconciling`.
  - BullMQ redelivery must fail CAS claim and skip the Provider.
  - Reservation and ledger state must remain explainable.

## P0: Accounting State Machine Verification

- [ ] Add service-level or temporary integration scenarios for CAS claim.
  - Two concurrent claims produce one winner.
  - A second delivery of a `running`, `reconciling`, cancelled, or terminal task does not call the Provider.
  - A delayed Outbox relay cannot overwrite `running` or terminal status with `queued`.

- [ ] Verify successful actual settlement is exactly once.
  - Account balance decreases once.
  - Reserved amount decreases once.
  - One `settle_actual` entry is written.
  - `provider_usage` is persisted.
  - Repeating settlement does not change account or ledger state.

- [ ] Verify known rejection releases exactly once.
  - Cover local parameter rejection, HTTP 400, 401, 403, 404, content rejection, and the chosen 429 policy.
  - Account balance is unchanged.
  - Reserved amount returns to its previous value.
  - One `release` entry is written with actual fee `0`.

- [ ] Verify accepted-unknown handling.
  - Cover timeout, connection failure, HTTP 408, 409, and 5xx.
  - Reservation remains held.
  - One `settle_unknown` entry is written with the reserved risk amount.
  - Task becomes `reconciling` with `canRetry=false`.
  - Repeating unknown handling is a no-op.

- [ ] Define and implement manual reconciliation after `settle_unknown`.
  - Current `hasFinalOrUnknown()` prevents later `settle_actual` or `release` through the normal methods.
  - Add an explicit reconciliation operation that locks the reserve and unknown entry, then records exactly one final actual settlement or release.
  - Do not automatically retry the OpenAI request because Images API has no query or native idempotency endpoint.

- [ ] Verify Provider success followed by RustFS, asset, or version failure.
  - Fee remains settled because the external generation already occurred.
  - Task/output failure clearly reports publication failure.
  - No reservation release occurs.

- [ ] Verify a Worker crash after Provider response but before settlement.
  - Redelivery must not call the Provider again because the task is already `running`.
  - Existing stuck-task scanning should move the task to `reconciling`.
  - Document that manual reconciliation is required because OpenAI Images has no result query API.

## P1: Pricing Semantics

- [ ] Confirm the product accounting rule for `gpt-image-2.5-flare`.
  - Current implementation records raw OpenAI token usage but settles the configured fixed `costPerImageMinor` amount.
  - Official OpenAI billing is token-based, so the configured amount is not necessarily the exact vendor invoice amount.
  - Decide whether the ledger represents an internal fixed charge, a conservative reservation, or exact vendor cost.
  - If exact cost is required, add versioned token rates and compute actual cost from persisted usage without changing historical entries.

- [ ] Configure a positive model price before testing the real Provider.
  - Real non-mock models with `costPerImageMinor <= 0` are intentionally rejected.
  - Do not write credentials or secret values into tracked files.

- [ ] Top up only the bounded amount needed for two one-image E2E calls.
  - One root generation.
  - One parent-image edit.

## P1: Real Business E2E

- [ ] Apply migration `0012` to the normal development database.
  - `docker compose --env-file .env -f infra/compose.dev.yaml run --rm migrate`
  - Confirm migration record, `provider_usage`, account indexes, ledger uniqueness, and canonical foreign keys.

- [ ] Recreate services that consume changed environment configuration.
  - Use `up -d --force-recreate worker` when `.env` changes; `restart` alone does not reload environment variables.
  - Restart API after backend/API source changes.

- [ ] Prepare bounded test data.
  - Active OpenAI `model_configs` row matching `AI_DEFAULT_IMAGE_MODEL`.
  - Positive configured price and matching currency quota account.
  - Admin session, project, current brief revision, and design direction.

- [ ] Run one real root-image generation through the business API.
  - Receive `202` and a task ID.
  - Observe `pending -> queued -> running -> succeeded`.
  - Verify exactly one Provider call.
  - Verify one asset in RustFS, one `image_versions` root record, task outputs, actual fee, one reserve, one actual settlement, and raw usage.

- [ ] Run one real parent-image edit using the root version.
  - Verify the parent object is loaded with its real MIME type.
  - Verify `images.edit` succeeds.
  - Verify the child `image_versions.parent_version_id` points to the root version.
  - Verify the second task has its own reservation, settlement, usage, asset, and version.

- [ ] Inspect API and Worker logs after both calls.
  - No credential, Authorization header, or base64 image payload may be logged.
  - No duplicate Provider invocation, negative reservation, missing reserve, stale Outbox, or relation error.

## P1: Review And Final Gates

- [ ] Run Oracle Gate 2 review after fault-injection verification.
  - Focus: at-most-once paid execution, settlement locking, rejection/unknown boundaries, retry safety, and publication-after-settlement behavior.

- [ ] Remediate material Gate 2 findings and rerun focused scenarios.

- [ ] Run the final project checks in Docker.
  - `pnpm check`
  - `pnpm api:check` if any route or schema changes are introduced.
  - `pnpm test:integration` after all services are healthy.

- [ ] Restart affected services and inspect the last 50 log lines.
  - Required by repository instructions before marking the session complete.

## P2: Documentation And Issue Closure

- [ ] Update `docs/issues/T019.md` with verified evidence only.
  - Official model and endpoint.
  - Generate and edit results.
  - Latency, output format/size, and non-sensitive usage summary.
  - Quota/ledger evidence.
  - RustFS and version-tree evidence.
  - Failure and reconciliation semantics.

- [ ] Record official documentation URLs and access date without copying credentials or sensitive responses.

- [ ] Update `docs/issues/manifest.json` and `tasks.md` only when the issue is actually complete/merged according to repository workflow.

- [ ] Review the full diff for unrelated changes and generated artifacts.

- [ ] Commit or push only when explicitly requested.

## Resume Checklist

- [ ] Read `TODO-T019.md` and `.slim/deepwork/t019-real-provider.md`.
- [ ] Inspect `git status --short` and the complete diff before editing.
- [ ] Treat Phase 2 as unverified code, not completed behavior.
- [ ] Do not make a real OpenAI call until all P0 items and post-Phase-2 checks pass.
- [ ] Keep each real test at one output and retain `maxRetries: 0`.
