export type IncarnonStatName =
  | 'baseDamage'
  | 'critChance'
  | 'statusChance'
  | 'fireRate'
  | 'multishot'
  | 'magazineSize'
  | 'reloadSpeed'
  | 'projectileSpeed'
  | 'punchThrough'
  | 'accuracy';

export interface IncarnonStatModifier {
  stat: IncarnonStatName;
  mode: 'flat' | 'percent';
  value: number;
}

export interface IncarnonPerkOption {
  name: string;
  description: string;
  notes?: string;
  imagePath?: string;
  statModifiers?: IncarnonStatModifier[];
}

export interface IncarnonEvolutionTier {
  tier: number;
  challenge?: string;
  options: IncarnonPerkOption[];
}

export interface IncarnonData {
  source: 'genesis' | 'intrinsic';
  genesisUniqueName?: string;
  wikiSlug: string;
  overview?: string;
  evolutions: IncarnonEvolutionTier[];
}
