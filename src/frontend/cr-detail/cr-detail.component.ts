import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CrApiClient } from '../../integration/cr-api-client';
import { SessionService } from '../../session/session.service';
import { CrDetailView, CrTimelineItem } from '../../integration/cr-api.types';
import { idle, loading, ViewState } from '../view-state';
import { canApprovePolicy } from '../permissions';
import { CrApiError } from '../../integration/cr-api.types';

/**
 * Change Request DETAIL page: loads a CR via the API client and renders its status, totals, timeline,
 * and permission-aware Approve/Reject actions. `load` and the template skeleton are provided; the
 * permission gating and the approve/reject actions are yours.
 */
@Component({
	selector: 'app-cr-detail',
	standalone: true,
	imports: [CommonModule],
	templateUrl: './cr-detail.component.html',
})
export class CrDetailComponent implements OnInit {
	@Input() id!: string;

	state: ViewState<CrDetailView> = idle();
	submitting = false;
	actionError?: string;
	rejectReason = '';

	constructor(private readonly client: CrApiClient, private readonly session: SessionService) {}

	ngOnInit(): void {
		void this.load();
	}

	async load(): Promise<void> {
		this.state = loading();
		this.actionError = undefined;
		try {
			const detail = await this.client.get(this.session.user, this.id);
			this.state = { status: 'loaded', data: detail };
		} catch (err) {
			this.state = { status: 'error', data: null, error: this.errorMessage(err) };
		}
	}

	private errorMessage(err: unknown): string {
		return err instanceof CrApiError ? err.message : 'Something went wrong. Please try again.';
	}

	get detail(): CrDetailView | null {
		return this.state.data;
	}

	/** Approval history for display (read-only). */
	get timeline(): CrTimelineItem[] {
		return this.detail?.timeline ?? [];
	}

	onReasonInput(value: string): void {
		this.rejectReason = value;
	}

	/** Whether the current user may approve the loaded CR. */
	get canApprove(): boolean {
		return this.detail?.status === 'PENDING_APPROVAL' && canApprovePolicy(this.session.user);
	}

	get canReject(): boolean {
		return this.detail?.status === 'PENDING_APPROVAL' && canApprovePolicy(this.session.user);
	}

	async approve(): Promise<void> {
		if (!this.canApprove || this.submitting) return;

		this.submitting = true;
		this.actionError = undefined;
		try {
			const detail = await this.client.approve(this.session.user, this.id, new Date().toISOString());
			this.state = { status: 'loaded', data: detail };
		} catch (err) {
			this.actionError = this.errorMessage(err);
		} finally {
			this.submitting = false;
		}
	}

	async reject(): Promise<void> {
		if (!this.canReject || this.submitting) return;

		const reason = this.rejectReason.trim();
		if (!reason) {
			this.actionError = 'Enter a reason before rejecting this change request.';
			return;
		}

		this.submitting = true;
		this.actionError = undefined;
		try {
			const detail = await this.client.reject(this.session.user, this.id, new Date().toISOString(), reason);
			this.state = { status: 'loaded', data: detail };
			this.rejectReason = '';
		} catch (err) {
			this.actionError = this.errorMessage(err);
		} finally {
			this.submitting = false;
		}
	}
}
