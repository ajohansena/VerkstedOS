import { index, pgTable, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { timestamp } from 'drizzle-orm/pg-core';

import { skillProficiency } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { employees } from '@/db/schemas/workforce/employees';
import { organizations } from '@/db/schemas/identity/organizations';

/**
 * Employee skill — a competency an employee holds, with proficiency
 * (docs/10-production-domain.md § Resource model). An employee can hold MANY
 * skills (combined-role technicians: body + paint + reassembly). The scheduler
 * matches a segment's required skills to employees with adequate proficiency.
 */
export const employeeSkills = pgTable(
  'employee_skills',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    /** Skill code: body | paint | mechanical | electrical | calibration | ... */
    skillCode: varchar('skill_code', { length: 32 }).notNull(),
    proficiency: skillProficiency('proficiency').notNull().default('qualified'),
    validFrom: timestamp('valid_from', { withTimezone: true }),
    validUntil: timestamp('valid_until', { withTimezone: true }),
    ...lifecycleColumns,
  },
  (table) => [
    unique('employee_skills_emp_code_uq').on(table.employeeId, table.skillCode),
    index('employee_skills_org_idx').on(table.organizationId),
  ],
);
