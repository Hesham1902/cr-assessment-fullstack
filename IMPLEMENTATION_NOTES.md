# Implementation Notes

## 1. What I changed

- **Backend:** tightened the state-machine guard so only declared transitions are accepted and terminal states remain immutable. Implemented `approve` and `apply`, including permission checks, approval and audit records, total recomputation, budget updates, and protection against partial changes. I also enforce a non-blank rejection reason at the service boundary.
- **Client boundary:** introduced UI-facing list/detail models and a `CrApiError`. `CrApiClient` now maps backend entities to fresh view objects and translates business or simulated network failures into safe messages instead of exposing backend types and exceptions.
- **Frontend:** made Approve and Reject depend on both status and permission. Both actions now go through `CrApiClient`, preserve the loaded CR during slow/failing requests, prevent duplicate submissions, show action progress and errors, and update the status/timeline after success.
- **Tests:** added state-machine tables, backend approval and budget scenarios, client-boundary coverage, permission/status combinations, rejection validation, slow and failed actions, and an approve-through-client path.

## 2. Model of the flow (UI ↔ client ↔ service)

The detail component loads a `CrDetailView` through `CrApiClient` for the current session actor. When the user approves or rejects, the component first checks its local status/permission guard, marks the action as submitting, and calls the corresponding client method. The client converts the actor to the backend request shape, calls `CrService`, then maps the updated domain entity into a new UI-facing object. The service remains authoritative: it performs organization lookup, permission checks, transition validation, audit/version updates, and persistence. A successful result replaces the component's loaded data; a translated failure is shown without discarding the previously loaded CR.

## 3. Invariants I keep

| Invariant | How / where |
|---|---|
| Only legal state changes occur | `assertTransition` checks `LEGAL_TRANSITIONS`; service actions use the guard. |
| Terminal states never change | Terminal sources produce `TERMINAL_STATE`. |
| Permissions are authoritative on the backend | `CrService` checks approve/apply policies; the UI repeats the check only to avoid offering invalid actions. |
| Organizations are isolated | `CrRepo.findOne/list` scope records by the caller's `orgCode`. |
| Budget is never overspent | `apply` recomputes the delta and validates the complete budget update before committing it. |
| Failed Apply is atomic | CR and budget objects are mutated only after transition, agreement, currency, and balance checks pass. |
| Successful state changes are traceable | The transition helper appends audit data and increments the version once. Approval also appends an approval record. |
| UI data stays coherent | A submitting action keeps the loaded DTO visible; failure only updates `actionError`; duplicate actions are blocked. |
| UI does not receive backend entities | `CrApiClient` returns list/detail DTOs created by mapping functions. |

## 4. Testing strategy

- State-machine tests cover every declared transition, illegal non-terminal transitions, and all terminal states.
- Service tests cover authorized and forbidden approval, wrong-state and cross-org calls, approval/audit/version data, required rejection reasons, repeated rejection, successful positive-delta Apply, negative-delta budget release, insufficient budget atomicity, permission/status failures, and currency mismatch.
- Client tests prove the UI-specific response shapes, approve through the real client/service/repo stack, error translation, simulated network failure, and isolation from mutable backend references.
- Angular TestBed tests assert rendered DOM behavior for permission × status combinations, rejection validation, successful actions, progress state, duplicate prevention, retained data after failure, and the initial load error/Retry state.

## 5. Assumptions and tradeoffs

- The scaffold has no workspace model, so any `cr_a_u`, `cr_a_w`, or `cr_a_o` grants approval capability for CRs already visible through organization scoping. The service remains the final authority.
- A negative total delta releases budget symmetrically (`booked += delta`, `balance -= delta`). An update that would make a budget value negative is rejected as invalid data.
- Apply updates the CR and budget but does not mutate the live Purchase Agreement. The brief explicitly requires total recomputation, budget handling, terminal status, and audit; agreement persistence would need clearer requirements and additional transaction design.
- Repeating Reject on an already rejected CR keeps the provided idempotent behavior: it returns the existing entity without a new audit/version. Other illegal or terminal transitions fail explicitly.
- Apply is backend-only because the requested reviewer UI contains Approve and Reject, not Apply.
- This in-memory exercise has no concurrent writes. In a real service I would use a database transaction and optimistic locking based on the CR version.

## 6. Where I used AI

I used AI to help analyze the assessment, identify edge cases, propose test scenarios, and review implementation structure. I validated the suggestions against the supplied brief and code, ran all tests and quality checks, and reviewed the final behavior. I can explain and modify each part of the submission.

## 7. What I'd improve with more time

- Add a real HTTP adapter and contract tests while keeping the same UI-facing client interface.
- Persist CR, agreement, budget, and audit updates in one database transaction with optimistic concurrency.
- Add an injected clock so action timestamps are deterministic without relying on assertions that ignore the exact current time.
- Add richer accessible feedback for why an action is unavailable and format monetary values using the agreement currency.
