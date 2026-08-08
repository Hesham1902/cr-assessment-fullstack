import { CrApiClient } from './cr-api-client';
import { CrApiError, demoActors } from './cr-api.types';
import { T } from '../test-helpers';

describe('CrApiClient boundary', () => {
	it('returns a list-specific UI shape', async () => {
		const client = new CrApiClient();

		const rows = await client.list(demoActors.mona);

		expect(rows[0]).toEqual({ id: 'CR-1', title: 'Add 1 unit of SKU-A', status: 'DRAFT' });
		expect(rows[0]).not.toHaveProperty('draftChanges');
		expect(rows[0]).not.toHaveProperty('audit');
	});

	it('approves through the client and returns a coherent detail view', async () => {
		const client = new CrApiClient();

		const result = await client.approve(demoActors.mona, 'CR-2', T);

		expect(result.status).toBe('APPROVED');
		expect(result.timeline.at(-1)).toEqual({ action: 'APPROVE', byUserId: 'mona', at: T, note: undefined });
	});

	it('does not expose mutable backend references', async () => {
		const client = new CrApiClient();
		const first = await client.get(demoActors.mona, 'CR-2');
		first.title = 'Changed in the UI';
		first.timeline.push({ action: 'FAKE', byUserId: 'viewer', at: T });

		const fresh = await client.get(demoActors.mona, 'CR-2');

		expect(fresh.title).toBe('Add 1 unit of SKU-A');
		expect(fresh.timeline).toHaveLength(1);
	});

	it('translates business errors', async () => {
		const client = new CrApiClient();

		await expect(client.approve(demoActors.viewer, 'CR-2', T)).rejects.toMatchObject<Partial<CrApiError>>({
			code: 'FORBIDDEN',
			retryable: false,
		});
	});

	it('translates simulated network failures', async () => {
		const client = new CrApiClient();
		client.failNext = true;

		await expect(client.get(demoActors.mona, 'CR-2')).rejects.toMatchObject<Partial<CrApiError>>({
			code: 'NETWORK',
			retryable: true,
		});
	});
});
