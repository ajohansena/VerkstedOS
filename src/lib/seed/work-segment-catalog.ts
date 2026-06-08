/**
 * Default work-segment catalog (docs/10-production-domain.md). ~23 standard
 * collision-repair segment codes with their typical department, required skills,
 * and required equipment kinds. Orgs can add/rename/disable.
 *
 * Segments are AVAILABLE, not mandatory — a small repair uses a handful, a large
 * repair uses many. The intake/decomposition picks the relevant ones from the
 * estimate.
 */

export interface SegmentCatalogEntry {
  code: string;
  label: string;
  department: string;
  requiredSkills: string[];
  requiredEquipmentKinds: string[];
}

export const WORK_SEGMENT_CATALOG: readonly SegmentCatalogEntry[] = [
  {
    code: 'reception',
    label: 'Mottak',
    department: 'reception',
    requiredSkills: [],
    requiredEquipmentKinds: [],
  },
  {
    code: 'pre_wash',
    label: 'Forvask',
    department: 'detailing',
    requiredSkills: ['detailing'],
    requiredEquipmentKinds: [],
  },
  {
    code: 'damage_assessment',
    label: 'Skadevurdering',
    department: 'estimating',
    requiredSkills: ['estimating'],
    requiredEquipmentKinds: [],
  },
  {
    code: 'disassembly',
    label: 'Demontering',
    department: 'body',
    requiredSkills: ['body'],
    requiredEquipmentKinds: ['lift'],
  },
  {
    code: 'supplement_assessment',
    label: 'Tilleggsvurdering',
    department: 'estimating',
    requiredSkills: ['estimating'],
    requiredEquipmentKinds: [],
  },
  {
    code: 'structural_repair',
    label: 'Rammerette',
    department: 'body',
    requiredSkills: ['frame', 'body'],
    requiredEquipmentKinds: ['frame_bench'],
  },
  {
    code: 'body_repair',
    label: 'Karosseri',
    department: 'body',
    requiredSkills: ['body'],
    requiredEquipmentKinds: ['lift'],
  },
  {
    code: 'mechanical_repair',
    label: 'Mekanisk',
    department: 'mechanical',
    requiredSkills: ['mechanical'],
    requiredEquipmentKinds: ['lift'],
  },
  {
    code: 'electrical_repair',
    label: 'Elektro',
    department: 'electrical',
    requiredSkills: ['electrical'],
    requiredEquipmentKinds: [],
  },
  {
    code: 'glass_replacement',
    label: 'Glass',
    department: 'glass',
    requiredSkills: ['glass'],
    requiredEquipmentKinds: [],
  },
  {
    code: 'paint_preparation',
    label: 'Lakkforberedelse',
    department: 'paint',
    requiredSkills: ['paint'],
    requiredEquipmentKinds: ['prep_bay'],
  },
  {
    code: 'paint_application',
    label: 'Lakkering',
    department: 'paint',
    requiredSkills: ['paint'],
    requiredEquipmentKinds: ['paint_booth'],
  },
  {
    code: 'paint_cure',
    label: 'Herding',
    department: 'paint',
    requiredSkills: [],
    requiredEquipmentKinds: ['paint_booth'],
  },
  {
    code: 'paint_polish',
    label: 'Polering',
    department: 'paint',
    requiredSkills: ['paint'],
    requiredEquipmentKinds: [],
  },
  {
    code: 'assembly',
    label: 'Montering',
    department: 'body',
    requiredSkills: ['body'],
    requiredEquipmentKinds: ['lift'],
  },
  {
    code: 'alignment',
    label: 'Hjulstilling',
    department: 'mechanical',
    requiredSkills: ['mechanical'],
    requiredEquipmentKinds: ['alignment_rig'],
  },
  {
    code: 'calibration_adas',
    label: 'ADAS-kalibrering',
    department: 'calibration',
    requiredSkills: ['calibration'],
    requiredEquipmentKinds: ['adas_rig'],
  },
  {
    code: 'quality_control',
    label: 'Kvalitetskontroll',
    department: 'qc',
    requiredSkills: ['qc'],
    requiredEquipmentKinds: [],
  },
  {
    code: 'detailing',
    label: 'Detaljering',
    department: 'detailing',
    requiredSkills: ['detailing'],
    requiredEquipmentKinds: [],
  },
  {
    code: 'delivery_prep',
    label: 'Leveringsklargjøring',
    department: 'reception',
    requiredSkills: [],
    requiredEquipmentKinds: [],
  },
  {
    code: 'customer_handover',
    label: 'Kundeoverlevering',
    department: 'reception',
    requiredSkills: [],
    requiredEquipmentKinds: [],
  },
  {
    code: 'internal_transport',
    label: 'Intern transport',
    department: 'operations',
    requiredSkills: [],
    requiredEquipmentKinds: [],
  },
  {
    code: 'external_subcontract',
    label: 'Underleverandør',
    department: 'operations',
    requiredSkills: [],
    requiredEquipmentKinds: [],
  },
];

const BY_CODE = new Map(WORK_SEGMENT_CATALOG.map((s) => [s.code, s]));

export function segmentCatalogEntry(
  code: string,
): SegmentCatalogEntry | undefined {
  return BY_CODE.get(code);
}
