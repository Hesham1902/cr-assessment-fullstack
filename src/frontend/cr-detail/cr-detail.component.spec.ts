import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CrDetailComponent } from './cr-detail.component';
import { SessionService } from '../../session/session.service';
import { CrActor, demoActors } from '../../integration/cr-api.types';
import { CrApiClient } from '../../integration/cr-api-client';

const flush = (ms = 0) => new Promise((r) => setTimeout(r, ms));

async function render(
	user: CrActor,
	id: string,
	configureClient?: (client: CrApiClient) => void,
): Promise<{ fixture: ComponentFixture<CrDetailComponent>; client: CrApiClient }> {
	TestBed.configureTestingModule({
		imports: [CrDetailComponent],
		providers: [{ provide: SessionService, useValue: { user } }],
	});
	await TestBed.compileComponents();
	const client = TestBed.inject(CrApiClient);
	configureClient?.(client);
	const fixture = TestBed.createComponent(CrDetailComponent);
	fixture.componentInstance.id = id;
	fixture.detectChanges(); // ngOnInit -> load()
	await flush();
	fixture.detectChanges();
	return { fixture, client };
}

describe('CrDetailComponent', () => {
	it('loads and renders the change request title', async () => {
		const { fixture } = await render(demoActors.mona, 'CR-2'); // CR-2 is PENDING_APPROVAL
		expect(fixture.nativeElement.querySelector('.cr-detail__header h2')).not.toBeNull();
	});

	it('disables Approve for a read-only viewer on a pending CR', async () => {
		const { fixture } = await render(demoActors.viewer, 'CR-2'); // viewer: cr_r_o only
		const approveBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.cr-actions__approve');
		expect(approveBtn.disabled).toBe(true);
	});

	it('enables pending actions for an approver', async () => {
		const { fixture } = await render(demoActors.mona, 'CR-2');

		expect((fixture.nativeElement.querySelector('.cr-actions__approve') as HTMLButtonElement).disabled).toBe(false);
		expect(fixture.nativeElement.querySelector('.cr-actions__reject')).not.toBeNull();
	});

	it.each(['CR-1', 'CR-APPLIED'])('does not offer actions for non-pending request %s', async (id) => {
		const { fixture } = await render(demoActors.mona, id);

		expect((fixture.nativeElement.querySelector('.cr-actions__approve') as HTMLButtonElement).disabled).toBe(true);
		expect(fixture.nativeElement.querySelector('.cr-actions__reject')).toBeNull();
	});

	it('hides rejection controls from a read-only viewer', async () => {
		const { fixture } = await render(demoActors.viewer, 'CR-2');

		expect(fixture.nativeElement.querySelector('.cr-actions__reject')).toBeNull();
	});

	it('keeps Reject disabled until a non-blank reason is entered', async () => {
		const { fixture } = await render(demoActors.mona, 'CR-2');
		const reason: HTMLTextAreaElement = fixture.nativeElement.querySelector('.cr-actions__reason');
		const reject: HTMLButtonElement = fixture.nativeElement.querySelector('.cr-actions__reject-btn');
		expect(reject.disabled).toBe(true);

		reason.value = '   ';
		reason.dispatchEvent(new Event('input'));
		fixture.detectChanges();
		expect(reject.disabled).toBe(true);

		reason.value = 'Pricing is not acceptable';
		reason.dispatchEvent(new Event('input'));
		fixture.detectChanges();
		expect(reject.disabled).toBe(false);
	});

	it('approves through the client and renders the updated status and timeline', async () => {
		const { fixture } = await render(demoActors.mona, 'CR-2');
		const approve: HTMLButtonElement = fixture.nativeElement.querySelector('.cr-actions__approve');

		approve.click();
		fixture.detectChanges();
		expect(approve.disabled).toBe(true);
		expect(fixture.nativeElement.querySelector('[role="status"]')).not.toBeNull();
		expect(fixture.nativeElement.querySelector('.cr-detail__header')).not.toBeNull();

		await flush();
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.cr-status').textContent).toContain('APPROVED');
		expect(fixture.nativeElement.querySelector('.cr-timeline__list').textContent).toContain('APPROVE');
	});

	it('rejects with a trimmed reason and renders it in the timeline', async () => {
		const { fixture } = await render(demoActors.mona, 'CR-2');
		const reason: HTMLTextAreaElement = fixture.nativeElement.querySelector('.cr-actions__reason');
		reason.value = '  Pricing is not acceptable  ';
		reason.dispatchEvent(new Event('input'));
		fixture.detectChanges();

		(fixture.nativeElement.querySelector('.cr-actions__reject-btn') as HTMLButtonElement).click();
		await flush();
		fixture.detectChanges();

		expect(fixture.nativeElement.querySelector('.cr-status').textContent).toContain('REJECTED');
		expect(fixture.nativeElement.querySelector('.cr-timeline__list').textContent).toContain('Pricing is not acceptable');
	});

	it('keeps the loaded CR coherent while an approval is slow', async () => {
		const { fixture, client } = await render(demoActors.mona, 'CR-2');
		client.latencyMs = 20;

		(fixture.nativeElement.querySelector('.cr-actions__approve') as HTMLButtonElement).click();
		fixture.detectChanges();

		expect(fixture.nativeElement.querySelector('.cr-detail__header h2').textContent).toContain('Add 1 unit');
		expect(fixture.nativeElement.querySelector('.cr-actions__loading')).not.toBeNull();
		expect((fixture.nativeElement.querySelector('.cr-actions__approve') as HTMLButtonElement).disabled).toBe(true);

		await flush(25);
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.cr-status').textContent).toContain('APPROVED');
	});

	it('preserves the loaded CR and surfaces an action failure', async () => {
		const { fixture, client } = await render(demoActors.mona, 'CR-2');
		client.failNext = true;

		(fixture.nativeElement.querySelector('.cr-actions__approve') as HTMLButtonElement).click();
		await flush();
		fixture.detectChanges();

		expect(fixture.nativeElement.querySelector('.cr-status').textContent).toContain('PENDING_APPROVAL');
		expect(fixture.nativeElement.querySelector('.cr-actions__error').textContent).toContain('Unable to reach the service');
		expect((fixture.nativeElement.querySelector('.cr-actions__approve') as HTMLButtonElement).disabled).toBe(false);
	});

	it('shows an explicit initial-load error with Retry', async () => {
		const { fixture } = await render(demoActors.mona, 'CR-2', (client) => (client.failNext = true));

		expect(fixture.nativeElement.querySelector('.cr-detail__error')).not.toBeNull();
		expect(fixture.nativeElement.querySelector('.cr-detail__error button').textContent).toContain('Retry');
	});
});
