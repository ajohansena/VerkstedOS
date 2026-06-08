import type { Messages } from './nb';

/**
 * English (en) message catalog — SECONDARY locale. Must match the `Messages`
 * shape defined by the Norwegian catalog (compile error if a key is missing).
 * English is for internal/secondary use; Norwegian is the default.
 */
export const en = {
  common: {
    save: 'Save',
    cancel: 'Cancel',
    add: 'Add',
    back: 'Back',
    delete: 'Delete',
    edit: 'Edit',
    create: 'Create',
    search: 'Search',
    loading: 'Loading …',
    none: 'None',
    optional: 'optional',
    home: 'Home',
    signIn: 'Sign in',
    signOut: 'Sign out',
  },
  nav: {
    cases: 'Cases',
    production: 'Production',
    clock: 'Clock',
    customers: 'Customers',
    vehicles: 'Vehicles',
    parts: 'Parts',
    admin: 'Admin',
  },
  home: {
    title: 'VerkstedOS',
    subtitle: 'Operating system for collision-repair workshops.',
    hello: 'Hello, {email}.',
    workshops: 'Workshops',
    noWorkshops: 'No workshops in this organization yet.',
    notSignedIn:
      'You are not signed in, or your account has no organization membership.',
    notConfigured:
      'Supabase auth is not configured yet — set the environment variables to enable sign-in.',
  },
  case: {
    photos: 'Photos',
    photosDescription:
      'Upload before, during and after photos. Documentation for insurance and customer.',
    photosBefore: 'Before',
    photosDuring: 'During',
    photosAfter: 'After',
    noPhotos: 'No photos yet.',
    uploadPhoto: 'Upload photo',
    photoCategory: 'Category',
    storageNotConfigured:
      'File storage is not configured. Set Supabase Storage to upload photos.',
  },
  document: {
    documents: 'Documents',
    kind: 'Kind',
    uploadedAt: 'Uploaded',
    sensitivity: 'Sensitivity',
  },
  validation: {
    required: 'This field is required.',
    invalidIdentifier: 'Invalid identifier.',
    tooLong: 'The value is too long.',
  },
} as const satisfies Messages;
