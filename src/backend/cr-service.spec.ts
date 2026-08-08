import { CrAction, CrStatus } from './cr.enums';
import { BusinessError } from './errors';
import { buildApp, T } from '../test-helpers';

function clone<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

function expectBusinessError(action: () => unknown, code: BusinessError['code']): void {
	try {
		action();
		throw new Error('Expected action to fail');
	} catch (err) {
		expect(err).toBeInstanceOf(BusinessError);
		expect((err as BusinessError).code).toBe(code);
	}
}

describe('CrService approval actions', () => {
	it('approves a pending request and records approval, audit, and version', () => {
		const { service, users } = buildApp();

		const result = service.approve(users.mona, 'CR-2', T);

		expect(result.status).toBe(CrStatus.APPROVED);
		expect(result.version).toBe(2);
		expect(result.approvals).toEqual([{ userId: 'mona', action: CrAction.APPROVE, at: T }]);
		expect(result.audit.at(-1)).toEqual({ action: CrAction.APPROVE, byUserId: 'mona', at: T, note: undefined });
	});

	it('rejects approval by a read-only user without mutation', () => {
		const { service, users } = buildApp();
		const before = clone(service.get(users.viewer, 'CR-2'));

		expectBusinessError(() => service.approve(users.viewer, 'CR-2', T), 'FORBIDDEN');
		expect(service.get(users.viewer, 'CR-2')).toEqual(before);
	});

	it('rejects approval from DRAFT', () => {
		const { service, users } = buildApp();

		expectBusinessError(() => service.approve(users.mona, 'CR-1', T), 'ILLEGAL_TRANSITION');
	});

	it("does not expose another organization's request", () => {
		const { service, users } = buildApp();

		expectBusinessError(() => service.approve(users.bob, 'CR-2', T), 'NOT_FOUND');
	});

	it('requires a non-blank rejection reason', () => {
		const { service, users } = buildApp();
		const before = clone(service.get(users.mona, 'CR-2'));

		expectBusinessError(() => service.reject(users.mona, 'CR-2', T, '   '), 'VALIDATION');
		expect(service.get(users.mona, 'CR-2')).toEqual(before);
	});

	it('treats a repeated rejection as an idempotent no-op', () => {
		const { service, users } = buildApp();
		const rejected = service.reject(users.mona, 'CR-2', T, 'Pricing is not acceptable');
		const beforeRepeat = clone(rejected);

		const repeated = service.reject(users.mona, 'CR-2', '2026-03-05T11:00:00.000Z');

		expect(repeated).toEqual(beforeRepeat);
	});
});

describe('CrService apply', () => {
	it('applies an approved positive delta and consumes budget', () => {
		const { service, budgets, users } = buildApp();
		service.approve(users.mona, 'CR-2', T);

		const result = service.apply(users.mona, 'CR-2', T);

		expect(result.status).toBe(CrStatus.APPLIED);
		expect(result.version).toBe(3);
		expect(result.audit.at(-1)?.action).toBe(CrAction.APPLY);
		expect(budgets.get('BUD-1')).toMatchObject({ booked: 8500, balance: 9500 });
	});

	it('rejects insufficient budget without changing CR or budget', () => {
		const { service, agreements, budgets, users } = buildApp();
		const agreement = agreements.get('AGR-1');
		if (!agreement) throw new Error('Missing test agreement');
		agreements.set('AGR-1', { ...agreement, budgetId: 'BUD-LOW' });
		service.approve(users.mona, 'CR-2', T);
		const crBefore = clone(service.get(users.mona, 'CR-2'));
		const budgetBefore = clone(budgets.get('BUD-LOW'));

		expectBusinessError(() => service.apply(users.mona, 'CR-2', T), 'INSUFFICIENT_BUDGET');
		expect(service.get(users.mona, 'CR-2')).toEqual(crBefore);
		expect(budgets.get('BUD-LOW')).toEqual(budgetBefore);
	});

	it('releases budget for a negative delta', () => {
		const { service, budgets, users } = buildApp();
		const cr = service.get(users.mona, 'CR-2');
		cr.draftChanges = {
			lineItems: [
				{ sku: 'SKU-A', description: 'Widget A', quantity: 9, unitPrice: 500 },
				{ sku: 'SKU-B', description: 'Widget B', quantity: 30, unitPrice: 100 },
			],
		};
		service.approve(users.mona, 'CR-2', T);

		const result = service.apply(users.mona, 'CR-2', T);

		expect(result.totals).toEqual({ baselineTotal: 8000, newTotal: 7500, delta: -500 });
		expect(budgets.get('BUD-1')).toMatchObject({ booked: 7500, balance: 10500 });
	});

	it('requires an apply policy and an approved status', () => {
		const { service, users } = buildApp();

		expectBusinessError(() => service.apply(users.viewer, 'CR-2', T), 'FORBIDDEN');
		expectBusinessError(() => service.apply(users.mona, 'CR-2', T), 'ILLEGAL_TRANSITION');
	});

	it('rejects an agreement and budget currency mismatch without mutation', () => {
		const { service, agreements, budgets, users } = buildApp();
		const agreement = agreements.get('AGR-1');
		if (!agreement) throw new Error('Missing test agreement');
		agreements.set('AGR-1', { ...agreement, currency: 'EUR' });
		service.approve(users.mona, 'CR-2', T);
		const crBefore = clone(service.get(users.mona, 'CR-2'));
		const budgetBefore = clone(budgets.get('BUD-1'));

		expectBusinessError(() => service.apply(users.mona, 'CR-2', T), 'VALIDATION');
		expect(service.get(users.mona, 'CR-2')).toEqual(crBefore);
		expect(budgets.get('BUD-1')).toEqual(budgetBefore);
	});
});
