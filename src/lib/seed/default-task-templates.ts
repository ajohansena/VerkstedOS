import type {
  CreateTaskTemplateInput,
  TaskTemplateDueReference,
} from '@/modules/workforce/public';

/**
 * Default Norwegian task templates seeded into a fresh org (D3 Phase F).
 * Mirrors doc 13 § 16.1 worked examples — these are the five "everyone uses
 * these" automations that close the office-side of the planner-as-heart.
 *
 * Trigger event types are aligned with existing outbox event names emitted by
 * the booking / production-state services.
 */
export interface DefaultTaskTemplateSpec extends CreateTaskTemplateInput {
  readonly key: string;
}

const oneDay = 24 * 60;
const tenDays = 10 * oneDay;

export const DEFAULT_TASK_TEMPLATES: readonly DefaultTaskTemplateSpec[] = [
  {
    key: 'order-parts',
    name: 'Bestill deler',
    triggerEventType: 'case.booking.confirmed',
    triggerEventFilter: null,
    taskKind: 'order_parts',
    taskTitleTemplate: 'Bestill deler — {caseNumber}',
    taskDescriptionTemplate:
      'Bestill nødvendige deler i god tid før kunden kommer.',
    dueOffsetMinutes: -tenDays,
    dueReference: 'case_expected_arrival_at' as TaskTemplateDueReference,
    defaultPriority: 'normal',
  },
  {
    key: 'call-customer-day-before',
    name: 'Ring kunde dagen før',
    triggerEventType: 'case.booking.confirmed',
    triggerEventFilter: null,
    taskKind: 'customer_call',
    taskTitleTemplate: 'Ring {customerName} dagen før',
    taskDescriptionTemplate:
      'Bekreft oppmøte og praktisk informasjon dagen før innlevering.',
    dueOffsetMinutes: -oneDay,
    dueReference: 'case_expected_arrival_at' as TaskTemplateDueReference,
    defaultPriority: 'normal',
  },
  {
    key: 'prepare-invoice',
    name: 'Klargjør faktura',
    triggerEventType: 'production.state.transitioned',
    triggerEventFilter: { toStateCode: 'delivered' },
    taskKind: 'invoice_prep',
    taskTitleTemplate: 'Klargjør faktura — {caseNumber}',
    taskDescriptionTemplate: 'Faktura skal være klar samme dag som levering.',
    dueOffsetMinutes: 60,
    dueReference: 'event_time' as TaskTemplateDueReference,
    defaultPriority: 'high',
  },
  {
    key: 'book-rental',
    name: 'Bestill leiebil',
    triggerEventType: 'case.booking.confirmed',
    triggerEventFilter: { requiresRental: true },
    taskKind: 'rental_booking',
    taskTitleTemplate: 'Bestill leiebil — {caseNumber}',
    taskDescriptionTemplate: 'Bestill leiebil i tide til kundens innlevering.',
    dueOffsetMinutes: 0,
    dueReference: 'case_expected_arrival_at' as TaskTemplateDueReference,
    defaultPriority: 'normal',
  },
  {
    key: 'follow-up-after-delivery',
    name: 'Følg opp etter levering',
    triggerEventType: 'production.state.transitioned',
    triggerEventFilter: { toStateCode: 'delivered' },
    taskKind: 'customer_followup',
    taskTitleTemplate: 'Følg opp {customerName} etter levering',
    taskDescriptionTemplate:
      'Sjekk at kunden er fornøyd og spør om noe må justeres.',
    dueOffsetMinutes: 7 * oneDay,
    dueReference: 'event_time' as TaskTemplateDueReference,
    defaultPriority: 'low',
  },
];
