import { assertTransition } from './cr-state-machine';
import { CrStatus } from './cr.enums';
import { BusinessError } from './errors';

/**
 * One case fails on purpose: the transition guard is too permissive. The root cause lives in
 * `assertTransition`.
 */
describe('backend state machine', () => {
	it('allows the legal DRAFT -> SUBMITTED', () => {
		expect(() => assertTransition(CrStatus.DRAFT, CrStatus.SUBMITTED)).not.toThrow();
	});

	it('rejects the illegal DRAFT -> APPROVED (approval cannot be skipped)', () => {
		expect(() => assertTransition(CrStatus.DRAFT, CrStatus.APPROVED)).toThrow(/illegal|not allowed/i);
	});

	it('rejects moving out of a terminal state', () => {
		expect(() => assertTransition(CrStatus.APPLIED, CrStatus.APPROVED)).toThrow();
	});

	it.each([
		[CrStatus.DRAFT, CrStatus.SUBMITTED],
		[CrStatus.DRAFT, CrStatus.CANCELLED],
		[CrStatus.SUBMITTED, CrStatus.PENDING_APPROVAL],
		[CrStatus.SUBMITTED, CrStatus.CANCELLED],
		[CrStatus.PENDING_APPROVAL, CrStatus.APPROVED],
		[CrStatus.PENDING_APPROVAL, CrStatus.RETURNED],
		[CrStatus.PENDING_APPROVAL, CrStatus.REJECTED],
		[CrStatus.APPROVED, CrStatus.APPLIED],
		[CrStatus.RETURNED, CrStatus.DRAFT],
	])('allows declared transition %s -> %s', (from, to) => {
		expect(() => assertTransition(from, to)).not.toThrow();
	});

	it.each([CrStatus.APPLIED, CrStatus.REJECTED, CrStatus.CANCELLED])('uses TERMINAL_STATE when moving from %s', (from) => {
		try {
			assertTransition(from, CrStatus.DRAFT);
			throw new Error('Expected transition to fail');
		} catch (err) {
			expect(err).toBeInstanceOf(BusinessError);
			expect((err as BusinessError).code).toBe('TERMINAL_STATE');
		}
	});

	it('uses ILLEGAL_TRANSITION for an undeclared non-terminal transition', () => {
		try {
			assertTransition(CrStatus.SUBMITTED, CrStatus.APPROVED);
			throw new Error('Expected transition to fail');
		} catch (err) {
			expect(err).toBeInstanceOf(BusinessError);
			expect((err as BusinessError).code).toBe('ILLEGAL_TRANSITION');
		}
	});
});
