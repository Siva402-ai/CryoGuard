-- Convert acknowledged_by to user IDs by matching users.name or valid users.id
UPDATE "alerts"
SET "acknowledged_by" = u."id"
FROM "users" u
WHERE LOWER(TRIM("alerts"."acknowledged_by")) = LOWER(TRIM(u."name"))
  AND "alerts"."acknowledged_by" IS NOT NULL
  AND "alerts"."acknowledged_by" != '';

-- Set any remaining non-matching acknowledged_by (that are not valid user IDs) or empty strings to NULL
UPDATE "alerts"
SET "acknowledged_by" = NULL
WHERE "acknowledged_by" IS NOT NULL
  AND ("acknowledged_by" = '' OR "acknowledged_by" NOT IN (SELECT "id" FROM "users"));

-- Convert resolved_by to user IDs by matching users.name or valid users.id
UPDATE "alerts"
SET "resolved_by" = u."id"
FROM "users" u
WHERE LOWER(TRIM("alerts"."resolved_by")) = LOWER(TRIM(u."name"))
  AND "alerts"."resolved_by" IS NOT NULL
  AND "alerts"."resolved_by" != '';

-- Set any remaining non-matching resolved_by (that are not valid user IDs) or empty strings to NULL
UPDATE "alerts"
SET "resolved_by" = NULL
WHERE "resolved_by" IS NOT NULL
  AND ("resolved_by" = '' OR "resolved_by" NOT IN (SELECT "id" FROM "users"));

-- Add Foreign Keys
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_acknowledged_by_fkey" FOREIGN KEY ("acknowledged_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
