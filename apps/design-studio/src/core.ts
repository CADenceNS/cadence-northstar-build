export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];
export type ArtifactKind = 'upper' | 'lower' | 'opposing' | 'bite' | 'reference' | 'unknown';
export type ProjectionMode = 'perspective' | 'orthographic';
export type MeshFormat = 'stl' | 'obj' | 'ply';

export interface Transform {
  position: Vec3;
  rotation: Quat;
  scale: Vec3;
}

export interface MaterialState {
  color: [number, number, number, number];
  opacity: number;
  metallic: number;
  roughness: number;
}

export interface MeshData {
  positions: number[];
  normals: number[];
  indices: number[];
  bounds: { min: Vec3; max: Vec3 };
}

export interface ArtifactRecord {
  id: string;
  sourceName: string;
  sourceFormat: MeshFormat;
  checksum: string;
  importedAt: string;
  byteLength: number;
  units: 'mm' | 'cm' | 'm' | 'unknown';
  orientation: 'source' | 'normalized';
  metadata: Record<string, string | number | boolean | null>;
  history: Array<{ at: string; action: string; detail?: string }>;
  mesh: MeshData;
}

export interface SceneObject {
  id: string;
  name: string;
  type: ArtifactKind;
  artifactId: string;
  visible: boolean;
  isolated: boolean;
  transform: Transform;
  material: MaterialState;
  selected: boolean;
  metadata: Record<string, string | number | boolean | null>;
}

export interface CameraState {
  projection: ProjectionMode;
  target: Vec3;
  distance: number;
  yaw: number;
  pitch: number;
  orthographicScale: number;
}

export interface ProjectSettings {
  background: [number, number, number, number];
  gridVisible: boolean;
  units: 'mm';
}

export interface DesignProject {
  schemaVersion: 1;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  camera: CameraState;
  settings: ProjectSettings;
  scene: SceneObject[];
  artifacts: ArtifactRecord[];
}

export const DEFAULT_CAMERA: CameraState = {
  projection: 'perspective',
  target: [0, 0, 0],
  distance: 140,
  yaw: 0.45,
  pitch: 0.3,
  orthographicScale: 90,
};

export const DEFAULT_SETTINGS: ProjectSettings = {
  background: [0.035, 0.045, 0.075, 1],
  gridVisible: true,
  units: 'mm',
};

const identityTransform = (): Transform => ({ position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] });
const defaultMaterial = (): MaterialState => ({ color: [0.78, 0.82, 0.9, 1], opacity: 1, metallic: 0.05, roughness: 0.7 });

export function createProject(name = 'Untitled Project'): DesignProject {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    camera: structuredClone(DEFAULT_CAMERA),
    settings: structuredClone(DEFAULT_SETTINGS),
    scene: [],
    artifacts: [],
  };
}

export class SceneManager {
  private objects = new Map<string, SceneObject>();
  private listeners = new Set<() => void>();

  constructor(initial: SceneObject[] = []) {
    initial.forEach((object) => this.objects.set(object.id, structuredClone(object)));
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private changed(): void { this.listeners.forEach((listener) => listener()); }

  list(): SceneObject[] { return [...this.objects.values()].map((object) => structuredClone(object)); }
  get(id: string): SceneObject | undefined { const value = this.objects.get(id); return value ? structuredClone(value) : undefined; }

  addFromArtifact(artifact: ArtifactRecord, kind: ArtifactKind = inferArtifactKind(artifact.sourceName)): SceneObject {
    const object: SceneObject = {
      id: crypto.randomUUID(),
      name: artifact.sourceName,
      type: kind,
      artifactId: artifact.id,
      visible: true,
      isolated: false,
      transform: identityTransform(),
      material: defaultMaterial(),
      selected: false,
      metadata: { sourceFormat: artifact.sourceFormat, checksum: artifact.checksum },
    };
    this.objects.set(object.id, object);
    this.changed();
    return structuredClone(object);
  }

  update(id: string, patch: Partial<Omit<SceneObject, 'id' | 'artifactId'>>): void {
    const current = this.objects.get(id);
    if (!current) throw new Error(`Scene object ${id} not found`);
    this.objects.set(id, { ...current, ...structuredClone(patch) });
    this.changed();
  }

  remove(id: string): void { if (this.objects.delete(id)) this.changed(); }

  select(id: string | null, additive = false): void {
    for (const [key, object] of this.objects) {
      this.objects.set(key, { ...object, selected: key === id || (additive && object.selected) });
    }
    this.changed();
  }

  isolate(id: string | null): void {
    for (const [key, object] of this.objects) {
      this.objects.set(key, { ...object, isolated: id === key, visible: id ? id === key : true });
    }
    this.changed();
  }

  replace(objects: SceneObject[]): void {
    this.objects = new Map(objects.map((object) => [object.id, structuredClone(object)]));
    this.changed();
  }
}

export class ArtifactManager {
  private artifacts = new Map<string, ArtifactRecord>();
  constructor(initial: ArtifactRecord[] = []) { initial.forEach((artifact) => this.artifacts.set(artifact.id, structuredClone(artifact))); }
  list(): ArtifactRecord[] { return [...this.artifacts.values()].map((artifact) => structuredClone(artifact)); }
  get(id: string): ArtifactRecord | undefined { const value = this.artifacts.get(id); return value ? structuredClone(value) : undefined; }

  async importFile(file: File): Promise<ArtifactRecord> {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !['stl', 'obj', 'ply'].includes(extension)) throw new Error('Only STL, OBJ and PLY files are supported.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const format = extension as MeshFormat;
    const mesh = parseMesh(bytes, format);
    const artifact: ArtifactRecord = {
      id: crypto.randomUUID(), sourceName: file.name, sourceFormat: format,
      checksum: await sha256(bytes), importedAt: new Date().toISOString(), byteLength: bytes.byteLength,
      units: 'mm', orientation: 'source', metadata: { vertexCount: mesh.positions.length / 3, triangleCount: mesh.indices.length / 3 },
      history: [{ at: new Date().toISOString(), action: 'imported', detail: `${format.toUpperCase()} source preserved by checksum` }], mesh,
    };
    this.artifacts.set(artifact.id, artifact);
    return structuredClone(artifact);
  }

  replace(artifacts: ArtifactRecord[]): void { this.artifacts = new Map(artifacts.map((artifact) => [artifact.id, structuredClone(artifact)])); }
}

export class ProjectStore {
  private readonly projectPrefix = 'cadence.design-studio.project.';
  private readonly recentKey = 'cadence.design-studio.recent';
  private readonly recoveryKey = 'cadence.design-studio.recovery';

  save(project: DesignProject): DesignProject {
    const next = { ...structuredClone(project), updatedAt: new Date().toISOString() };
    localStorage.setItem(`${this.projectPrefix}${next.id}`, JSON.stringify(next));
    this.touchRecent(next);
    localStorage.removeItem(this.recoveryKey);
    return next;
  }

  saveAs(project: DesignProject, name: string): DesignProject {
    const now = new Date().toISOString();
    return this.save({ ...structuredClone(project), id: crypto.randomUUID(), name, createdAt: now, updatedAt: now });
  }

  open(id: string): DesignProject {
    const raw = localStorage.getItem(`${this.projectPrefix}${id}`);
    if (!raw) throw new Error('Project not found');
    return migrateProject(JSON.parse(raw) as unknown);
  }

  listRecent(): Array<Pick<DesignProject, 'id' | 'name' | 'updatedAt'>> {
    try { return JSON.parse(localStorage.getItem(this.recentKey) ?? '[]') as Array<Pick<DesignProject, 'id' | 'name' | 'updatedAt'>>; }
    catch { return []; }
  }

  autoSave(project: DesignProject): void {
    localStorage.setItem(this.recoveryKey, JSON.stringify({ ...structuredClone(project), updatedAt: new Date().toISOString() }));
  }

  recover(): DesignProject | null {
    const raw = localStorage.getItem(this.recoveryKey);
    if (!raw) return null;
    try { return migrateProject(JSON.parse(raw) as unknown); } catch { return null; }
  }

  clearRecovery(): void { localStorage.removeItem(this.recoveryKey); }

  private touchRecent(project: DesignProject): void {
    const next = [{ id: project.id, name: project.name, updatedAt: project.updatedAt }, ...this.listRecent().filter((item) => item.id !== project.id)].slice(0, 12);
    localStorage.setItem(this.recentKey, JSON.stringify(next));
  }
}

export function migrateProject(input: unknown): DesignProject {
  if (!input || typeof input !== 'object') throw new Error('Invalid project document');
  const candidate = input as Partial<DesignProject>;
  if (candidate.schemaVersion !== 1 || !candidate.id || !candidate.name) throw new Error('Unsupported project schema');
  return {
    schemaVersion: 1,
    id: candidate.id,
    name: candidate.name,
    createdAt: candidate.createdAt ?? new Date().toISOString(),
    updatedAt: candidate.updatedAt ?? new Date().toISOString(),
    camera: { ...structuredClone(DEFAULT_CAMERA), ...(candidate.camera ?? {}) },
    settings: { ...structuredClone(DEFAULT_SETTINGS), ...(candidate.settings ?? {}) },
    scene: Array.isArray(candidate.scene) ? candidate.scene : [],
    artifacts: Array.isArray(candidate.artifacts) ? candidate.artifacts : [],
  };
}

export function inferArtifactKind(name: string): ArtifactKind {
  const value = name.toLowerCase();
  if (value.includes('upper') || value.includes('maxilla')) return 'upper';
  if (value.includes('lower') || value.includes('mandible')) return 'lower';
  if (value.includes('opposing') || value.includes('antagonist')) return 'opposing';
  if (value.includes('bite') || value.includes('occlusion')) return 'bite';
  return 'unknown';
}

export function parseMesh(bytes: Uint8Array, format: MeshFormat): MeshData {
  if (format === 'stl') return parseStl(bytes);
  const text = new TextDecoder().decode(bytes);
  return format === 'obj' ? parseObj(text) : parsePly(text);
}

function parseStl(bytes: Uint8Array): MeshData {
  const binaryTriangleCount = bytes.byteLength >= 84 ? new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(80, true) : 0;
  if (84 + binaryTriangleCount * 50 === bytes.byteLength) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const positions: number[] = []; const normals: number[] = []; const indices: number[] = [];
    let offset = 84;
    for (let triangle = 0; triangle < binaryTriangleCount; triangle += 1) {
      const normal: Vec3 = [view.getFloat32(offset, true), view.getFloat32(offset + 4, true), view.getFloat32(offset + 8, true)]; offset += 12;
      for (let vertex = 0; vertex < 3; vertex += 1) {
        positions.push(view.getFloat32(offset, true), view.getFloat32(offset + 4, true), view.getFloat32(offset + 8, true));
        normals.push(...normal); indices.push(indices.length); offset += 12;
      }
      offset += 2;
    }
    return finalizeMesh(positions, normals, indices);
  }
  const text = new TextDecoder().decode(bytes);
  const positions: number[] = []; const normals: number[] = []; const indices: number[] = [];
  let normal: Vec3 = [0, 0, 1];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith('facet normal ')) normal = line.slice(13).trim().split(/\s+/).map(Number) as Vec3;
    if (line.startsWith('vertex ')) { positions.push(...line.slice(7).trim().split(/\s+/).map(Number)); normals.push(...normal); indices.push(indices.length); }
  }
  if (!positions.length) throw new Error('STL contains no triangles');
  return finalizeMesh(positions, normals, indices);
}

function parseObj(text: string): MeshData {
  const vertices: Vec3[] = []; const positions: number[] = []; const normals: number[] = []; const indices: number[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith('v ')) vertices.push(line.slice(2).trim().split(/\s+/).map(Number) as Vec3);
    if (line.startsWith('f ')) {
      const refs = line.slice(2).trim().split(/\s+/).map((token) => Number(token.split('/')[0]));
      for (let i = 1; i < refs.length - 1; i += 1) {
        const triangle = [refs[0], refs[i], refs[i + 1]].map((index) => vertices[index < 0 ? vertices.length + index : index - 1]);
        const normal = faceNormal(triangle[0], triangle[1], triangle[2]);
        triangle.forEach((vertex) => { if (!vertex) throw new Error('OBJ face references missing vertex'); positions.push(...vertex); normals.push(...normal); indices.push(indices.length); });
      }
    }
  }
  if (!positions.length) throw new Error('OBJ contains no faces');
  return finalizeMesh(positions, normals, indices);
}

function parsePly(text: string): MeshData {
  const lines = text.split(/\r?\n/); const end = lines.findIndex((line) => line.trim() === 'end_header');
  if (end < 0 || !lines[0]?.includes('ply')) throw new Error('Only ASCII PLY is supported');
  const vertexCount = Number(lines.find((line) => line.startsWith('element vertex '))?.split(' ')[2] ?? 0);
  const faceCount = Number(lines.find((line) => line.startsWith('element face '))?.split(' ')[2] ?? 0);
  const vertices: Vec3[] = lines.slice(end + 1, end + 1 + vertexCount).map((line) => line.trim().split(/\s+/).slice(0, 3).map(Number) as Vec3);
  const positions: number[] = []; const normals: number[] = []; const indices: number[] = [];
  for (const line of lines.slice(end + 1 + vertexCount, end + 1 + vertexCount + faceCount)) {
    const values = line.trim().split(/\s+/).map(Number); const refs = values.slice(1, values[0] + 1);
    for (let i = 1; i < refs.length - 1; i += 1) {
      const triangle = [vertices[refs[0]], vertices[refs[i]], vertices[refs[i + 1]]];
      const normal = faceNormal(triangle[0], triangle[1], triangle[2]);
      triangle.forEach((vertex) => { positions.push(...vertex); normals.push(...normal); indices.push(indices.length); });
    }
  }
  if (!positions.length) throw new Error('PLY contains no faces');
  return finalizeMesh(positions, normals, indices);
}

function faceNormal(a: Vec3, b: Vec3, c: Vec3): Vec3 {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx;
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

function finalizeMesh(positions: number[], normals: number[], indices: number[]): MeshData {
  const min: Vec3 = [Infinity, Infinity, Infinity]; const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) for (let axis = 0; axis < 3; axis += 1) { min[axis] = Math.min(min[axis], positions[i + axis]); max[axis] = Math.max(max[axis], positions[i + axis]); }
  return { positions, normals, indices, bounds: { min, max } };
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}
