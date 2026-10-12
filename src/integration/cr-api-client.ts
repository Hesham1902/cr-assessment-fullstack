import { Injectable } from '@angular/core';
import { ChangeRequest, ReqUser } from '../backend/cr.types';
import { CrService } from '../backend/cr-service';
import { CrRepo } from '../backend/cr-repo';
import { buildSeed } from '../backend/seed';
import { BusinessError } from '../backend/errors';
import { CrActor, CrApiError, CrDetailView, CrListItem, CrViewStatus } from './cr-api.types';

/**
 * The API/UI boundary. The Angular UI talks to this async client; the client calls the in-process
 * backend `CrService` (built over the seeded repo). This stands in for an HTTP layer — same contract,
 * no network. Business errors thrown by the service surface as rejected promises (the UI shows them).
 *
 * `latencyMs`/`failNext` let the UI exercise loading and error handling.
 */
@Injectable({ providedIn: 'root' })
export class CrApiClient {
	latencyMs = 0;
	failNext = false;
	private readonly service: CrService;

	constructor() {
		const seed = buildSeed();
		const repo = new CrRepo();
		repo.seed(seed.changeRequests);
		this.service = new CrService(repo, seed.agreements, seed.budgets);
	}

	private settle<T>(produce: () => T): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			setTimeout(() => {
				if (this.failNext) {
					this.failNext = false;
					reject(new CrApiError('NETWORK', 'Unable to reach the service. Please try again.', true));
					return;
				}
				try {
					resolve(produce());
				} catch (err) {
					reject(this.toApiError(err));
				}
			}, this.latencyMs);
		});
	}

	private toReqUser(actor: CrActor): ReqUser {
		return { id: actor.id, orgCode: actor.orgCode, policies: [...actor.policies] };
	}

	private toListItem(cr: ChangeRequest, user: ReqUser): CrListItem {
		const budget = this.service.budgetOf(user, cr);
		return {
			id: cr.id,
			title: cr.title,
			status: cr.status as CrViewStatus,
			budget: budget ? { balance: budget.balance, currency: budget.currency } : null,
		};
	}

	private toDetail(cr: ChangeRequest, user: ReqUser): CrDetailView {
		return {
			...this.toListItem(cr, user),
			totals: { ...cr.totals },
			timeline: cr.audit.map((entry) => ({ ...entry })),
		};
	}

	private toApiError(err: unknown): CrApiError {
		if (!(err instanceof BusinessError)) return new CrApiError('UNKNOWN', 'Something went wrong. Please try again.', true);

		switch (err.code) {
			case 'FORBIDDEN':
				return new CrApiError(err.code, 'You do not have permission to perform this action.', false);
			case 'NOT_FOUND':
				return new CrApiError(err.code, 'This change request is not available.', false);
			case 'ILLEGAL_TRANSITION':
			case 'TERMINAL_STATE':
				return new CrApiError(err.code, 'This action is no longer available for the current status.', false);
			case 'INSUFFICIENT_BUDGET':
				return new CrApiError(err.code, 'The available budget cannot cover this change.', false);
			case 'VALIDATION':
				return new CrApiError(err.code, err.message, false);
		}
	}

	list(actor: CrActor): Promise<CrListItem[]> {
		return this.settle(() => {
			const user = this.toReqUser(actor);
			return this.service.list(user).map((cr) => this.toListItem(cr, user));
		});
	}

	get(actor: CrActor, id: string): Promise<CrDetailView> {
		return this.settle(() => {
			const user = this.toReqUser(actor);
			return this.toDetail(this.service.get(user, id), user);
		});
	}

	approve(actor: CrActor, id: string, at: string): Promise<CrDetailView> {
		return this.settle(() => {
			const user = this.toReqUser(actor);
			return this.toDetail(this.service.approve(user, id, at), user);
		});
	}

	reject(actor: CrActor, id: string, at: string, note: string): Promise<CrDetailView> {
		return this.settle(() => {
			const user = this.toReqUser(actor);
			return this.toDetail(this.service.reject(user, id, at, note), user);
		});
	}
}
