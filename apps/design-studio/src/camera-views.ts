import type { CameraState, SavedView } from './core';

export type DentalCameraPreset = 'anterior' | 'posterior' | 'buccal' | 'lingual' | 'occlusal' | 'intaglio' | 'mesial' | 'distal' | 'maxillary' | 'mandibular';

export const CAMERA_PRESETS: ReadonlyArray<{ id: DentalCameraPreset; label: string }> = [
  { id: 'anterior', label: 'Anterior' },
  { id: 'posterior', label: 'Posterior' },
  { id: 'buccal', label: 'Buccal' },
  { id: 'lingual', label: 'Lingual' },
  { id: 'occlusal', label: 'Occlusal' },
  { id: 'intaglio', label: 'Intaglio' },
  { id: 'mesial', label: 'Mesial' },
  { id: 'distal', label: 'Distal' },
  { id: 'maxillary', label: 'Maxillary' },
  { id: 'mandibular', label: 'Mandibular' },
];

const ORIENTATIONS: Record<DentalCameraPreset, Pick<CameraState, 'yaw' | 'pitch'>> = {
  anterior: { yaw: 0, pitch: 0 },
  posterior: { yaw: Math.PI, pitch: 0 },
  buccal: { yaw: Math.PI / 2, pitch: 0 },
  lingual: { yaw: -Math.PI / 2, pitch: 0 },
  occlusal: { yaw: 0, pitch: 1.45 },
  intaglio: { yaw: 0, pitch: -1.45 },
  mesial: { yaw: -Math.PI / 2, pitch: 0.35 },
  distal: { yaw: Math.PI / 2, pitch: 0.35 },
  maxillary: { yaw: 0, pitch: 1.1 },
  mandibular: { yaw: 0, pitch: -1.1 },
};

export function cameraForPreset(current: CameraState, preset: DentalCameraPreset): CameraState {
  const orientation = ORIENTATIONS[preset];
  return { ...structuredClone(current), ...orientation };
}

export function createSavedView(name: string, camera: CameraState): SavedView {
  const value = name.trim(); if (!value) throw new Error('Saved view name is required.');
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), name: value, camera: structuredClone(camera), createdAt: now, updatedAt: now };
}
