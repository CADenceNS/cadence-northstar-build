import type { DentalArch, ToothNumberingSystem } from './restoration-types';

export type PalmerQuadrant = 'UR' | 'UL' | 'LL' | 'LR';

export interface PermanentToothDesignation {
  universal: number;
  fdi: number;
  palmer: `${PalmerQuadrant}${number}`;
  palmerQuadrant: PalmerQuadrant;
  palmerIndex: number;
  arch: DentalArch;
}

export function permanentToothDesignation(universalInput: string | number): PermanentToothDesignation {
  const universal = Number(universalInput); if (!Number.isInteger(universal) || universal < 1 || universal > 32) throw new Error('Permanent Universal tooth number must be an integer from 1 through 32.');
  let quadrant: PalmerQuadrant; let index: number; let fdiQuadrant: number;
  if (universal <= 8) { quadrant = 'UR'; index = 9 - universal; fdiQuadrant = 1; }
  else if (universal <= 16) { quadrant = 'UL'; index = universal - 8; fdiQuadrant = 2; }
  else if (universal <= 24) { quadrant = 'LL'; index = 25 - universal; fdiQuadrant = 3; }
  else { quadrant = 'LR'; index = universal - 24; fdiQuadrant = 4; }
  return { universal, fdi: fdiQuadrant * 10 + index, palmer: `${quadrant}${index}`, palmerQuadrant: quadrant, palmerIndex: index, arch: universal <= 16 ? 'MAXILLARY' : 'MANDIBULAR' };
}

export function universalFromFdi(fdiInput: string | number): number {
  const fdi = Number(fdiInput); const quadrant = Math.floor(fdi / 10); const index = fdi % 10; if (![1, 2, 3, 4].includes(quadrant) || !Number.isInteger(index) || index < 1 || index > 8) throw new Error('Permanent FDI designation must use quadrant 1–4 and tooth 1–8.');
  if (quadrant === 1) return 9 - index; if (quadrant === 2) return 8 + index; if (quadrant === 3) return 25 - index; return 24 + index;
}

export function universalFromPalmer(palmerInput: string): number {
  const match = /^(UR|UL|LL|LR)([1-8])$/i.exec(palmerInput.trim()); if (!match) throw new Error('Permanent Palmer designation must be UR, UL, LL, or LR followed by 1–8.'); const quadrant = match[1].toUpperCase() as PalmerQuadrant; const index = Number(match[2]);
  if (quadrant === 'UR') return 9 - index; if (quadrant === 'UL') return 8 + index; if (quadrant === 'LL') return 25 - index; return 24 + index;
}

export function formatPermanentTooth(universal: string | number, system: ToothNumberingSystem): string {
  const designation = permanentToothDesignation(universal); if (system === 'UNIVERSAL') return String(designation.universal); if (system === 'FDI') return String(designation.fdi); return designation.palmer;
}
