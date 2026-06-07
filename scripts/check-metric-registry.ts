/**
 * Metric registry coverage check (CI gate).
 *
 * Enforces the Single Source of Truth rule (CLAUDE.md § 4.5): every metric
 * declares an owning module and calculation, and no calculation is claimed by
 * more than one metric.
 *
 * Run via `pnpm check:metrics`.
 */
import { metricRegistry, type MetricEntry } from '../src/metrics/registry';

const registry: Record<string, MetricEntry> = metricRegistry;

const errors: string[] = [];
const owners = new Map<string, string>(); // calc name -> metric name

for (const name of Object.keys(registry)) {
  const entry = registry[name];
  if (!entry || !entry.module || !entry.calc) {
    errors.push(`Metric "${name}" must declare both module and calc.`);
    continue;
  }
  const existing = owners.get(entry.calc);
  if (existing) {
    errors.push(
      `Calculation "${entry.calc}" is claimed by both "${existing}" and ` +
        `"${name}" — one authoritative owner per calculation (SSoT).`,
    );
  }
  owners.set(entry.calc, name);
}

if (errors.length > 0) {
  console.error('Metric registry check FAILED:');
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(
  `Metric registry check passed (${Object.keys(registry).length} metrics).`,
);
