import { asset } from '$app/paths';
import type { Snapshot } from './types';

let cached: Promise<Snapshot> | null = null;

/** The snapshot, fetched once and shared by every page. */
export function loadSnapshot(): Promise<Snapshot> {
	cached ??= fetch(asset('data/ae_dashboard_snapshot.json')).then((res) => {
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return res.json() as Promise<Snapshot>;
	});
	cached.catch(() => (cached = null));
	return cached;
}
