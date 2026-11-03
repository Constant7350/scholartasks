import type { PackStatus, RegionPack, StatePack } from "./schema";

export interface LoadedPacks {
  states: StatePack[];
  regions: RegionPack[];
}

/**
 * Which states a new family may pick at sign-up. "Switch on and go" is
 * just changing a pack's status: live = open to all, beta = invited schools only.
 */
export function selectableStates(packs: LoadedPacks, opts: { invited?: boolean } = {}): StatePack[] {
  const allowed: PackStatus[] = opts.invited ? ["live", "beta"] : ["live"];
  return packs.states.filter((s) => allowed.includes(s.status));
}

export function regionsForState(packs: LoadedPacks, state: string): RegionPack[] {
  return packs.regions.filter((r) => r.members.includes(state));
}
