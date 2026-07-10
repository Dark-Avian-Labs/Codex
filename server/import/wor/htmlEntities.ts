function decodeWithEntityMap(value: string, entities: Record<string, string>): string {
  const pattern = new RegExp(
    Object.keys(entities)
      .sort((left, right) => right.length - left.length)
      .map((entity) => entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|'),
    'g',
  );
  return value.replace(pattern, (entity) => entities[entity] ?? entity);
}

/** Decode HTML attribute entities from Inertia `data-page` payloads (single pass). */
export function decodeInertiaPayload(encoded: string): string {
  return decodeWithEntityMap(encoded, {
    '&quot;': '"',
    '&#039;': "'",
    '&#x27;': "'",
    '&amp;': '&',
  });
}

/** Decode HTML entities in Fastidious display names (single pass). */
export function decodeHtmlEntities(value: string): string {
  return decodeWithEntityMap(value, {
    '&#x27;': "'",
    '&#039;': "'",
    '&lt;': '<',
    '&gt;': '>',
    '&amp;': '&',
  });
}
