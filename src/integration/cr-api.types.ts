export type CrViewStatus =
	| 'DRAFT'
	| 'SUBMITTED'
	| 'PENDING_APPROVAL'
	| 'APPROVED'
	| 'APPLIED'
	| 'RETURNED'
	| 'REJECTED'
	| 'CANCELLED';

export interface CrActor {
	id: string;
	orgCode: string;
	policies: string[];
}

export interface CrListItem {
	id: string;
	title: string;
	status: CrViewStatus;
}

export interface CrTimelineItem {
	action: string;
	byUserId: string;
	at: string;
	note?: string;
}

export interface CrDetailView extends CrListItem {
	totals: { baselineTotal: number; newTotal: number; delta: number };
	timeline: CrTimelineItem[];
}

export type CrApiErrorCode =
	| 'FORBIDDEN'
	| 'NOT_FOUND'
	| 'ILLEGAL_TRANSITION'
	| 'TERMINAL_STATE'
	| 'INSUFFICIENT_BUDGET'
	| 'VALIDATION'
	| 'NETWORK'
	| 'UNKNOWN';

export class CrApiError extends Error {
	readonly name = 'CrApiError';

	constructor(
		readonly code: CrApiErrorCode,
		message: string,
		readonly retryable: boolean,
	) {
		super(message);
	}
}

export const demoActors: Record<'alice' | 'mona' | 'viewer' | 'bob', CrActor> = {
	alice: { id: 'alice', orgCode: 'org-alpha', policies: ['cr_c_u', 'cr_r_u', 'cr_u_u'] },
	mona: { id: 'mona', orgCode: 'org-alpha', policies: ['cr_r_o', 'cr_a_o', 'cr_x_o'] },
	viewer: { id: 'val', orgCode: 'org-alpha', policies: ['cr_r_o'] },
	bob: { id: 'bob', orgCode: 'org-beta', policies: ['cr_r_o', 'cr_a_o', 'cr_x_o'] },
};
