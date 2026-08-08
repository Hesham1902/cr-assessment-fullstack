import { Injectable } from '@angular/core';
import { CrActor, demoActors } from '../integration/cr-api.types';

/** Holds the current signed-in user. Components read `user` to decide which actions to offer. */
@Injectable({ providedIn: 'root' })
export class SessionService {
	user: CrActor = demoActors.mona;
}
