import {
  deleteSupabaseRows,
  getSupabaseRows,
  insertSupabaseRows,
} from "@/lib/supabase";

export type RequirementLevel = "all" | "intern" | "junior" | "middle" | "senior" | "lead";

type RequirementRow = {
  name: string;
  code: string;
  level: RequirementLevel;
  min: number | null;
  max: number | null;
  value: number | null;
};

type SprintRequirementInsertRow = RequirementRow & {
  sprint_id: string;
};

type SprintRequirementRow = SprintRequirementInsertRow & {
  id: string;
};

export type BuildSprintRequirementsResult = {
  insertedCount: number;
  replacedCount: number;
};

export async function buildSprintRequirementsFromCurrentRequirements(
  sprintId: string,
): Promise<BuildSprintRequirementsResult> {
  if (!sprintId) {
    throw new Error("Sprint ID is required.");
  }

  const requirements = await getSupabaseRows<RequirementRow>("requirements", {
    select: "name,code,level,min,max,value",
    order: { column: "code", ascending: true },
  });
  const existingSprintRequirements =
    await getSupabaseRows<SprintRequirementRow>("sprint_requirements", {
      select: "id",
      eq: { sprint_id: sprintId },
    });
  const rows = requirements.map((requirement) => ({
    sprint_id: sprintId,
    name: requirement.name,
    code: requirement.code,
    level: requirement.level,
    min: requirement.min,
    max: requirement.max,
    value: requirement.value,
  }));

  if (existingSprintRequirements.length > 0) {
    await deleteSupabaseRows<SprintRequirementRow>("sprint_requirements", {
      eq: { sprint_id: sprintId },
      select: "id",
    });
  }

  if (rows.length > 0) {
    await insertSupabaseRows<SprintRequirementRow, SprintRequirementInsertRow>(
      "sprint_requirements",
      rows,
      "id",
    );
  }

  return {
    insertedCount: rows.length,
    replacedCount: existingSprintRequirements.length,
  };
}
