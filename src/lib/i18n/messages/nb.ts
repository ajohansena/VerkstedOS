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
    photosDrop: 'Dra og slipp bilder her, eller velg fra enheten.',
    photosChoose: 'Velg bilder',
    photosCamera: 'Ta bilde',
    photosUploading: 'Laster opp',
    photosDone: 'Ferdig',
    photosFailed: 'Feilet',
    storageNotConfigured:
      'Fillagring er ikke konfigurert. Sett Supabase Storage for å laste opp bilder.',
  },
  document: {
    documents: 'Dokumenter',
    kind: 'Type',
    uploadedAt: 'Lastet opp',
    sensitivity: 'Følsomhet',
  },
  quality: {
    title: 'Kvalitetskontroll',
    description: 'Sjekklister, avvik og kvalitetssignering.',
    startChecklist: 'Start sjekkliste',
    selectTemplate: 'Velg sjekkliste',
    runs: 'Sjekklister',
    open: 'Åpne',
    statusInProgress: 'Pågår',
    statusPassed: 'Godkjent',
    statusFailed: 'Underkjent',
    pass: 'OK',
    fail: 'Avvik',
    na: 'I/A',
    comment: 'Kommentar',
    signOff: 'Signer av',
    signedOff: 'Signert',
    deviations: 'Avvik',
    raiseDeviation: 'Registrer avvik',
    deviationTitle: 'Tittel',
    severity: 'Alvorlighet',
    severityMinor: 'Mindre',
    severityMajor: 'Vesentlig',
    severityCritical: 'Kritisk',
    resolve: 'Løs',
    noRuns: 'Ingen sjekklister ennå.',
    noDeviations: 'Ingen avvik.',
    commentRequired: 'Kommentar er påkrevd ved avvik.',
    signatures: 'Signaturer',
    sign: 'Signer',
    signerName: 'Navn på underskriver',
    chainValid: 'Signaturkjede gyldig',
    chainBroken: 'Signaturkjede brått (tukling oppdaget)',
    noSignatures: 'Ingen signaturer ennå.',
  },
  validation: {
    required: 'Dette feltet er påkrevd.',
    invalidIdentifier: 'Ugyldig identifikator.',
    tooLong: 'Verdien er for lang.',
  },
  intake: {
    title: 'Ny sak',
    searchPlaceholder: 'Registreringsnummer eller telefonnummer',
    searchHint: 'Søk på skilt eller telefon for å finne kunde og kjøretøy.',
    search: 'Søk',
    vehicles: 'Kjøretøy',
    customers: 'Kunder',
    noResults: 'Ingen treff. Opprett ny under.',
    createCase: 'Opprett sak',
    quickCreate: 'Ny kunde og kjøretøy',
    regNumber: 'Registreringsnummer',
    customerName: 'Kundenavn',
    customerPhone: 'Telefon',
    startCase: 'Start sak',
  },
  acceptance: {
    title: 'Kundegodkjenning',
    description:
      'Kunden må godkjenne før reparasjonen starter. Send SMS (eller e-post) med lenke til jobbkort.',
    statusPending: 'Venter på godkjenning',
    statusAccepted: 'Godkjent',
    statusDeclined: 'Avslått',
    statusNone: 'Ikke etterspurt',
    requestSms: 'Send SMS-godkjenning',
    requestEmail: 'Send e-post-godkjenning',
    contactPhone: 'Telefonnummer',
    contactEmail: 'E-postadresse',
    summary: 'Sammendrag (vises til kunden)',
    queued: 'Melding lagret (ingen SMS-leverandør konfigurert ennå).',
    sent: 'Melding sendt.',
    manualAccept: 'Registrer muntlig godkjenning',
    conversation: 'Samtale',
    noMessages: 'Ingen meldinger ennå.',
    acceptedVia: 'Godkjent via',
    jobCardLink: 'Jobbkort-lenke',
    respondedAt: 'Svart',
  },
  transfer: {
    title: 'Overføring mellom verksteder',
    currentWorkshop: 'Nåværende verksted',
    transferTo: 'Overfør til',
    initiate: 'Start overføring',
    transport: 'Transport',
    reason: 'Årsak',
    accept: 'Aksepter',
    confirmArrival: 'Bekreft ankomst',
    cancel: 'Avbryt',
    statusInitiated: 'Startet',
    statusInTransit: 'Under transport',
    statusArrived: 'Ankommet',
    statusCancelled: 'Avbrutt',
    history: 'Overføringshistorikk',
    noTransfers: 'Ingen overføringer.',
    yard: 'Innkommende saker',
    noInbound: 'Ingen innkommende saker.',
    blockingSegments: 'Saken har segmenter under arbeid.',
    timeline: 'Verkstedhistorikk',
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
