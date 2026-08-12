import type {
  CrownMaterialId,
  CrownMaterialProfile,
  CrownParameters,
  MorphologyDefinition,
  MorphologyFeaturePoint,
  MorphologyGroove,
  ToothMorphologyClass,
} from './restoration-types';

/*
 * CADence-owned procedural morphology.  These normalized parametric definitions
 * are authored for this repository and do not contain, trace, or derive from a
 * commercial tooth mesh.  All geometry is evaluated analytically at runtime.
 */

const feature = (id: string, x: number, y: number, height: number, width: number, functional = false): MorphologyFeaturePoint =>
  ({ id, position: [x, y], height, width, functional });
const groove = (id: string, x1: number, y1: number, x2: number, y2: number, depth: number, width: number): MorphologyGroove =>
  ({ id, start: [x1, y1], end: [x2, y2], depth, width });

interface DefinitionInput extends Omit<MorphologyDefinition, 'version' | 'facialContour' | 'lingualContour' | 'mesialContour' | 'distalContour' | 'cervicalContour' | 'incisalAnatomy' | 'marginalRidges' | 'triangularRidges' | 'transverseRidges' | 'obliqueRidge' | 'centralGroove' | 'supplementalGrooves' | 'fossae' | 'pits' | 'occlusalTable' | 'contactZones' | 'embrasures' | 'lineAngles' | 'developmentalLobes' | 'mamelonCount' | 'wear' | 'roundness' | 'angularity' | 'anatomyIntensity'> {
  anterior?: boolean;
  defaults?: Partial<Pick<MorphologyDefinition, 'facialContour' | 'lingualContour' | 'mesialContour' | 'distalContour' | 'cervicalContour' | 'incisalAnatomy' | 'marginalRidges' | 'triangularRidges' | 'transverseRidges' | 'obliqueRidge' | 'centralGroove' | 'occlusalTable' | 'embrasures' | 'lineAngles' | 'developmentalLobes' | 'mamelonCount' | 'wear' | 'roundness' | 'angularity' | 'anatomyIntensity'>>;
  supplementalGrooves?: MorphologyGroove[];
  fossae?: MorphologyFeaturePoint[];
  pits?: MorphologyFeaturePoint[];
  contactZones?: { mesial: [number, number]; distal: [number, number] };
}

function definition(input: DefinitionInput): MorphologyDefinition {
  const anterior = input.anterior ?? false;
  return {
    id: input.id,
    version: '1.0.0',
    label: input.label,
    toothNumbers: input.toothNumbers,
    crownDimensionsMm: input.crownDimensionsMm,
    facialContour: input.defaults?.facialContour ?? 0.58,
    lingualContour: input.defaults?.lingualContour ?? 0.46,
    mesialContour: input.defaults?.mesialContour ?? 0.5,
    distalContour: input.defaults?.distalContour ?? 0.53,
    cervicalContour: input.defaults?.cervicalContour ?? 0.42,
    incisalAnatomy: input.defaults?.incisalAnatomy ?? (anterior ? 0.72 : 0.12),
    cusps: input.cusps,
    marginalRidges: input.defaults?.marginalRidges ?? 0.62,
    triangularRidges: input.defaults?.triangularRidges ?? (anterior ? 0.2 : 0.57),
    transverseRidges: input.defaults?.transverseRidges ?? (anterior ? 0.12 : 0.43),
    obliqueRidge: input.defaults?.obliqueRidge ?? 0,
    centralGroove: input.defaults?.centralGroove ?? (anterior ? 0.08 : 0.65),
    developmentalGrooves: input.developmentalGrooves,
    supplementalGrooves: input.supplementalGrooves ?? [],
    fossae: input.fossae ?? [],
    pits: input.pits ?? [],
    occlusalTable: input.defaults?.occlusalTable ?? (anterior ? 0.24 : 0.68),
    contactZones: input.contactZones ?? { mesial: [-0.86, 0.18], distal: [0.86, 0.12] },
    embrasures: input.defaults?.embrasures ?? 0.46,
    lineAngles: input.defaults?.lineAngles ?? 0.55,
    developmentalLobes: input.defaults?.developmentalLobes ?? (anterior ? 0.62 : 0.3),
    mamelonCount: input.defaults?.mamelonCount ?? (anterior ? 3 : 0),
    wear: input.defaults?.wear ?? 0.08,
    roundness: input.defaults?.roundness ?? 0.56,
    angularity: input.defaults?.angularity ?? 0.44,
    anatomyIntensity: input.defaults?.anatomyIntensity ?? 0.72,
  };
}

export const MORPHOLOGY_DEFINITIONS: Readonly<Record<ToothMorphologyClass, MorphologyDefinition>> = Object.freeze({
  'maxillary-central-incisor': definition({
    id: 'maxillary-central-incisor', label: 'Maxillary central incisor', toothNumbers: [8, 9], anterior: true,
    crownDimensionsMm: { mesiodistal: 8.6, buccolingual: 7.2, height: 10.5 },
    cusps: [feature('mesial-lobe', -0.48, -0.08, 0.26, 0.34), feature('central-lobe', 0, -0.12, 0.3, 0.36), feature('distal-lobe', 0.48, -0.05, 0.23, 0.36)],
    developmentalGrooves: [groove('mesiolabial', -0.25, -0.72, -0.2, 0.5, 0.12, 0.13), groove('distolabial', 0.25, -0.72, 0.2, 0.5, 0.1, 0.13)],
    fossae: [feature('lingual-fossa', 0.04, 0.24, -0.24, 0.5)], pits: [feature('lingual-pit', 0.05, 0.38, -0.1, 0.16)],
    defaults: { facialContour: 0.6, lingualContour: 0.42, lineAngles: 0.7, angularity: 0.58 },
  }),
  'maxillary-lateral-incisor': definition({
    id: 'maxillary-lateral-incisor', label: 'Maxillary lateral incisor', toothNumbers: [7, 10], anterior: true,
    crownDimensionsMm: { mesiodistal: 6.6, buccolingual: 6.1, height: 9.2 },
    cusps: [feature('mesial-lobe', -0.43, -0.08, 0.2, 0.36), feature('central-lobe', 0, -0.12, 0.25, 0.38), feature('distal-lobe', 0.43, -0.02, 0.18, 0.38)],
    developmentalGrooves: [groove('mesiolabial', -0.22, -0.7, -0.18, 0.45, 0.1, 0.14), groove('distolabial', 0.23, -0.68, 0.18, 0.45, 0.12, 0.14)],
    fossae: [feature('lingual-fossa', 0, 0.3, -0.3, 0.46)], pits: [feature('lingual-pit', 0, 0.45, -0.15, 0.14)],
    defaults: { facialContour: 0.62, lingualContour: 0.5, roundness: 0.7, angularity: 0.28 },
  }),
  'mandibular-incisor': definition({
    id: 'mandibular-incisor', label: 'Mandibular incisor', toothNumbers: [23, 24, 25, 26], anterior: true,
    crownDimensionsMm: { mesiodistal: 5.4, buccolingual: 5.8, height: 9.0 },
    cusps: [feature('mesial-lobe', -0.42, -0.05, 0.14, 0.38), feature('central-lobe', 0, -0.08, 0.17, 0.4), feature('distal-lobe', 0.42, -0.04, 0.13, 0.38)],
    developmentalGrooves: [groove('mesial-developmental', -0.22, -0.68, -0.16, 0.42, 0.06, 0.12), groove('distal-developmental', 0.22, -0.68, 0.16, 0.42, 0.06, 0.12)],
    fossae: [feature('lingual-fossa', 0, 0.24, -0.14, 0.46)],
    defaults: { anatomyIntensity: 0.46, facialContour: 0.42, lingualContour: 0.32, angularity: 0.52 },
  }),
  'maxillary-canine': definition({
    id: 'maxillary-canine', label: 'Maxillary canine', toothNumbers: [6, 11], anterior: true,
    crownDimensionsMm: { mesiodistal: 7.6, buccolingual: 8.0, height: 10.6 },
    cusps: [feature('canine-cusp', 0, -0.04, 1, 0.44, true), feature('labial-ridge', 0, -0.38, 0.32, 0.28)],
    developmentalGrooves: [groove('mesial-labial', -0.24, -0.72, -0.18, 0.46, 0.1, 0.14), groove('distal-labial', 0.25, -0.7, 0.2, 0.46, 0.1, 0.14)],
    fossae: [feature('mesio-lingual-fossa', -0.28, 0.25, -0.2, 0.32), feature('disto-lingual-fossa', 0.3, 0.25, -0.22, 0.34)],
    defaults: { incisalAnatomy: 0.88, lingualContour: 0.62, developmentalLobes: 0.72, mamelonCount: 0 },
  }),
  'mandibular-canine': definition({
    id: 'mandibular-canine', label: 'Mandibular canine', toothNumbers: [22, 27], anterior: true,
    crownDimensionsMm: { mesiodistal: 6.8, buccolingual: 7.0, height: 10.3 },
    cusps: [feature('canine-cusp', -0.04, -0.02, 0.9, 0.46, true), feature('labial-ridge', 0, -0.38, 0.24, 0.3)],
    developmentalGrooves: [groove('mesial-labial', -0.23, -0.7, -0.17, 0.45, 0.07, 0.13), groove('distal-labial', 0.24, -0.68, 0.19, 0.44, 0.08, 0.13)],
    fossae: [feature('lingual-fossa', 0.05, 0.26, -0.16, 0.42)],
    defaults: { incisalAnatomy: 0.82, anatomyIntensity: 0.58, mamelonCount: 0 },
  }),
  'maxillary-first-premolar': definition({
    id: 'maxillary-first-premolar', label: 'Maxillary first premolar', toothNumbers: [5, 12],
    crownDimensionsMm: { mesiodistal: 7.2, buccolingual: 9.2, height: 8.6 },
    cusps: [feature('buccal-cusp', 0, -0.46, 1, 0.38, true), feature('lingual-cusp', 0.04, 0.44, 0.72, 0.4)],
    developmentalGrooves: [groove('central-groove', -0.62, 0, 0.62, 0, 0.36, 0.12), groove('mesial-groove', -0.58, 0, -0.82, 0.12, 0.22, 0.11), groove('distal-groove', 0.58, 0, 0.82, 0.1, 0.18, 0.11)],
    fossae: [feature('mesial-fossa', -0.48, 0, -0.3, 0.22), feature('distal-fossa', 0.48, 0, -0.28, 0.22)], pits: [feature('mesial-pit', -0.48, 0, -0.22, 0.12), feature('distal-pit', 0.48, 0, -0.2, 0.12)],
    defaults: { transverseRidges: 0.68, angularity: 0.58, occlusalTable: 0.64 },
  }),
  'maxillary-second-premolar': definition({
    id: 'maxillary-second-premolar', label: 'Maxillary second premolar', toothNumbers: [4, 13],
    crownDimensionsMm: { mesiodistal: 6.8, buccolingual: 9.0, height: 8.2 },
    cusps: [feature('buccal-cusp', 0, -0.43, 0.86, 0.41, true), feature('lingual-cusp', 0.02, 0.42, 0.78, 0.42)],
    developmentalGrooves: [groove('central-groove', -0.56, 0, 0.56, 0, 0.3, 0.13)], supplementalGrooves: [groove('mesial-supplemental', -0.3, 0.02, -0.55, 0.3, 0.13, 0.1), groove('distal-supplemental', 0.3, -0.02, 0.56, -0.28, 0.13, 0.1)],
    fossae: [feature('mesial-fossa', -0.42, 0, -0.25, 0.23), feature('distal-fossa', 0.42, 0, -0.25, 0.23)], pits: [feature('mesial-pit', -0.42, 0, -0.17, 0.11), feature('distal-pit', 0.42, 0, -0.17, 0.11)],
    defaults: { roundness: 0.64, anatomyIntensity: 0.62 },
  }),
  'mandibular-premolar': definition({
    id: 'mandibular-premolar', label: 'Mandibular premolar', toothNumbers: [20, 21, 28, 29],
    crownDimensionsMm: { mesiodistal: 7.0, buccolingual: 7.8, height: 8.3 },
    cusps: [feature('buccal-cusp', 0, -0.42, 0.95, 0.4, true), feature('lingual-cusp', 0.06, 0.4, 0.45, 0.36)],
    developmentalGrooves: [groove('central-groove', -0.52, -0.02, 0.54, 0.04, 0.25, 0.13), groove('lingual-groove', 0.08, 0.15, 0.12, 0.64, 0.18, 0.11)],
    fossae: [feature('central-fossa', 0.02, 0.05, -0.28, 0.25)], pits: [feature('central-pit', 0.02, 0.06, -0.2, 0.11)],
    defaults: { triangularRidges: 0.7, transverseRidges: 0.66, occlusalTable: 0.55 },
  }),
  'maxillary-first-molar': definition({
    id: 'maxillary-first-molar', label: 'Maxillary first molar', toothNumbers: [3, 14],
    crownDimensionsMm: { mesiodistal: 10.4, buccolingual: 11.5, height: 7.6 },
    cusps: [feature('mesiolingual', -0.36, 0.38, 1, 0.33, true), feature('mesiobuccal', -0.38, -0.38, 0.84, 0.32), feature('distobuccal', 0.38, -0.36, 0.72, 0.31), feature('distolingual', 0.39, 0.35, 0.62, 0.3, true)],
    developmentalGrooves: [groove('central-groove', -0.62, -0.03, 0.55, 0.02, 0.36, 0.11), groove('buccal-groove', 0, -0.05, 0.04, -0.78, 0.28, 0.1), groove('distolingual-groove', 0.25, 0.12, 0.62, 0.62, 0.25, 0.1)],
    supplementalGrooves: [groove('mesial-triangular', -0.28, 0.12, -0.58, 0.35, 0.12, 0.09)],
    fossae: [feature('central-fossa', 0.05, 0.02, -0.38, 0.25), feature('distal-fossa', 0.42, 0.18, -0.24, 0.2)], pits: [feature('central-pit', 0.04, 0.02, -0.24, 0.1), feature('distal-pit', 0.43, 0.16, -0.17, 0.09)],
    defaults: { obliqueRidge: 0.72, occlusalTable: 0.74, lineAngles: 0.62 },
  }),
  'maxillary-posterior-molar': definition({
    id: 'maxillary-posterior-molar', label: 'Maxillary posterior molar', toothNumbers: [1, 2, 15, 16],
    crownDimensionsMm: { mesiodistal: 9.6, buccolingual: 11.0, height: 7.2 },
    cusps: [feature('mesiolingual', -0.36, 0.36, 0.9, 0.34, true), feature('mesiobuccal', -0.38, -0.37, 0.78, 0.33), feature('distobuccal', 0.37, -0.34, 0.66, 0.32), feature('distolingual', 0.35, 0.32, 0.48, 0.31, true)],
    developmentalGrooves: [groove('central-groove', -0.58, -0.02, 0.5, 0.03, 0.33, 0.12), groove('buccal-groove', -0.02, -0.02, 0.02, -0.75, 0.24, 0.11), groove('distolingual-groove', 0.24, 0.12, 0.58, 0.58, 0.22, 0.1)],
    fossae: [feature('central-fossa', 0.03, 0.02, -0.34, 0.26), feature('distal-fossa', 0.38, 0.16, -0.2, 0.2)], pits: [feature('central-pit', 0.02, 0.02, -0.2, 0.1)],
    defaults: { obliqueRidge: 0.64, roundness: 0.62, occlusalTable: 0.7 },
  }),
  'mandibular-first-molar': definition({
    id: 'mandibular-first-molar', label: 'Mandibular first molar', toothNumbers: [19, 30],
    crownDimensionsMm: { mesiodistal: 11.2, buccolingual: 10.3, height: 7.5 },
    cusps: [feature('mesiobuccal', -0.42, -0.36, 0.9, 0.31, true), feature('distobuccal', 0.12, -0.38, 0.78, 0.3, true), feature('distal', 0.58, -0.2, 0.55, 0.28), feature('mesiolingual', -0.38, 0.38, 0.8, 0.31), feature('distolingual', 0.28, 0.37, 0.67, 0.31)],
    developmentalGrooves: [groove('central-groove', -0.65, 0, 0.62, 0, 0.38, 0.11), groove('mesiobuccal-groove', -0.2, -0.02, -0.3, -0.75, 0.28, 0.1), groove('distobuccal-groove', 0.3, 0, 0.42, -0.67, 0.25, 0.1), groove('lingual-groove', -0.02, 0.02, 0, 0.75, 0.23, 0.1)],
    fossae: [feature('central-fossa', 0, 0, -0.4, 0.27), feature('mesial-fossa', -0.48, 0, -0.23, 0.19), feature('distal-fossa', 0.48, 0, -0.23, 0.19)], pits: [feature('central-pit', 0, 0, -0.25, 0.1)],
    defaults: { occlusalTable: 0.76, angularity: 0.58, marginalRidges: 0.68 },
  }),
  'mandibular-posterior-molar': definition({
    id: 'mandibular-posterior-molar', label: 'Mandibular posterior molar', toothNumbers: [17, 18, 31, 32],
    crownDimensionsMm: { mesiodistal: 10.5, buccolingual: 9.8, height: 7.1 },
    cusps: [feature('mesiobuccal', -0.35, -0.36, 0.82, 0.33, true), feature('distobuccal', 0.36, -0.35, 0.7, 0.32, true), feature('mesiolingual', -0.34, 0.36, 0.73, 0.32), feature('distolingual', 0.35, 0.35, 0.62, 0.32)],
    developmentalGrooves: [groove('central-groove', -0.6, 0, 0.6, 0, 0.35, 0.12), groove('buccal-groove', 0, 0, 0, -0.75, 0.25, 0.1), groove('lingual-groove', 0, 0, 0, 0.73, 0.22, 0.1)],
    supplementalGrooves: [groove('cross-groove', -0.3, -0.28, 0.3, 0.28, 0.12, 0.09)],
    fossae: [feature('central-fossa', 0, 0, -0.36, 0.27), feature('mesial-fossa', -0.45, 0, -0.2, 0.2), feature('distal-fossa', 0.45, 0, -0.2, 0.2)], pits: [feature('central-pit', 0, 0, -0.22, 0.1)],
    defaults: { occlusalTable: 0.72, roundness: 0.6 },
  }),
});

export const CROWN_MATERIAL_PROFILES: Readonly<Record<CrownMaterialId, CrownMaterialProfile>> = Object.freeze({
  'zirconia-monolithic': {
    id: 'zirconia-monolithic', version: '1.0.0', label: 'Monolithic zirconia',
    minimumThicknessMm: { global: 0.6, margin: 0.35, axial: 0.6, occlusal: 1.0, incisal: 1.0, cusp: 1.0, fossa: 0.8 },
    cementGapMm: { minimum: 0.02, maximum: 0.2, default: 0.06 }, marginalGapMm: { minimum: 0.01, maximum: 0.12, default: 0.03 },
    contactDistanceMm: { minimum: -0.05, maximum: 0.15, target: 0.02 }, occlusalClearanceMm: { minimum: -0.03, maximum: 0.2, target: 0.03 },
    manufacturingCompensationPercent: { minimum: -0.5, maximum: 1.5, default: 0.2 }, maximumSharpProjectionDegrees: 58,
  },
  'lithium-disilicate': {
    id: 'lithium-disilicate', version: '1.0.0', label: 'Lithium disilicate',
    minimumThicknessMm: { global: 0.8, margin: 0.4, axial: 0.8, occlusal: 1.5, incisal: 1.5, cusp: 1.5, fossa: 1.2 },
    cementGapMm: { minimum: 0.03, maximum: 0.2, default: 0.07 }, marginalGapMm: { minimum: 0.015, maximum: 0.12, default: 0.04 },
    contactDistanceMm: { minimum: -0.04, maximum: 0.15, target: 0.025 }, occlusalClearanceMm: { minimum: -0.02, maximum: 0.22, target: 0.04 },
    manufacturingCompensationPercent: { minimum: -0.4, maximum: 1.2, default: 0.15 }, maximumSharpProjectionDegrees: 52,
  },
  'hybrid-ceramic': {
    id: 'hybrid-ceramic', version: '1.0.0', label: 'Hybrid ceramic',
    minimumThicknessMm: { global: 0.8, margin: 0.45, axial: 0.8, occlusal: 1.2, incisal: 1.2, cusp: 1.25, fossa: 1.0 },
    cementGapMm: { minimum: 0.03, maximum: 0.22, default: 0.08 }, marginalGapMm: { minimum: 0.02, maximum: 0.14, default: 0.045 },
    contactDistanceMm: { minimum: -0.04, maximum: 0.18, target: 0.03 }, occlusalClearanceMm: { minimum: -0.02, maximum: 0.25, target: 0.05 },
    manufacturingCompensationPercent: { minimum: -0.5, maximum: 1.5, default: 0.1 }, maximumSharpProjectionDegrees: 50,
  },
});

export function morphologyForTooth(toothNumber: string | number): MorphologyDefinition {
  const number = Number(toothNumber);
  if (!Number.isInteger(number) || number < 1 || number > 32) throw new Error('Permanent Universal tooth number must be an integer from 1 through 32.');
  const match = Object.values(MORPHOLOGY_DEFINITIONS).find((candidate) => candidate.toothNumbers.includes(number));
  if (!match) throw new Error(`No governed morphology is registered for tooth ${number}.`);
  return structuredClone(match);
}

export function defaultCrownParameters(toothNumber: string | number, materialId: CrownMaterialId = 'zirconia-monolithic'): CrownParameters {
  const morphology = morphologyForTooth(toothNumber);
  const material = CROWN_MATERIAL_PROFILES[materialId];
  return {
    morphologyId: morphology.id,
    mesiodistalScale: 1,
    buccolingualScale: 1,
    heightScale: 1,
    facialContour: morphology.facialContour,
    lingualContour: morphology.lingualContour,
    mesialContour: morphology.mesialContour,
    distalContour: morphology.distalContour,
    cervicalContour: morphology.cervicalContour,
    cuspHeight: 1,
    cuspInclination: 1,
    ridgeIntensity: 1,
    grooveDepth: 1,
    occlusalTableScale: 1,
    embrasureScale: 1,
    contactZoneScale: 1,
    lineAngleIntensity: 1,
    lobeIntensity: 1,
    mamelonIntensity: 1,
    wear: morphology.wear,
    roundness: morphology.roundness,
    angularity: morphology.angularity,
    anatomyIntensity: morphology.anatomyIntensity,
    marginalGapMm: material.marginalGapMm.default,
    cementGapMm: material.cementGapMm.default,
    spacerStartMm: 0.6,
    axialSpacerMm: material.cementGapMm.default,
    occlusalSpacerMm: Math.min(material.cementGapMm.maximum, material.cementGapMm.default + 0.03),
    localReliefMm: 0,
    internalRadiusMm: 0.4,
    manufacturingCompensationPercent: material.manufacturingCompensationPercent.default,
    targetMesialContactMm: material.contactDistanceMm.target,
    targetDistalContactMm: material.contactDistanceMm.target,
    targetOcclusalClearanceMm: material.occlusalClearanceMm.target,
    radialSegments: 48,
    surfaceRings: 12,
  };
}

export function validateCrownParameters(parameters: CrownParameters, materialId: CrownMaterialId): string[] {
  const material = CROWN_MATERIAL_PROFILES[materialId];
  const errors: string[] = [];
  if (!MORPHOLOGY_DEFINITIONS[parameters.morphologyId]) errors.push('Selected morphology is not registered.');
  for (const [name, value] of Object.entries(parameters)) if (typeof value === 'number' && !Number.isFinite(value)) errors.push(`${name} must be finite.`);
  if (parameters.radialSegments < 24 || parameters.radialSegments > 192 || !Number.isInteger(parameters.radialSegments)) errors.push('Radial segments must be an integer from 24 through 192.');
  if (parameters.surfaceRings < 6 || parameters.surfaceRings > 64 || !Number.isInteger(parameters.surfaceRings)) errors.push('Surface rings must be an integer from 6 through 64.');
  if (parameters.marginalGapMm < material.marginalGapMm.minimum || parameters.marginalGapMm > material.marginalGapMm.maximum) errors.push(`Marginal gap must be ${material.marginalGapMm.minimum}–${material.marginalGapMm.maximum} mm for ${material.label}.`);
  for (const [name, value] of [['cementGapMm', parameters.cementGapMm], ['axialSpacerMm', parameters.axialSpacerMm], ['occlusalSpacerMm', parameters.occlusalSpacerMm]] as const) if (value < material.cementGapMm.minimum || value > material.cementGapMm.maximum) errors.push(`${name} must be ${material.cementGapMm.minimum}–${material.cementGapMm.maximum} mm for ${material.label}.`);
  if (parameters.manufacturingCompensationPercent < material.manufacturingCompensationPercent.minimum || parameters.manufacturingCompensationPercent > material.manufacturingCompensationPercent.maximum) errors.push('Manufacturing compensation falls outside the governed material profile.');
  if (parameters.mesiodistalScale < 0.7 || parameters.mesiodistalScale > 1.3 || parameters.buccolingualScale < 0.7 || parameters.buccolingualScale > 1.3 || parameters.heightScale < 0.7 || parameters.heightScale > 1.3) errors.push('Global morphology scales must remain between 0.7 and 1.3.');
  const bounded: Array<[string, number, number, number]> = [
    ['facialContour', parameters.facialContour, 0, 2], ['lingualContour', parameters.lingualContour, 0, 2], ['mesialContour', parameters.mesialContour, 0, 2], ['distalContour', parameters.distalContour, 0, 2], ['cervicalContour', parameters.cervicalContour, 0, 2],
    ['cuspHeight', parameters.cuspHeight, 0, 2], ['cuspInclination', parameters.cuspInclination, 0, 2], ['ridgeIntensity', parameters.ridgeIntensity, 0, 2], ['grooveDepth', parameters.grooveDepth, 0, 2], ['occlusalTableScale', parameters.occlusalTableScale, 0.6, 1.4],
    ['embrasureScale', parameters.embrasureScale, 0, 2], ['contactZoneScale', parameters.contactZoneScale, 0, 2], ['lineAngleIntensity', parameters.lineAngleIntensity, 0, 2], ['lobeIntensity', parameters.lobeIntensity, 0, 2], ['mamelonIntensity', parameters.mamelonIntensity, 0, 2],
    ['wear', parameters.wear, 0, 1], ['roundness', parameters.roundness, 0, 1], ['angularity', parameters.angularity, 0, 1], ['anatomyIntensity', parameters.anatomyIntensity, 0, 2], ['spacerStartMm', parameters.spacerStartMm, 0, 5], ['localReliefMm', parameters.localReliefMm, 0, 0.3], ['internalRadiusMm', parameters.internalRadiusMm, 0.1, 2],
  ];
  for (const [name, value, minimum, maximum] of bounded) if (value < minimum || value > maximum) errors.push(`${name} must remain between ${minimum} and ${maximum}.`);
  if (parameters.targetMesialContactMm < material.contactDistanceMm.minimum || parameters.targetMesialContactMm > material.contactDistanceMm.maximum || parameters.targetDistalContactMm < material.contactDistanceMm.minimum || parameters.targetDistalContactMm > material.contactDistanceMm.maximum) errors.push('Target proximal contacts fall outside the governed material range.');
  if (parameters.targetOcclusalClearanceMm < material.occlusalClearanceMm.minimum || parameters.targetOcclusalClearanceMm > material.occlusalClearanceMm.maximum) errors.push('Target occlusal clearance falls outside the governed material range.');
  return errors;
}

function gaussian(x: number, y: number, featurePoint: MorphologyFeaturePoint, widthScale = 1): number {
  const width = Math.max(0.03, featurePoint.width * widthScale);
  const dx = x - featurePoint.position[0]; const dy = y - featurePoint.position[1];
  return featurePoint.height * Math.exp(-(dx * dx + dy * dy) / (2 * width * width));
}

function distanceToSegment(x: number, y: number, line: MorphologyGroove): number {
  const dx = line.end[0] - line.start[0]; const dy = line.end[1] - line.start[1];
  const denominator = dx * dx + dy * dy;
  const t = denominator ? Math.max(0, Math.min(1, ((x - line.start[0]) * dx + (y - line.start[1]) * dy) / denominator)) : 0;
  return Math.hypot(x - (line.start[0] + dx * t), y - (line.start[1] + dy * t));
}

/** Evaluate normalized CADence anatomy at a point inside the crown's occlusal footprint. */
export function morphologyHeight(definitionValue: MorphologyDefinition, parameters: CrownParameters, x: number, y: number): number {
  const xAdjusted = x / Math.max(0.7, parameters.mesiodistalScale);
  const yAdjusted = y / Math.max(0.7, parameters.buccolingualScale);
  const radius = Math.min(1.25, Math.hypot(xAdjusted, yAdjusted));
  const angularEnvelope = Math.max(0, 1 - Math.pow(Math.max(Math.abs(xAdjusted), Math.abs(yAdjusted)), 2.1));
  const roundEnvelope = Math.max(0, 1 - Math.pow(radius, 2.2 + parameters.roundness));
  const angularBlend = Math.max(0, Math.min(1, parameters.angularity));
  const envelope = roundEnvelope * (1 - angularBlend * 0.35) + angularEnvelope * angularBlend * 0.35;
  let anatomy = envelope * (0.28 + 0.18 * parameters.cervicalContour);
  const tableScale = Math.max(0.6, parameters.occlusalTableScale);
  const tableX = xAdjusted / tableScale; const tableY = yAdjusted / tableScale;
  const inclinationWidth = 1 / Math.max(0.45, parameters.cuspInclination);
  const anteriorLobeScale = definitionValue.mamelonCount > 0 ? parameters.lobeIntensity : 1;
  for (const cusp of definitionValue.cusps) anatomy += gaussian(tableX, tableY, cusp, inclinationWidth) * parameters.cuspHeight * anteriorLobeScale * (1 - parameters.wear * 0.65);
  for (const fossa of definitionValue.fossae) anatomy += gaussian(tableX, tableY, fossa) * parameters.grooveDepth;
  for (const pit of definitionValue.pits) anatomy += gaussian(tableX, tableY, pit) * parameters.grooveDepth;
  for (const item of [...definitionValue.developmentalGrooves, ...definitionValue.supplementalGrooves]) {
    const distance = distanceToSegment(tableX, tableY, item);
    anatomy -= item.depth * parameters.grooveDepth * Math.exp(-(distance * distance) / (2 * item.width * item.width));
  }
  anatomy -= definitionValue.centralGroove * parameters.grooveDepth * Math.exp(-Math.pow(tableY / 0.11, 2)) * Math.max(0, 1 - Math.abs(tableX));
  const marginalBand = Math.exp(-Math.pow((Math.abs(xAdjusted) - 0.72) / 0.13, 2));
  anatomy += marginalBand * definitionValue.marginalRidges * parameters.ridgeIntensity * 0.16 * Math.max(0, 1 - yAdjusted * yAdjusted);
  const triangular = Math.max(0, 1 - Math.abs(xAdjusted) * 1.25) * Math.max(0, 1 - Math.abs(yAdjusted) * 1.35);
  anatomy += triangular * definitionValue.triangularRidges * parameters.ridgeIntensity * 0.14;
  anatomy += Math.exp(-Math.pow(tableY / 0.18, 2)) * definitionValue.transverseRidges * parameters.ridgeIntensity * 0.08 * Math.max(0, 1 - Math.abs(tableX));
  if (definitionValue.obliqueRidge) anatomy += Math.exp(-Math.pow((yAdjusted + xAdjusted * 0.55) / 0.18, 2)) * definitionValue.obliqueRidge * parameters.ridgeIntensity * 0.12;
  if (definitionValue.mamelonCount) {
    const incisalBand = Math.exp(-Math.pow((yAdjusted + 0.58) / 0.2, 2));
    const lobes = 0.5 + 0.5 * Math.cos(xAdjusted * Math.PI * definitionValue.mamelonCount);
    anatomy += incisalBand * lobes * definitionValue.developmentalLobes * parameters.lobeIntensity * parameters.mamelonIntensity * 0.12;
    anatomy += incisalBand * definitionValue.incisalAnatomy * parameters.cuspHeight * 0.08;
  }
  const contact = (position: [number, number]) => Math.exp(-((xAdjusted - position[0]) ** 2 + (yAdjusted - position[1]) ** 2) / 0.055);
  anatomy += (contact(definitionValue.contactZones.mesial) + contact(definitionValue.contactZones.distal)) * parameters.contactZoneScale * 0.055;
  const proximalDistance = Math.min(Math.abs(xAdjusted + 0.82), Math.abs(xAdjusted - 0.82));
  anatomy -= Math.exp(-Math.pow(proximalDistance / 0.12, 2)) * Math.max(0, 1 - Math.abs(yAdjusted)) * definitionValue.embrasures * parameters.embrasureScale * 0.045;
  const lineAngleBand = Math.exp(-Math.pow((Math.abs(xAdjusted) - 0.62) / 0.09, 2));
  anatomy += lineAngleBand * definitionValue.lineAngles * parameters.lineAngleIntensity * (0.035 + parameters.angularity * 0.02);
  const facial = Math.max(0, -yAdjusted) * parameters.facialContour * 0.08;
  const lingual = Math.max(0, yAdjusted) * parameters.lingualContour * 0.08;
  const proximal = (Math.max(0, -xAdjusted) * parameters.mesialContour + Math.max(0, xAdjusted) * parameters.distalContour) * 0.05;
  return Math.max(0.02, (anatomy + facial + lingual + proximal) * parameters.anatomyIntensity * parameters.heightScale);
}
