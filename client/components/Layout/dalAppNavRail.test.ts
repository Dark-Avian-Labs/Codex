import { describe, expect, it } from 'vitest';

import { buildOutsideInRailTriangles } from './dalAppNavRail.js';

describe('buildOutsideInRailTriangles', () => {
  it('starts on the outer edge pointing in, then alternates', () => {
    const triangles = buildOutsideInRailTriangles(80, 1, 9, 10, 16, 41);
    expect(triangles.length).toBeGreaterThan(2);
    expect(triangles[0]?.pointsIn).toBe(true);
    expect(triangles[0]?.points.startsWith('1,')).toBe(true);
    expect(triangles[1]?.pointsIn).toBe(false);
    expect(triangles.every((triangle, index) => triangle.pointsIn === (index % 2 === 0))).toBe(true);
  });
});
