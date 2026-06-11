-- D3 Phase F: RLS for task_templates + idempotency partial unique index on
-- office_tasks (template, source event) — guarantees a template never
-- generates two tasks for the same event.

ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_templates FORCE ROW LEVEL SECURITY;

CREATE POLICY task_templates_select ON task_templates
  FOR SELECT
  USING (
    organization_id = app_current_org_id()
    OR app_is_platform_inspector()
  );

CREATE POLICY task_templates_mutate ON task_templates
  FOR ALL
  USING (organization_id = app_current_org_id())
  WITH CHECK (organization_id = app_current_org_id());
--> statement-breakpoint

-- Idempotency for the event-driven generator. A single (template, event) pair
-- can only produce one office_task row — re-running the Inngest function over
-- the same outbox window is a no-op for tasks already created.
CREATE UNIQUE INDEX office_tasks_template_event_unique
  ON office_tasks (generated_from_template_id, generated_from_event_id)
  WHERE generated_from_template_id IS NOT NULL
    AND generated_from_event_id IS NOT NULL;
