import type { CreateTemplateInput } from './templates';

/**
 * Default QC checklist catalog (Norwegian). Seeded examples a workshop can use
 * out of the box and then customize per workshop. Mirrors the examples in the
 * Sprint 12 brief: delivery (levering) + calibration (kalibrering).
 */
export const DEFAULT_CHECKLIST_TEMPLATES: readonly CreateTemplateInput[] = [
  {
    code: 'delivery',
    name: 'Leveringssjekk',
    kind: 'delivery',
    items: [
      { label: 'Lys kontrollert' },
      { label: 'Panelspalter kontrollert' },
      { label: 'Lakkkvalitet kontrollert', requiresPhotoOnFail: true },
      { label: 'Interiør rengjort' },
      { label: 'Feilkoder kontrollert' },
    ],
  },
  {
    code: 'calibration',
    name: 'Kalibrering (ADAS)',
    kind: 'calibration',
    items: [
      { label: 'Kalibrering fullført', requiresPhotoOnFail: true },
      { label: 'Dokumentasjon vedlagt' },
      { label: 'Prøvekjøring fullført' },
    ],
  },
] as const;
