import type { RuntimeMetric } from './interfaces';

export type MetricName =
  | 'import.total'
  | 'import.checksum'
  | 'import.parse'
  | 'renderer.gpu-upload'
  | 'scene.update'
  | 'renderer.frame'
  | 'project.recovery'
  | 'memory.estimate';

export class RuntimeMetrics {
  private readonly records: RuntimeMetric[] = [];
  private readonly listeners = new Set<() => void>();
  private readonly limit: number;

  constructor(limit = 500) {
    this.limit = limit;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  measure<T>(name: MetricName, operation: () => T, metadata?: RuntimeMetric['metadata']): T {
    const startedAt = new Date().toISOString();
    const start = performance.now();
    try {
      return operation();
    } finally {
      this.record({ name, durationMs: performance.now() - start, startedAt, metadata });
    }
  }

  async measureAsync<T>(name: MetricName, operation: () => Promise<T>, metadata?: RuntimeMetric['metadata']): Promise<T> {
    const startedAt = new Date().toISOString();
    const start = performance.now();
    try {
      return await operation();
    } finally {
      this.record({ name, durationMs: performance.now() - start, startedAt, metadata });
    }
  }

  record(metric: RuntimeMetric): void {
    this.records.push({ ...metric, metadata: metric.metadata ? { ...metric.metadata } : undefined });
    if (this.records.length > this.limit) this.records.splice(0, this.records.length - this.limit);
    this.listeners.forEach((listener) => listener());
  }

  snapshot(): RuntimeMetric[] {
    return this.records.map((metric) => ({ ...metric, metadata: metric.metadata ? { ...metric.metadata } : undefined }));
  }

  latest(name: MetricName): RuntimeMetric | undefined {
    return [...this.records].reverse().find((metric) => metric.name === name);
  }

  summary(): Record<string, { count: number; averageMs: number; maximumMs: number }> {
    const grouped = new Map<string, number[]>();
    this.records.forEach((metric) => grouped.set(metric.name, [...(grouped.get(metric.name) ?? []), metric.durationMs]));
    return Object.fromEntries([...grouped.entries()].map(([name, values]) => [name, {
      count: values.length,
      averageMs: values.reduce((sum, value) => sum + value, 0) / values.length,
      maximumMs: Math.max(...values),
    }]));
  }

  estimateMemory(objects: Array<{ byteLength?: number; mesh?: { positions: number[]; normals: number[]; indices: number[] } }>): number {
    const bytes = objects.reduce((total, item) => {
      if (typeof item.byteLength === 'number') return total + item.byteLength;
      if (!item.mesh) return total;
      return total + (item.mesh.positions.length + item.mesh.normals.length + item.mesh.indices.length) * 4;
    }, 0);
    this.record({ name: 'memory.estimate', durationMs: 0, startedAt: new Date().toISOString(), metadata: { bytes } });
    return bytes;
  }
}

export const runtimeMetrics = new RuntimeMetrics();
