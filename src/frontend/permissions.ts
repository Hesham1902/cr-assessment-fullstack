import { CrActor } from '../integration/cr-api.types';

export function hasPolicy(user: CrActor, policy: string): boolean {
	return !!user && user.policies.includes(policy);
}

export function canApprovePolicy(user: CrActor): boolean {
	return ['cr_a_u', 'cr_a_w', 'cr_a_o'].some((p) => hasPolicy(user, p));
}
