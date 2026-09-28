import registry from './beast-claw-registry.json' with { type: 'json' };

export interface BeastClawRegistryEntry {
  companionName: string;
  clawsName: string;
  uniqueName: string;
}

export const BEAST_CLAW_REGISTRY = registry as BeastClawRegistryEntry[];

const byCompanionName = new Map(
  BEAST_CLAW_REGISTRY.map((entry) => [entry.companionName.toLowerCase(), entry]),
);

export function lookupBeastClawByCompanionName(
  companionName: string,
): BeastClawRegistryEntry | null {
  return byCompanionName.get(companionName.trim().toLowerCase()) ?? null;
}
