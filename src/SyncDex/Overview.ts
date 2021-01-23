import { SyncModule } from '../Core/SyncModule';
import { ActivableKey, ServiceKey, StaticKey } from '../Service/Keys';
import { LocalTitle, Title } from '../Core/Title';

export type OverviewKey = ActivableKey | StaticKey.SyncDex;
export abstract class Overview {
	bind?(syncModule: SyncModule): void;
	abstract reset(): void;
	abstract hasNoServices(): void;
	abstract initializeService(key: ActivableKey, hasId: boolean): void;
	abstract receivedInitialRequest(key: ActivableKey, res: Title | RequestStatus, syncModule: SyncModule): void;
	receivedAllInitialRequests?(syncModule: SyncModule): void;
	abstract syncingService(key: ServiceKey): void;
	abstract syncedService(key: ServiceKey, res: Title | RequestStatus, title: LocalTitle): void;
	abstract syncingLocal(): void;
	abstract syncedLocal(title: LocalTitle): void;
	syncedMangaDex?(type: 'unfollow' | 'status' | 'score' | 'progress', syncModule: SyncModule): void;
}
