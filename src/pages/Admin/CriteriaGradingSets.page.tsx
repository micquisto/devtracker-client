import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Card } from "@/components/shared/Containers";
import { Title } from "@/components/shared/page";
import {
  deleteSupabaseRows,
  getSupabaseRows,
  insertSupabaseRows,
  updateSupabaseRows,
} from "@/lib/supabase";
import { Palette } from "@/lib/theme";
import { type CriteriaType } from "@/lib/utils/scrum/evaluateMemberPerformance.utils";
import { type RequirementLevel } from "@/lib/utils/scrum/sprintRequirements.utils";
import "@/assets/styles/RequirementsData.page.css";

type PageTab = "criteria-sets" | "criteria" | "grading-sets";

type CriteriaSetRow = {
  id: string;
  set_name: string;
  set_code: string;
  version: string;
  created_at?: string;
  updated_at?: string;
};

type CriteriaSetInsertRow = {
  set_name: string;
  set_code: string;
  version: string;
};

type CriteriaRow = {
  id: string;
  name: string;
  code: string;
  level: RequirementLevel;
  type: CriteriaType | null;
  min: number | null;
  max: number | null;
  value: number | null;
  weight: number | null;
  sort_number: number | null;
};

type CriteriaInsertRow = {
  name: string;
  code: string;
  level: RequirementLevel;
  type: CriteriaType;
  min: number;
  max: number;
  value: number;
  weight: number;
  sort_number: number;
};

type CriteriaSetGradingLinkRow = {
  id: string;
  criteria_set_id: string;
  grading_set_id: string;
};

type CriteriaSetGradingLinkInsertRow = {
  criteria_set_id: string;
  grading_set_id: string;
};

type GradingSetRow = {
  id: string;
  name: string;
  grading_code: string;
  level: RequirementLevel;
  passing_score: number | null;
  created_at?: string;
  updated_at?: string;
};

type GradingSetInsertRow = {
  name: string;
  grading_code: string;
  level: RequirementLevel;
  passing_score: number;
};

type GradingSetCriteriaRow = {
  id: string;
  grading_set_id: string;
  criteria_id: string;
  percentage: number | null;
};

type GradingSetCriteriaInsertRow = {
  grading_set_id: string;
  criteria_id: string;
  percentage: number;
};

type CriteriaSetFormState = {
  set_name: string;
  set_code: string;
  version: string;
};

type CriteriaFormState = {
  name: string;
  code: string;
  level: RequirementLevel;
  type: CriteriaType;
  min: string;
  max: string;
  value: string;
  weight: string;
  sort_number: string;
};

type GradingSetFormState = {
  name: string;
  grading_code: string;
  level: RequirementLevel;
  passing_score: string;
};

const LEVEL_OPTIONS: RequirementLevel[] = [
  "all",
  "intern",
  "junior",
  "middle",
  "senior",
  "lead",
];

const TYPE_OPTIONS: CriteriaType[] = [
  "productivity",
  "efficiency",
  "quality",
  "collaboration",
  "professionalism",
  "velocity",
  "manual",
];

const UNASSIGNED_GRADING_SET_FILTER = "__unassigned__";

const TABS: Array<{ id: PageTab; label: string }> = [
  { id: "criteria-sets", label: "Criteria Sets" },
  { id: "criteria", label: "Criteria" },
  { id: "grading-sets", label: "Grading Sets" },
];

const INITIAL_SET_FORM: CriteriaSetFormState = {
  set_name: "",
  set_code: "",
  version: "1.0.0",
};

const INITIAL_CRITERIA_FORM: CriteriaFormState = {
  name: "",
  code: "",
  level: "all",
  type: "productivity",
  min: "",
  max: "",
  value: "",
  weight: "",
  sort_number: "",
};

const INITIAL_GRADING_FORM: GradingSetFormState = {
  name: "",
  grading_code: "",
  level: "junior",
  passing_score: "75",
};

const GRADING_SET_SELECT =
  "id,name,grading_code,level,passing_score,created_at,updated_at";
const PERCENTAGE_TOTAL_TARGET = 100;
const DEFAULT_CRITERIA_SET_CODE = "default";

function SelectArrow() {
  return (
    <svg
      aria-hidden="true"
      className="requirements-data-select-arrow"
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
    >
      <path
        d="M2.5 4.5 6 8l3.5-3.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function parseRequiredNumber(value: string, label: string): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be a valid number.`);
  }

  return parsed;
}

function buildCodeFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/['"]/gu, "")
    .replace(/[^a-z0-9]+/gu, "_")
    .replace(/^_+|_+$/gu, "");
}

function formatTypeLabel(type: CriteriaType): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function getLevelClass(level: RequirementLevel): string {
  return `requirements-data-level-pill is-${level}`;
}

function formatOptionalNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? "-" : String(value);
}

function formatPercentage(value: number): string {
  return `${Number(value.toFixed(2))}%`;
}

function clampPercentage(value: number | null | undefined): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(100, Math.max(0, numeric));
}

function isPercentageTotalValid(total: number): boolean {
  return Math.abs(total - PERCENTAGE_TOTAL_TARGET) < 0.01;
}

function isCriteriaApplicableToLevel(
  criteriaLevel: RequirementLevel,
  gradingLevel: RequirementLevel,
): boolean {
  return (
    gradingLevel === "all" ||
    criteriaLevel === "all" ||
    criteriaLevel === gradingLevel
  );
}

export default function CriteriaGradingSetsPage() {
  const [activeTab, setActiveTab] = useState<PageTab>("criteria-sets");
  const [criteriaSets, setCriteriaSets] = useState<CriteriaSetRow[]>([]);
  const [criteria, setCriteria] = useState<CriteriaRow[]>([]);
  const [gradingSets, setGradingSets] = useState<GradingSetRow[]>([]);
  const [setGradingLinks, setSetGradingLinks] = useState<CriteriaSetGradingLinkRow[]>([]);
  const [gradingCriteriaLinks, setGradingCriteriaLinks] = useState<
    GradingSetCriteriaRow[]
  >([]);
  const [percentageDrafts, setPercentageDrafts] = useState<Record<string, string>>({});
  const [selectedSetId, setSelectedSetId] = useState("");
  const [selectedGradingSetId, setSelectedGradingSetId] = useState("");
  const [setForm, setSetForm] = useState<CriteriaSetFormState>(INITIAL_SET_FORM);
  const [criteriaForm, setCriteriaForm] =
    useState<CriteriaFormState>(INITIAL_CRITERIA_FORM);
  const [gradingForm, setGradingForm] =
    useState<GradingSetFormState>(INITIAL_GRADING_FORM);
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [editingCriteriaId, setEditingCriteriaId] = useState<string | null>(null);
  const [editingGradingSetId, setEditingGradingSetId] = useState<string | null>(null);
  const [criteriaSearch, setCriteriaSearch] = useState("");
  const [criteriaTypeFilter, setCriteriaTypeFilter] = useState<CriteriaType | "">("");
  const [criteriaLevelFilter, setCriteriaLevelFilter] = useState<RequirementLevel | "">("");
  const [criteriaGradingSetFilter, setCriteriaGradingSetFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedSet = criteriaSets.find((set) => set.id === selectedSetId) ?? null;
  const selectedGradingSet =
    gradingSets.find((set) => set.id === selectedGradingSetId) ?? null;

  const linkedGradingSetIds = new Set(
    setGradingLinks
      .filter((link) => link.criteria_set_id === selectedSetId)
      .map((link) => link.grading_set_id),
  );
  const linkedGradingLevels = new Map<RequirementLevel, GradingSetRow>();
  for (const gradingSet of gradingSets) {
    if (linkedGradingSetIds.has(gradingSet.id)) {
      linkedGradingLevels.set(gradingSet.level, gradingSet);
    }
  }

  const selectedGradingLinksByCriteriaId = new Map(
    gradingCriteriaLinks
      .filter((link) => link.grading_set_id === selectedGradingSetId)
      .map((link) => [link.criteria_id, link]),
  );
  const selectedGradingCriteria = selectedGradingSet
    ? criteria.filter(
        (row) =>
          selectedGradingLinksByCriteriaId.has(row.id) ||
          isCriteriaApplicableToLevel(row.level, selectedGradingSet.level),
      )
    : [];

  const normalizedCriteriaSearch = criteriaSearch.trim().toLowerCase();
  const assignedCriteriaIds = new Set(gradingCriteriaLinks.map((link) => link.criteria_id));
  const gradingSetFilterCriteriaIds = new Set(
    gradingCriteriaLinks
      .filter((link) => link.grading_set_id === criteriaGradingSetFilter)
      .map((link) => link.criteria_id),
  );
  const filteredCriteria = criteria.filter(
    (row) =>
      (!criteriaTypeFilter || row.type === criteriaTypeFilter) &&
      (!criteriaLevelFilter || row.level === criteriaLevelFilter) &&
      (!criteriaGradingSetFilter ||
        (criteriaGradingSetFilter === UNASSIGNED_GRADING_SET_FILTER
          ? !assignedCriteriaIds.has(row.id)
          : gradingSetFilterCriteriaIds.has(row.id))) &&
      (!normalizedCriteriaSearch ||
        row.name.toLowerCase().includes(normalizedCriteriaSearch) ||
        row.code.toLowerCase().includes(normalizedCriteriaSearch)),
  );
  const hasCriteriaFilters = Boolean(
    normalizedCriteriaSearch ||
      criteriaTypeFilter ||
      criteriaLevelFilter ||
      criteriaGradingSetFilter,
  );

  function getGradingSetTotal(gradingSetId: string): number {
    return gradingCriteriaLinks
      .filter((link) => link.grading_set_id === gradingSetId)
      .reduce((sum, link) => sum + clampPercentage(link.percentage), 0);
  }

  function getGradingSetCriteriaCount(gradingSetId: string): number {
    return gradingCriteriaLinks.filter((link) => link.grading_set_id === gradingSetId)
      .length;
  }

  const selectedGradingTotal = selectedGradingSetId
    ? getGradingSetTotal(selectedGradingSetId)
    : 0;

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      const [sets, criteriaRows, gradingRows, setLinks, criteriaLinks] =
        await Promise.all([
          getSupabaseRows<CriteriaSetRow>("critera_set", {
            select: "id,set_name,set_code,version,created_at,updated_at",
            order: { column: "set_code", ascending: true },
          }),
          getSupabaseRows<CriteriaRow>("criteria", {
            select: "id,name,code,level,type,min,max,value,weight,sort_number",
            order: { column: "sort_number", ascending: true },
          }),
          getSupabaseRows<GradingSetRow>("grading_set", {
            select: GRADING_SET_SELECT,
            order: { column: "grading_code", ascending: true },
          }),
          getSupabaseRows<CriteriaSetGradingLinkRow>("criteria_set_grading_set", {
            select: "id,criteria_set_id,grading_set_id",
          }),
          getSupabaseRows<GradingSetCriteriaRow>("grading_set_criteria", {
            select: "id,grading_set_id,criteria_id,percentage",
          }),
        ]);

      setCriteriaSets(sets);
      setCriteria(criteriaRows);
      setGradingSets(gradingRows);
      setSetGradingLinks(setLinks);
      setGradingCriteriaLinks(criteriaLinks);
      setPercentageDrafts({});
      setSelectedSetId((current) => {
        if (current && sets.some((set) => set.id === current)) return current;
        return sets[0]?.id ?? "";
      });
      setSelectedGradingSetId((current) => {
        if (current && gradingRows.some((set) => set.id === current)) return current;
        return gradingRows[0]?.id ?? "";
      });
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load criteria and grading data.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  function clearMessages(): void {
    setError(null);
    setSuccess(null);
  }

  function scrollToForm(formId: string): void {
    document.getElementById(formId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function startEditSet(set: CriteriaSetRow): void {
    clearMessages();
    setEditingSetId(set.id);
    setSetForm({ set_name: set.set_name, set_code: set.set_code, version: set.version });
    scrollToForm("criteria-set-form");
  }

  function cancelEditSet(): void {
    setEditingSetId(null);
    setSetForm(INITIAL_SET_FORM);
  }

  function startEditCriteria(row: CriteriaRow): void {
    clearMessages();
    setEditingCriteriaId(row.id);
    setCriteriaForm({
      name: row.name,
      code: row.code,
      level: row.level,
      type: row.type ?? "productivity",
      min: row.min === null ? "" : String(row.min),
      max: row.max === null ? "" : String(row.max),
      value: row.value === null ? "" : String(row.value),
      weight: row.weight === null ? "" : String(row.weight),
      sort_number: row.sort_number === null ? "" : String(row.sort_number),
    });
    scrollToForm("criteria-form");
  }

  function cancelEditCriteria(): void {
    setEditingCriteriaId(null);
    setCriteriaForm(INITIAL_CRITERIA_FORM);
  }

  function startEditGradingSet(set: GradingSetRow): void {
    clearMessages();
    setEditingGradingSetId(set.id);
    setGradingForm({
      name: set.name,
      grading_code: set.grading_code,
      level: set.level,
      passing_score: set.passing_score === null ? "" : String(set.passing_score),
    });
    scrollToForm("grading-set-form");
  }

  function cancelEditGradingSet(): void {
    setEditingGradingSetId(null);
    setGradingForm(INITIAL_GRADING_FORM);
  }

  const editingSet = criteriaSets.find((set) => set.id === editingSetId) ?? null;
  const isEditingDefaultSet = editingSet?.set_code === DEFAULT_CRITERIA_SET_CODE;

  async function handleSubmitSet(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    clearMessages();

    try {
      const row: CriteriaSetInsertRow = {
        set_name: setForm.set_name.trim(),
        set_code: setForm.set_code.trim(),
        version: setForm.version.trim(),
      };

      if (!row.set_name || !row.set_code || !row.version) {
        throw new Error("Set name, code, and version are required.");
      }

      if (editingSetId) {
        if (isEditingDefaultSet) {
          row.set_code = DEFAULT_CRITERIA_SET_CODE;
        }
        await updateSupabaseRows<CriteriaSetRow, CriteriaSetInsertRow>("critera_set", row, {
          eq: { id: editingSetId },
          select: "id",
        });
        cancelEditSet();
        await loadAll();
        setSuccess(`Updated criteria set ${row.set_name}.`);
        return;
      }

      const [created] = await insertSupabaseRows<CriteriaSetRow, CriteriaSetInsertRow>(
        "critera_set",
        row,
        "id,set_name,set_code,version,created_at,updated_at",
      );

      setSetForm(INITIAL_SET_FORM);
      await loadAll();
      if (created) setSelectedSetId(created.id);
      setSuccess(created ? `Created criteria set ${created.set_name}.` : "Created criteria set.");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to save criteria set.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSet(set: CriteriaSetRow): Promise<void> {
    setDeletingId(set.id);
    clearMessages();

    try {
      await deleteSupabaseRows<CriteriaSetRow>("critera_set", {
        eq: { id: set.id },
        select: "id",
      });
      if (editingSetId === set.id) cancelEditSet();
      await loadAll();
      setSuccess(`Deleted criteria set ${set.set_name}.`);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete criteria set.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function handleToggleGradingSetLink(
    gradingSet: GradingSetRow,
    checked: boolean,
  ): Promise<void> {
    if (!selectedSetId) return;

    setLinkingId(gradingSet.id);
    clearMessages();

    try {
      if (checked) {
        const conflicting = linkedGradingLevels.get(gradingSet.level);
        if (conflicting && conflicting.id !== gradingSet.id) {
          throw new Error(
            `${conflicting.name} already covers the "${gradingSet.level}" level in this criteria set.`,
          );
        }

        const total = getGradingSetTotal(gradingSet.id);
        if (!isPercentageTotalValid(total)) {
          throw new Error(
            `${gradingSet.name} criteria total ${formatPercentage(total)}; it must total 100% before it can be assigned.`,
          );
        }

        const [created] = await insertSupabaseRows<
          CriteriaSetGradingLinkRow,
          CriteriaSetGradingLinkInsertRow
        >(
          "criteria_set_grading_set",
          { criteria_set_id: selectedSetId, grading_set_id: gradingSet.id },
          "id,criteria_set_id,grading_set_id",
        );

        if (created) {
          setSetGradingLinks((current) => [...current, created]);
        }
        setSuccess(`Assigned ${gradingSet.name} to the criteria set.`);
      } else {
        const existing = setGradingLinks.find(
          (link) =>
            link.criteria_set_id === selectedSetId &&
            link.grading_set_id === gradingSet.id,
        );

        if (existing) {
          await deleteSupabaseRows<CriteriaSetGradingLinkRow>(
            "criteria_set_grading_set",
            {
              eq: { id: existing.id },
              select: "id",
            },
          );
          setSetGradingLinks((current) =>
            current.filter((link) => link.id !== existing.id),
          );
        }

        setSuccess(`Removed ${gradingSet.name} from the criteria set.`);
      }
    } catch (linkError) {
      setError(
        linkError instanceof Error
          ? linkError.message
          : "Unable to update criteria set grading sets.",
      );
    } finally {
      setLinkingId(null);
    }
  }

  async function handleToggleGradingCriteria(
    row: CriteriaRow,
    checked: boolean,
  ): Promise<void> {
    if (!selectedGradingSetId) return;

    setLinkingId(row.id);
    clearMessages();

    try {
      if (checked) {
        const [created] = await insertSupabaseRows<
          GradingSetCriteriaRow,
          GradingSetCriteriaInsertRow
        >(
          "grading_set_criteria",
          {
            grading_set_id: selectedGradingSetId,
            criteria_id: row.id,
            percentage: clampPercentage(row.weight),
          },
          "id,grading_set_id,criteria_id,percentage",
        );

        if (created) {
          setGradingCriteriaLinks((current) => [...current, created]);
        }
        setSuccess(`Added ${row.name} to the grading set.`);
      } else {
        const existing = selectedGradingLinksByCriteriaId.get(row.id);

        if (existing) {
          await deleteSupabaseRows<GradingSetCriteriaRow>("grading_set_criteria", {
            eq: { id: existing.id },
            select: "id",
          });
          setGradingCriteriaLinks((current) =>
            current.filter((link) => link.id !== existing.id),
          );
          setPercentageDrafts((current) => {
            const next = { ...current };
            delete next[existing.id];
            return next;
          });
        }

        setSuccess(`Removed ${row.name} from the grading set.`);
      }
    } catch (linkError) {
      setError(
        linkError instanceof Error
          ? linkError.message
          : "Unable to update grading set criteria.",
      );
    } finally {
      setLinkingId(null);
    }
  }

  async function handleSavePercentage(link: GradingSetCriteriaRow): Promise<void> {
    const draft = percentageDrafts[link.id];
    if (draft === undefined) return;

    const parsed = Number(draft);
    if (draft.trim() === "" || !Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      setError("Percentage must be a number from 0 to 100.");
      return;
    }

    if (parsed === clampPercentage(link.percentage)) {
      setPercentageDrafts((current) => {
        const next = { ...current };
        delete next[link.id];
        return next;
      });
      return;
    }

    setLinkingId(link.criteria_id);
    clearMessages();

    try {
      const [updated] = await updateSupabaseRows<
        GradingSetCriteriaRow,
        { percentage: number }
      >(
        "grading_set_criteria",
        { percentage: parsed },
        { eq: { id: link.id }, select: "id,grading_set_id,criteria_id,percentage" },
      );

      setGradingCriteriaLinks((current) =>
        current.map((row) =>
          row.id === link.id ? (updated ?? { ...row, percentage: parsed }) : row,
        ),
      );
      setPercentageDrafts((current) => {
        const next = { ...current };
        delete next[link.id];
        return next;
      });
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to update criteria percentage.",
      );
    } finally {
      setLinkingId(null);
    }
  }

  async function handleSubmitCriteria(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setSaving(true);
    clearMessages();

    try {
      const row: CriteriaInsertRow = {
        name: criteriaForm.name.trim(),
        code: criteriaForm.code.trim(),
        level: criteriaForm.level,
        type: criteriaForm.type,
        min: parseRequiredNumber(criteriaForm.min, "Min"),
        max: parseRequiredNumber(criteriaForm.max, "Max"),
        value: parseRequiredNumber(criteriaForm.value, "Value"),
        weight: parseRequiredNumber(criteriaForm.weight, "Weight"),
        sort_number: parseRequiredNumber(criteriaForm.sort_number, "Sort number"),
      };

      if (!row.name || !row.code) {
        throw new Error("Name and code are required.");
      }

      if (editingCriteriaId) {
        await updateSupabaseRows<CriteriaRow, CriteriaInsertRow>("criteria", row, {
          eq: { id: editingCriteriaId },
          select: "id",
        });
        cancelEditCriteria();
        await loadAll();
        setSuccess(`Updated criteria ${row.name}.`);
        return;
      }

      const [created] = await insertSupabaseRows<CriteriaRow, CriteriaInsertRow>(
        "criteria",
        row,
        "id,name,code,level,type,min,max,value,weight,sort_number",
      );

      setCriteriaForm(INITIAL_CRITERIA_FORM);
      await loadAll();
      setSuccess(created ? `Created criteria ${created.name}.` : "Created criteria.");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to save criteria.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCriteria(row: CriteriaRow): Promise<void> {
    setDeletingId(row.id);
    clearMessages();

    try {
      await deleteSupabaseRows<CriteriaRow>("criteria", {
        eq: { id: row.id },
        select: "id",
      });
      if (editingCriteriaId === row.id) cancelEditCriteria();
      await loadAll();
      setSuccess(`Deleted criteria ${row.name}.`);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete criteria.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSubmitGradingSet(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setSaving(true);
    clearMessages();

    try {
      const row: GradingSetInsertRow = {
        name: gradingForm.name.trim(),
        grading_code: gradingForm.grading_code.trim(),
        level: gradingForm.level,
        passing_score: parseRequiredNumber(gradingForm.passing_score, "Passing score"),
      };

      if (!row.name || !row.grading_code) {
        throw new Error("Name and grading code are required.");
      }

      if (row.passing_score < 0 || row.passing_score > 100) {
        throw new Error("Passing score must be from 0 to 100.");
      }

      if (editingGradingSetId) {
        const editingId = editingGradingSetId;
        const criteriaSetIdsForGrading = new Set(
          setGradingLinks
            .filter((link) => link.grading_set_id === editingId)
            .map((link) => link.criteria_set_id),
        );
        const levelConflict = setGradingLinks.find((link) => {
          if (link.grading_set_id === editingId) return false;
          if (!criteriaSetIdsForGrading.has(link.criteria_set_id)) return false;
          return (
            gradingSets.find((set) => set.id === link.grading_set_id)?.level === row.level
          );
        });
        if (levelConflict) {
          const conflictSet = gradingSets.find(
            (set) => set.id === levelConflict.grading_set_id,
          );
          const conflictCriteriaSet = criteriaSets.find(
            (set) => set.id === levelConflict.criteria_set_id,
          );
          throw new Error(
            `${conflictSet?.name ?? "Another grading set"} already covers the "${row.level}" level in ${conflictCriteriaSet?.set_name ?? "a criteria set"} this grading set is assigned to.`,
          );
        }

        await updateSupabaseRows<GradingSetRow, GradingSetInsertRow>("grading_set", row, {
          eq: { id: editingId },
          select: "id",
        });
        cancelEditGradingSet();
        await loadAll();
        setSuccess(`Updated grading set ${row.name}.`);
        return;
      }

      const [created] = await insertSupabaseRows<GradingSetRow, GradingSetInsertRow>(
        "grading_set",
        row,
        GRADING_SET_SELECT,
      );

      setGradingForm(INITIAL_GRADING_FORM);
      await loadAll();
      if (created) setSelectedGradingSetId(created.id);
      setSuccess(
        created
          ? `Created grading set ${created.name}. Add criteria and percentages below.`
          : "Created grading set.",
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to save grading set.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteGradingSet(set: GradingSetRow): Promise<void> {
    setDeletingId(set.id);
    clearMessages();

    try {
      await deleteSupabaseRows<GradingSetRow>("grading_set", {
        eq: { id: set.id },
        select: "id",
      });
      if (editingGradingSetId === set.id) cancelEditGradingSet();
      await loadAll();
      setSuccess(`Deleted grading set ${set.name}.`);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete grading set.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="requirements-data-page">
      <Title
        eyebrow="Admin / Data Override"
        title="Criteria & Grading Sets"
        subtitle="Build criteria, group them into level-based grading sets with percentages, then assign grading sets to criteria sets used by sprint evaluation."
        size="large"
      />

      <div className="requirements-data-tabs" role="tablist" aria-label="Criteria and grading sections">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            aria-selected={activeTab === tab.id}
            className={`requirements-data-tab${activeTab === tab.id ? " is-active" : ""}`}
            onClick={() => {
              setActiveTab(tab.id);
              clearMessages();
            }}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error ? <div className="requirements-data-message is-error">{error}</div> : null}
      {success ? (
        <div className="requirements-data-message is-success">{success}</div>
      ) : null}

      {activeTab === "criteria-sets" ? (
        <>
          <Card className="requirements-data-card">
            <form
              className="requirements-data-form"
              id="criteria-set-form"
              onSubmit={(event) => void handleSubmitSet(event)}
            >
              <div className="requirements-data-grid">
                <label className="requirements-data-field is-full-width">
                  <span>Set Name</span>
                  <input
                    onChange={(event) => {
                      const set_name = event.target.value;
                      setSetForm((current) => ({
                        ...current,
                        set_name,
                        set_code: editingSetId
                          ? current.set_code
                          : buildCodeFromName(set_name),
                      }));
                    }}
                    placeholder="Criteria set name"
                    required
                    type="text"
                    value={setForm.set_name}
                  />
                </label>

                <label className="requirements-data-field">
                  <span>Set Code</span>
                  <input
                    onChange={(event) =>
                      setSetForm((current) => ({
                        ...current,
                        set_code: event.target.value,
                      }))
                    }
                    placeholder="e.g. default"
                    readOnly={isEditingDefaultSet}
                    required
                    title={
                      isEditingDefaultSet
                        ? "The Default set code is used to find the default set and cannot change"
                        : undefined
                    }
                    type="text"
                    value={setForm.set_code}
                  />
                </label>

                <label className="requirements-data-field">
                  <span>Version</span>
                  <input
                    onChange={(event) =>
                      setSetForm((current) => ({
                        ...current,
                        version: event.target.value,
                      }))
                    }
                    placeholder="1.0.0"
                    required
                    type="text"
                    value={setForm.version}
                  />
                </label>
              </div>

              <div className="requirements-data-actions requirements-data-modal-actions">
                {editingSetId ? (
                  <button
                    className="requirements-data-cancel-button"
                    disabled={saving}
                    onClick={cancelEditSet}
                    type="button"
                  >
                    Cancel
                  </button>
                ) : null}
                <button
                  className="requirements-data-submit"
                  disabled={saving || loading}
                  type="submit"
                >
                  {saving ? (
                    <>
                      <span
                        className="requirements-data-loader"
                        style={{ borderTopColor: Palette.cyan }}
                      />
                      {editingSetId ? "Saving" : "Creating"}
                    </>
                  ) : editingSetId ? (
                    "Save Changes"
                  ) : (
                    "Create Criteria Set"
                  )}
                </button>
              </div>
            </form>
          </Card>

          <Card className="requirements-data-card requirements-data-table-card">
            <div className="requirements-data-table-header">
              <div>
                <div className="requirements-data-kicker">Criteria Sets</div>
                <h3>All Sets</h3>
              </div>
              <span>{criteriaSets.length} records</span>
            </div>

            {loading ? (
              <div className="requirements-data-empty">Loading criteria sets...</div>
            ) : criteriaSets.length === 0 ? (
              <div className="requirements-data-empty">No Data Found</div>
            ) : (
              <div className="requirements-data-table-wrap">
                <table className="requirements-data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Code</th>
                      <th>Version</th>
                      <th>Grading Sets</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {criteriaSets.map((set) => {
                      const linkedCount = setGradingLinks.filter(
                        (link) => link.criteria_set_id === set.id,
                      ).length;

                      return (
                        <tr
                          key={set.id}
                          className={
                            selectedSetId === set.id
                              ? "requirements-data-row is-selected"
                              : undefined
                          }
                        >
                          <td data-label="Name">
                            {set.set_name}
                            {set.set_code === DEFAULT_CRITERIA_SET_CODE ? (
                              <span className="grading-default-note"> · used by sprints without a set</span>
                            ) : null}
                          </td>
                          <td data-label="Code">{set.set_code}</td>
                          <td data-label="Version">{set.version}</td>
                          <td data-label="Grading Sets">{linkedCount}</td>
                          <td data-label="Actions">
                            <div className="requirements-data-row-actions">
                              <button
                                className="requirements-data-row-button"
                                onClick={() => setSelectedSetId(set.id)}
                                title="Manage grading sets"
                                type="button"
                              >
                                Select
                              </button>
                              <button
                                className="requirements-data-row-button"
                                onClick={() => startEditSet(set)}
                                title="Edit"
                                type="button"
                              >
                                Edit
                              </button>
                              <button
                                aria-label={`Delete ${set.set_name}`}
                                className="requirements-data-row-button is-danger"
                                disabled={
                                  deletingId === set.id ||
                                  set.set_code === DEFAULT_CRITERIA_SET_CODE
                                }
                                onClick={() => void handleDeleteSet(set)}
                                title={
                                  set.set_code === DEFAULT_CRITERIA_SET_CODE
                                    ? "The Default set cannot be deleted"
                                    : "Delete"
                                }
                                type="button"
                              >
                                {deletingId === set.id ? (
                                  <span
                                    className="requirements-data-loader"
                                    style={{ borderTopColor: "#ff8d8d" }}
                                  />
                                ) : (
                                  "Delete"
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="requirements-data-card requirements-data-table-card">
            <div className="requirements-data-table-header">
              <div>
                <div className="requirements-data-kicker">Assigned Grading Sets</div>
                <h3>
                  {selectedSet
                    ? `Grading sets in ${selectedSet.set_name}`
                    : "Select a criteria set"}
                </h3>
              </div>
              <label className="requirements-data-filter-field">
                <span>Set</span>
                <div className="requirements-data-select-wrap">
                  <select
                    disabled={loading || criteriaSets.length === 0}
                    onChange={(event) => setSelectedSetId(event.target.value)}
                    value={selectedSetId}
                  >
                    {criteriaSets.length === 0 ? (
                      <option value="">No sets</option>
                    ) : (
                      criteriaSets.map((set) => (
                        <option key={set.id} value={set.id}>
                          {set.set_name} ({set.set_code})
                        </option>
                      ))
                    )}
                  </select>
                  <SelectArrow />
                </div>
              </label>
            </div>

            {!selectedSetId ? (
              <div className="requirements-data-empty">
                Select a criteria set to assign grading sets.
              </div>
            ) : loading ? (
              <div className="requirements-data-empty">Loading grading sets...</div>
            ) : gradingSets.length === 0 ? (
              <div className="requirements-data-empty">
                No grading sets yet. Create one in the Grading Sets tab.
              </div>
            ) : (
              <div className="acl-tree">
                <div className="acl-tree-toolbar">
                  <span>{linkedGradingSetIds.size} grading sets assigned</span>
                  <span>One grading set per level</span>
                </div>
                <div className="acl-tree-panel">
                  {gradingSets.map((gradingSet) => {
                    const checked = linkedGradingSetIds.has(gradingSet.id);
                    const total = getGradingSetTotal(gradingSet.id);
                    const totalValid = isPercentageTotalValid(total);
                    const levelOwner = linkedGradingLevels.get(gradingSet.level);
                    const levelTaken =
                      !checked && Boolean(levelOwner && levelOwner.id !== gradingSet.id);
                    const blockedReason = levelTaken
                      ? `${levelOwner?.name} already covers the "${gradingSet.level}" level`
                      : !checked && !totalValid
                        ? `Criteria total ${formatPercentage(total)}; must be 100%`
                        : undefined;

                    return (
                      <label
                        className="acl-tree-row is-leaf"
                        key={gradingSet.id}
                        title={blockedReason}
                      >
                        <input
                          checked={checked}
                          disabled={
                            linkingId === gradingSet.id ||
                            !selectedSetId ||
                            Boolean(blockedReason)
                          }
                          onChange={(event) =>
                            void handleToggleGradingSetLink(
                              gradingSet,
                              event.target.checked,
                            )
                          }
                          type="checkbox"
                        />
                        <span className="acl-tree-label">
                          {gradingSet.name}
                          {" · "}
                          <span className={getLevelClass(gradingSet.level)}>
                            {gradingSet.level}
                          </span>
                          {` · pass ${formatOptionalNumber(gradingSet.passing_score)} · `}
                          <span
                            className={
                              totalValid
                                ? "grading-total-pill is-valid"
                                : "grading-total-pill is-invalid"
                            }
                          >
                            {formatPercentage(total)}
                          </span>
                          {blockedReason ? (
                            <span className="grading-blocked-note"> · {blockedReason}</span>
                          ) : null}
                        </span>
                        <span className="acl-tree-id">{gradingSet.grading_code}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>
        </>
      ) : null}

      {activeTab === "criteria" ? (
        <>
          <Card className="requirements-data-card">
            <form
              className="requirements-data-form"
              id="criteria-form"
              onSubmit={(event) => void handleSubmitCriteria(event)}
            >
              <div className="requirements-data-grid">
                <label className="requirements-data-field is-full-width">
                  <span>Name</span>
                  <input
                    onChange={(event) => {
                      const name = event.target.value;
                      setCriteriaForm((current) => ({
                        ...current,
                        name,
                        code: editingCriteriaId ? current.code : buildCodeFromName(name),
                      }));
                    }}
                    placeholder="Criteria name"
                    required
                    type="text"
                    value={criteriaForm.name}
                  />
                </label>

                <label className="requirements-data-field">
                  <span>Code</span>
                  <input
                    onChange={(event) =>
                      setCriteriaForm((current) => ({
                        ...current,
                        code: event.target.value,
                      }))
                    }
                    placeholder="e.g. productivity_junior"
                    required
                    type="text"
                    value={criteriaForm.code}
                  />
                </label>

                <label className="requirements-data-field">
                  <span>Level</span>
                  <div className="requirements-data-select-wrap">
                    <select
                      onChange={(event) =>
                        setCriteriaForm((current) => ({
                          ...current,
                          level: event.target.value as RequirementLevel,
                        }))
                      }
                      required
                      value={criteriaForm.level}
                    >
                      {LEVEL_OPTIONS.map((level) => (
                        <option key={level} value={level}>
                          {level}
                        </option>
                      ))}
                    </select>
                    <SelectArrow />
                  </div>
                </label>

                <label className="requirements-data-field">
                  <span>Type</span>
                  <div className="requirements-data-select-wrap">
                    <select
                      onChange={(event) => {
                        const nextType = event.target.value as CriteriaType;
                        setCriteriaForm((current) => ({
                          ...current,
                          type: nextType,
                          ...(nextType === "manual"
                            ? {
                                min: current.min || "0",
                                max: current.max || "100",
                                value: current.value || "75",
                              }
                            : {}),
                        }));
                      }}
                      required
                      value={criteriaForm.type}
                    >
                      {TYPE_OPTIONS.map((type) => (
                        <option key={type} value={type}>
                          {formatTypeLabel(type)}
                        </option>
                      ))}
                    </select>
                    <SelectArrow />
                  </div>
                  {criteriaForm.type === "manual" ? (
                    <span className="grading-default-note">
                      Scored 0–100 per member in Story Points → Encode → Manual Criteria.
                    </span>
                  ) : null}
                </label>

                <label className="requirements-data-field">
                  <span>Min</span>
                  <input
                    onChange={(event) =>
                      setCriteriaForm((current) => ({
                        ...current,
                        min: event.target.value,
                      }))
                    }
                    placeholder="0"
                    required
                    type="text"
                    value={criteriaForm.min}
                  />
                </label>

                <label className="requirements-data-field">
                  <span>Max</span>
                  <input
                    onChange={(event) =>
                      setCriteriaForm((current) => ({
                        ...current,
                        max: event.target.value,
                      }))
                    }
                    placeholder="100"
                    required
                    type="text"
                    value={criteriaForm.max}
                  />
                </label>

                <label className="requirements-data-field">
                  <span>Value</span>
                  <input
                    onChange={(event) =>
                      setCriteriaForm((current) => ({
                        ...current,
                        value: event.target.value,
                      }))
                    }
                    placeholder="75"
                    required
                    type="text"
                    value={criteriaForm.value}
                  />
                </label>

                <label className="requirements-data-field">
                  <span>Default %</span>
                  <input
                    onChange={(event) =>
                      setCriteriaForm((current) => ({
                        ...current,
                        weight: event.target.value,
                      }))
                    }
                    placeholder="30"
                    required
                    type="text"
                    value={criteriaForm.weight}
                  />
                </label>

                <label className="requirements-data-field">
                  <span>Sort Number</span>
                  <input
                    onChange={(event) =>
                      setCriteriaForm((current) => ({
                        ...current,
                        sort_number: event.target.value,
                      }))
                    }
                    placeholder="1"
                    required
                    type="text"
                    value={criteriaForm.sort_number}
                  />
                </label>
              </div>

              <div className="requirements-data-actions requirements-data-modal-actions">
                {editingCriteriaId ? (
                  <button
                    className="requirements-data-cancel-button"
                    disabled={saving}
                    onClick={cancelEditCriteria}
                    type="button"
                  >
                    Cancel
                  </button>
                ) : null}
                <button
                  className="requirements-data-submit"
                  disabled={saving || loading}
                  type="submit"
                >
                  {saving ? (
                    <>
                      <span
                        className="requirements-data-loader"
                        style={{ borderTopColor: Palette.cyan }}
                      />
                      {editingCriteriaId ? "Saving" : "Creating"}
                    </>
                  ) : editingCriteriaId ? (
                    "Save Changes"
                  ) : (
                    "Create Criteria"
                  )}
                </button>
              </div>
            </form>
          </Card>

          <Card className="requirements-data-card requirements-data-table-card">
            <div className="requirements-data-table-header">
              <div>
                <div className="requirements-data-kicker">Criteria Table</div>
                <h3>All Criteria</h3>
              </div>
              <div className="requirements-data-table-tools">
                <label className="requirements-data-filter-field">
                  <span>Search</span>
                  <input
                    aria-label="Search criteria by name or code"
                    onChange={(event) => setCriteriaSearch(event.target.value)}
                    placeholder="Name or code"
                    type="text"
                    value={criteriaSearch}
                  />
                </label>
                <label className="requirements-data-filter-field">
                  <span>Type</span>
                  <div className="requirements-data-select-wrap">
                    <select
                      aria-label="Filter criteria by type"
                      onChange={(event) =>
                        setCriteriaTypeFilter(event.target.value as CriteriaType | "")
                      }
                      value={criteriaTypeFilter}
                    >
                      <option value="">All Types</option>
                      {TYPE_OPTIONS.map((type) => (
                        <option key={type} value={type}>
                          {formatTypeLabel(type)}
                        </option>
                      ))}
                    </select>
                  </div>
                </label>
                <label className="requirements-data-filter-field">
                  <span>Level</span>
                  <div className="requirements-data-select-wrap">
                    <select
                      aria-label="Filter criteria by level"
                      onChange={(event) =>
                        setCriteriaLevelFilter(event.target.value as RequirementLevel | "")
                      }
                      value={criteriaLevelFilter}
                    >
                      <option value="">All Levels</option>
                      {LEVEL_OPTIONS.map((level) => (
                        <option key={level} value={level}>
                          {level}
                        </option>
                      ))}
                    </select>
                  </div>
                </label>
                <label className="requirements-data-filter-field">
                  <span>Grading Set</span>
                  <div className="requirements-data-select-wrap">
                    <select
                      aria-label="Filter criteria by grading set"
                      onChange={(event) => setCriteriaGradingSetFilter(event.target.value)}
                      value={criteriaGradingSetFilter}
                    >
                      <option value="">All Grading Sets</option>
                      <option value={UNASSIGNED_GRADING_SET_FILTER}>Not in any set</option>
                      {gradingSets.map((set) => (
                        <option key={set.id} value={set.id}>
                          {set.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </label>
                <span>
                  {hasCriteriaFilters
                    ? `${filteredCriteria.length} of ${criteria.length} records`
                    : `${criteria.length} records`}
                </span>
              </div>
            </div>

            {loading ? (
              <div className="requirements-data-empty">Loading criteria...</div>
            ) : filteredCriteria.length === 0 ? (
              <div className="requirements-data-empty">
                {hasCriteriaFilters ? "No criteria match the filters" : "No Data Found"}
              </div>
            ) : (
              <div className="requirements-data-table-wrap">
                <table className="requirements-data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Code</th>
                      <th>Level</th>
                      <th>Type</th>
                      <th>Min</th>
                      <th>Max</th>
                      <th>Value</th>
                      <th>Default %</th>
                      <th>Sort</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCriteria.map((row) => (
                      <tr
                        key={row.id}
                        className={
                          editingCriteriaId === row.id
                            ? "requirements-data-row is-selected"
                            : undefined
                        }
                      >
                        <td data-label="Name">{row.name}</td>
                        <td data-label="Code">{row.code}</td>
                        <td data-label="Level">
                          <span className={getLevelClass(row.level)}>{row.level}</span>
                        </td>
                        <td data-label="Type">
                          {row.type ? formatTypeLabel(row.type) : "-"}
                        </td>
                        <td data-label="Min">{formatOptionalNumber(row.min)}</td>
                        <td data-label="Max">{formatOptionalNumber(row.max)}</td>
                        <td data-label="Value">{formatOptionalNumber(row.value)}</td>
                        <td data-label="Default %">{formatOptionalNumber(row.weight)}</td>
                        <td data-label="Sort">{formatOptionalNumber(row.sort_number)}</td>
                        <td data-label="Actions">
                          <div className="requirements-data-row-actions">
                            <button
                              className="requirements-data-row-button"
                              onClick={() => startEditCriteria(row)}
                              title="Edit"
                              type="button"
                            >
                              Edit
                            </button>
                            <button
                              aria-label={`Delete ${row.name}`}
                              className="requirements-data-row-button is-danger"
                              disabled={deletingId === row.id}
                              onClick={() => void handleDeleteCriteria(row)}
                              title="Delete"
                              type="button"
                            >
                              {deletingId === row.id ? (
                                <span
                                  className="requirements-data-loader"
                                  style={{ borderTopColor: "#ff8d8d" }}
                                />
                              ) : (
                                "Delete"
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      ) : null}

      {activeTab === "grading-sets" ? (
        <>
          <Card className="requirements-data-card">
            <form
              className="requirements-data-form"
              id="grading-set-form"
              onSubmit={(event) => void handleSubmitGradingSet(event)}
            >
              <div className="requirements-data-grid">
                <label className="requirements-data-field">
                  <span>Name</span>
                  <input
                    onChange={(event) => {
                      const name = event.target.value;
                      setGradingForm((current) => ({
                        ...current,
                        name,
                        grading_code: editingGradingSetId
                          ? current.grading_code
                          : buildCodeFromName(name),
                      }));
                    }}
                    placeholder="e.g. Junior Set V2"
                    required
                    type="text"
                    value={gradingForm.name}
                  />
                </label>

                <label className="requirements-data-field">
                  <span>Grading Code</span>
                  <input
                    onChange={(event) =>
                      setGradingForm((current) => ({
                        ...current,
                        grading_code: event.target.value,
                      }))
                    }
                    placeholder="e.g. junior_set_v2"
                    required
                    type="text"
                    value={gradingForm.grading_code}
                  />
                </label>

                <label className="requirements-data-field">
                  <span>Level</span>
                  <div className="requirements-data-select-wrap">
                    <select
                      onChange={(event) =>
                        setGradingForm((current) => ({
                          ...current,
                          level: event.target.value as RequirementLevel,
                        }))
                      }
                      required
                      value={gradingForm.level}
                    >
                      {LEVEL_OPTIONS.map((level) => (
                        <option key={level} value={level}>
                          {level}
                        </option>
                      ))}
                    </select>
                    <SelectArrow />
                  </div>
                </label>

                <label className="requirements-data-field">
                  <span>Passing Score</span>
                  <input
                    onChange={(event) =>
                      setGradingForm((current) => ({
                        ...current,
                        passing_score: event.target.value,
                      }))
                    }
                    placeholder="75"
                    required
                    type="text"
                    value={gradingForm.passing_score}
                  />
                </label>
              </div>

              <div className="requirements-data-actions requirements-data-modal-actions">
                {editingGradingSetId ? (
                  <button
                    className="requirements-data-cancel-button"
                    disabled={saving}
                    onClick={cancelEditGradingSet}
                    type="button"
                  >
                    Cancel
                  </button>
                ) : null}
                <button
                  className="requirements-data-submit"
                  disabled={saving || loading}
                  type="submit"
                >
                  {saving ? (
                    <>
                      <span
                        className="requirements-data-loader"
                        style={{ borderTopColor: Palette.cyan }}
                      />
                      {editingGradingSetId ? "Saving" : "Creating"}
                    </>
                  ) : editingGradingSetId ? (
                    "Save Changes"
                  ) : (
                    "Create Grading Set"
                  )}
                </button>
              </div>
            </form>
          </Card>

          <Card className="requirements-data-card requirements-data-table-card">
            <div className="requirements-data-table-header">
              <div>
                <div className="requirements-data-kicker">Grading Sets</div>
                <h3>All Grading Sets</h3>
              </div>
              <span>{gradingSets.length} records</span>
            </div>

            {loading ? (
              <div className="requirements-data-empty">Loading grading sets...</div>
            ) : gradingSets.length === 0 ? (
              <div className="requirements-data-empty">No Data Found</div>
            ) : (
              <div className="requirements-data-table-wrap">
                <table className="requirements-data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Code</th>
                      <th>Level</th>
                      <th>Passing</th>
                      <th>Criteria</th>
                      <th>Total %</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gradingSets.map((set) => {
                      const total = getGradingSetTotal(set.id);

                      return (
                        <tr
                          key={set.id}
                          className={
                            selectedGradingSetId === set.id
                              ? "requirements-data-row is-selected"
                              : undefined
                          }
                        >
                          <td data-label="Name">{set.name}</td>
                          <td data-label="Code">{set.grading_code}</td>
                          <td data-label="Level">
                            <span className={getLevelClass(set.level)}>{set.level}</span>
                          </td>
                          <td data-label="Passing">
                            {formatOptionalNumber(set.passing_score)}
                          </td>
                          <td data-label="Criteria">
                            {getGradingSetCriteriaCount(set.id)}
                          </td>
                          <td data-label="Total %">
                            <span
                              className={
                                isPercentageTotalValid(total)
                                  ? "grading-total-pill is-valid"
                                  : "grading-total-pill is-invalid"
                              }
                            >
                              {formatPercentage(total)}
                            </span>
                          </td>
                          <td data-label="Actions">
                            <div className="requirements-data-row-actions">
                              <button
                                className="requirements-data-row-button"
                                onClick={() => setSelectedGradingSetId(set.id)}
                                title="Manage criteria"
                                type="button"
                              >
                                Select
                              </button>
                              <button
                                className="requirements-data-row-button"
                                onClick={() => startEditGradingSet(set)}
                                title="Edit"
                                type="button"
                              >
                                Edit
                              </button>
                              <button
                                aria-label={`Delete ${set.name}`}
                                className="requirements-data-row-button is-danger"
                                disabled={deletingId === set.id}
                                onClick={() => void handleDeleteGradingSet(set)}
                                title="Delete"
                                type="button"
                              >
                                {deletingId === set.id ? (
                                  <span
                                    className="requirements-data-loader"
                                    style={{ borderTopColor: "#ff8d8d" }}
                                  />
                                ) : (
                                  "Delete"
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="requirements-data-card requirements-data-table-card">
            <div className="requirements-data-table-header">
              <div>
                <div className="requirements-data-kicker">Grading Set Criteria</div>
                <h3>
                  {selectedGradingSet
                    ? `Criteria in ${selectedGradingSet.name}`
                    : "Select a grading set"}
                </h3>
              </div>
              <label className="requirements-data-filter-field">
                <span>Grading Set</span>
                <div className="requirements-data-select-wrap">
                  <select
                    disabled={loading || gradingSets.length === 0}
                    onChange={(event) => setSelectedGradingSetId(event.target.value)}
                    value={selectedGradingSetId}
                  >
                    {gradingSets.length === 0 ? (
                      <option value="">No grading sets</option>
                    ) : (
                      gradingSets.map((set) => (
                        <option key={set.id} value={set.id}>
                          {set.name} ({set.level})
                        </option>
                      ))
                    )}
                  </select>
                  <SelectArrow />
                </div>
              </label>
            </div>

            {!selectedGradingSet ? (
              <div className="requirements-data-empty">
                Select a grading set to add criteria.
              </div>
            ) : loading ? (
              <div className="requirements-data-empty">Loading criteria...</div>
            ) : selectedGradingCriteria.length === 0 ? (
              <div className="requirements-data-empty">
                No criteria for the "{selectedGradingSet.level}" level. Create some in the
                Criteria tab.
              </div>
            ) : (
              <div className="acl-tree">
                <div className="acl-tree-toolbar">
                  <span>{selectedGradingLinksByCriteriaId.size} criteria added</span>
                  <span
                    className={
                      isPercentageTotalValid(selectedGradingTotal)
                        ? "grading-total-pill is-valid"
                        : "grading-total-pill is-invalid"
                    }
                  >
                    Total {formatPercentage(selectedGradingTotal)}
                    {isPercentageTotalValid(selectedGradingTotal)
                      ? ""
                      : " · must equal 100%"}
                  </span>
                </div>
                <div className="acl-tree-panel">
                  {selectedGradingCriteria.map((row) => {
                    const link = selectedGradingLinksByCriteriaId.get(row.id);
                    const checked = Boolean(link);
                    const draft = link ? percentageDrafts[link.id] : undefined;

                    return (
                      <div className="acl-tree-row is-leaf grading-criteria-row" key={row.id}>
                        <input
                          aria-label={`Include ${row.name}`}
                          checked={checked}
                          disabled={linkingId === row.id}
                          onChange={(event) =>
                            void handleToggleGradingCriteria(row, event.target.checked)
                          }
                          type="checkbox"
                        />
                        <span className="acl-tree-label">
                          {row.name}
                          {" · "}
                          <span className={getLevelClass(row.level)}>{row.level}</span>
                          {row.type ? ` · ${formatTypeLabel(row.type)}` : ""}
                        </span>
                        <label className="grading-percentage-field">
                          <input
                            aria-label={`${row.name} percentage`}
                            disabled={!link || linkingId === row.id}
                            inputMode="decimal"
                            onBlur={() => {
                              if (link) void handleSavePercentage(link);
                            }}
                            onChange={(event) => {
                              if (!link) return;
                              const value = event.target.value;
                              setPercentageDrafts((current) => ({
                                ...current,
                                [link.id]: value,
                              }));
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.currentTarget.blur();
                              }
                            }}
                            placeholder="-"
                            type="text"
                            value={
                              link
                                ? (draft ?? String(clampPercentage(link.percentage)))
                                : ""
                            }
                          />
                          <span>%</span>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
