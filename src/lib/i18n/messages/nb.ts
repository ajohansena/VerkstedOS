/**
 * Norwegian Bokmål (nb-NO) message catalog — the PRIMARY, canonical dictionary.
 *
 * This object defines the message shape; every other locale must `satisfies`
 * the inferred `Messages` type so missing keys are compile errors. Keep keys
 * grouped by surface. Only add keys that are actually used (YAGNI).
 *
 * Interpolation uses `{name}` placeholders resolved by `format()` in index.ts.
 */
export const nb = {
  common: {
    save: 'Lagre',
    cancel: 'Avbryt',
    add: 'Legg til',
    back: 'Tilbake',
    delete: 'Slett',
    edit: 'Rediger',
    create: 'Opprett',
    search: 'Søk',
    loading: 'Laster …',
    none: 'Ingen',
    optional: 'valgfritt',
    home: 'Hjem',
    signIn: 'Logg inn',
    signOut: 'Logg ut',
  },
  nav: {
    cases: 'Saker',
    production: 'Produksjon',
    clock: 'Stemple',
    customers: 'Kunder',
    vehicles: 'Kjøretøy',
    parts: 'Deler',
    admin: 'Administrasjon',
  },
  home: {
    title: 'VerkstedOS',
    subtitle: 'Operativsystem for skadeverksteder.',
    hello: 'Hei, {email}.',
    workshops: 'Verksteder',
    noWorkshops: 'Ingen verksteder i denne organisasjonen ennå.',
    notSignedIn:
      'Du er ikke logget inn, eller kontoen din har ingen organisasjonstilknytning.',
    notConfigured:
      'Supabase-autentisering er ikke konfigurert ennå — sett miljøvariablene for å aktivere innlogging.',
  },
  case: {
    photos: 'Bilder',
    photosDescription:
      'Last opp bilder før, under og etter reparasjon. Dokumentasjon for forsikring og kunde.',
    photosBefore: 'Før',
    photosDuring: 'Under',
    photosAfter: 'Etter',
    noPhotos: 'Ingen bilder ennå.',
    uploadPhoto: 'Last opp bilde',
    photoCategory: 'Kategori',
    storageNotConfigured:
      'Fillagring er ikke konfigurert. Sett Supabase Storage for å laste opp bilder.',
  },
  document: {
    documents: 'Dokumenter',
    kind: 'Type',
    uploadedAt: 'Lastet opp',
    sensitivity: 'Følsomhet',
  },
  validation: {
    required: 'Dette feltet er påkrevd.',
    invalidIdentifier: 'Ugyldig identifikator.',
    tooLong: 'Verdien er for lang.',
  },
} as const;

/**
 * The dictionary shape, with `string` leaf values (the nb catalog uses
 * `as const` for ergonomic access, but other locales only need to match the
 * key STRUCTURE — not the exact Norwegian literals).
 */
export type Messages = {
  [Group in keyof typeof nb]: {
    [Key in keyof (typeof nb)[Group]]: string;
  };
};
