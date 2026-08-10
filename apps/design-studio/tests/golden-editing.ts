import type { Vec3 } from '../src/core';
import type { IndexedMesh } from '../src/editing-geometry';

export function cube(origin: Vec3 = [0, 0, 0], size = 10): IndexedMesh {
  const [x, y, z] = origin; const s = size;
  const positions: Vec3[] = [[x, y, z], [x + s, y, z], [x + s, y + s, z], [x, y + s, z], [x, y, z + s], [x + s, y, z + s], [x + s, y + s, z + s], [x, y + s, z + s]];
  const faces: Array<[number, number, number]> = [
    [0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7],
    [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5],
    [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7],
  ];
  return { positions, faces };
}

export function tetra(origin: Vec3 = [0, 0, 0], size = 10): IndexedMesh {
  const [x, y, z] = origin;
  return {
    positions: [[x, y, z], [x + size, y, z], [x, y + size, z], [x, y, z + size]],
    faces: [[0, 2, 1], [0, 1, 3], [0, 3, 2], [1, 2, 3]],
  };
}

export function openTetra(): IndexedMesh { const mesh = tetra(); return { positions: mesh.positions, faces: mesh.faces.slice(0, 3) }; }

export function twoShells(): IndexedMesh {
  const first = tetra(); const second = tetra([30, 0, 0]);
  return { positions: [...first.positions, ...second.positions], faces: [...first.faces, ...second.faces.map((face) => face.map((id) => id + first.positions.length) as [number, number, number])] };
}

export function bridgableTube(): IndexedMesh {
  const positions: Vec3[] = [[-2, -2, 0], [2, -2, 0], [2, 2, 0], [-2, 2, 0], [-2, -2, 4], [2, -2, 4], [2, 2, 4], [-2, 2, 4]];
  const faces: Array<[number, number, number]> = [[0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]];
  return { positions, faces };
}

export function grid(size: number): IndexedMesh {
  const positions: Vec3[] = [];
  for (let y = 0; y <= size; y += 1) for (let x = 0; x <= size; x += 1) positions.push([x, y, Math.sin(x * 0.1) * Math.cos(y * 0.1)]);
  const faces: Array<[number, number, number]> = [];
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) { const a = y * (size + 1) + x; const b = a + 1; const c = a + size + 1; const d = c + 1; faces.push([a, b, d], [a, d, c]); }
  return { positions, faces };
}
