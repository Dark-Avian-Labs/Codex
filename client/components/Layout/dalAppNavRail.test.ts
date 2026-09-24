import { describe, expect, it } from 'vitest';

import { buildOutsideInRailTriangles, closedRailHeight, RAIL_SIDE, RAIL_STEP } from './dalAppNavRail.js';

describe('buildOutsideInRailTriangles', () => {
  it('starts on the outer edge pointing in, then alternates', () => {
    const triangles = buildOutsideInRailTriangles(80, 1, 9, 10, 16, 41);
    expect(triangles.length).toBeGreaterThan(2);
    expect(triangles[0]?.pointsIn).toBe(true);
    expect(triangles[0]?.points.startsWith('1,')).toBe(true);
    expect(triangles[1]?.pointsIn).toBe(false);
    expect(triangles.every((triangle, index) => triangle.pointsIn === (index % 2 === 0))).toBe(true);
  });

  it('sizes a closed rail to exactly 5 triangles', () => {
    const height = closedRailHeight(5, RAIL_SIDE, RAIL_STEP);
    const atHeight = buildOutsideInRailTriangles(height, 1, 9, RAIL_SIDE, RAIL_STEP, 41);
    const shorter = buildOutsideInRailTriangles(height - 1, 1, 9, RAIL_SIDE, RAIL_STEP, 41);
    expect(atHeight).toHaveLength(5);
    expect(shorter).toHaveLength(4);
  });
});
