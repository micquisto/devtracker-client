import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Card } from "@/components/shared/Containers";
import { Title } from "@/components/shared/page";
import {
  deleteSupabaseRows,
  getSupabaseRows,
  insertSupabaseRows,
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

type CriteriaSetLinkRow = {
  id: string;
  set_id: string;
  criteria_id: string;
};

type CriteriaSetLinkInsertRow = {
  set_id: string;
  criteria_id: string;
};

type GradingSetRow = {
  id: string;
  name: string;
  grading_code: string;
  created_at?: string;
  updated_at?: string;
};

type GradingSetInsertRow = {
  name: string;
  grading_code: string;
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
];

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
};

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

export default function CriteriaGradingSetsPage() {
  const [activeTab, setActiveTab] = useState<PageTab>("criteria-sets");
  const [criteriaSets, setCriteriaSets] = useState<CriteriaSetRow[]>([]);
  const [criteria, setCriteria] = useState<CriteriaRow[]>([]);
  const [gradingSets, setGradingSets] = useState<GradingSetRow[]>([]);
  const [setLinks, setSetLinks] = useState<CriteriaSetLinkRow[]>([]);
  const [selectedSetId, setSelectedSetId] = useState("");
  const [setForm, setSetForm] = useState<CriteriaSetFormState>(INITIAL_SET_FORM);
  const [criteriaForm, setCriteriaForm] =
    useState<CriteriaFormState>(INITIAL_CRITERIA_FORM);
  const [gradingForm, setGradingForm] =
    useState<GradingSetFormState>(INITIAL_GRADING_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const linkedCriteriaIds = new Set(
    setLinks
      .filter((link) => link.set_id === selectedSetId)
      .map((link) => link.criteria_id),
  );
  const selectedSet = criteriaSets.find((set) => set.id === selectedSetId) ?? null;

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      const [sets, criteriaRows, gradingRows, links] = await Promise.all([
        getSupabaseRows<CriteriaSetRow>("critera_set", {
          select: "id,set_name,set_code,version,created_at,updated_at",
          order: { column: "set_code", ascending: true },
        }),
        getSupabaseRows<CriteriaRow>("criteria", {
          select: "id,name,code,level,type,min,max,value,weight,sort_number",
          order: { column: "sort_number", ascending: true },
        }),
        getSupabaseRows<GradingSetRow>("grading_set", {
          select: "id,name,grading_code,created_at,updated_at",
          order: { column: "grading_code", ascending: true },
        }),
        getSupabaseRows<CriteriaSetLinkRow>("criteria_set_criteria", {
          select: "id,set_id,criteria_id",
        }),
      ]);

      setCriteriaSets(sets);
      setCriteria(criteriaRows);
      setGradingSets(gradingRows);
      setSetLinks(links);
      setSelectedSetId((current) => {
        if (current && sets.some((set) => set.id === current)) return current;
        return sets[0]?.id ?? "";
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

  async function handleCreateSet(event: FormEvent<HTMLFormElement>): Promise<void> {
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
          : "Unable to create criteria set.",
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

  async function handleToggleCriteriaLink(criteriaId: string, checked: boolean): Promise<void> {
    if (!selectedSetId) return;

    setLinkingId(criteriaId);
    clearMessages();

    try {
      if (checked) {
        const [created] = await insertSupabaseRows<
          CriteriaSetLinkRow,
          CriteriaSetLinkInsertRow
        >(
          "criteria_set_criteria",
          { set_id: selectedSetId, criteria_id: criteriaId },
          "id,set_id,criteria_id",
        );

        if (created) {
          setSetLinks((current) => [...current, created]);
        }
        setSuccess("Linked criteria to set.");
      } else {
        const existing = setLinks.find(
          (link) => link.set_id === selectedSetId && link.criteria_id === criteriaId,
        );

        if (existing) {
          await deleteSupabaseRows<CriteriaSetLinkRow>("criteria_set_criteria", {
            eq: { id: existing.id },
            select: "id",
          });
          setSetLinks((current) => current.filter((link) => link.id !== existing.id));
        }

        setSuccess("Unlinked criteria from set.");
      }
    } catch (linkError) {
      setError(
        linkError instanceof Error
          ? linkError.message
          : "Unable to update criteria set links.",
      );
    } finally {
      setLinkingId(null);
    }
  }

  async function handleCreateCriteria(
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
          : "Unable to create criteria.",
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

  async function handleCreateGradingSet(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setSaving(true);
    clearMessages();

    try {
      const row: GradingSetInsertRow = {
        name: gradingForm.name.trim(),
        grading_code: gradingForm.grading_code.trim(),
      };

      if (!row.name || !row.grading_code) {
        throw new Error("Name and grading code are required.");
      }

      const [created] = await insertSupabaseRows<GradingSetRow, GradingSetInsertRow>(
        "grading_set",
        row,
        "id,name,grading_code,created_at,updated_at",
      );

      setGradingForm(INITIAL_GRADING_FORM);
      await loadAll();
      setSuccess(
        created ? `Created grading set ${created.name}.` : "Created grading set.",
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to create grading set.",
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
        subtitle="Manage evaluation criteria, criteria sets, and grading sets used by sprint scoring."
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
              onSubmit={(event) => void handleCreateSet(event)}
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
                        set_code: buildCodeFromName(set_name),
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
                    required
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

              <div className="requirements-data-actions">
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
                      Creating
                    </>
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
                      <th>Linked</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {criteriaSets.map((set) => {
                      const linkedCount = setLinks.filter(
                        (link) => link.set_id === set.id,
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
                          <td data-label="Name">{set.set_name}</td>
                          <td data-label="Code">{set.set_code}</td>
                          <td data-label="Version">{set.version}</td>
                          <td data-label="Linked">{linkedCount}</td>
                          <td data-label="Actions">
                            <div className="requirements-data-row-actions">
                              <button
                                className="requirements-data-row-button"
                                onClick={() => setSelectedSetId(set.id)}
                                title="Manage links"
                                type="button"
                              >
                                Select
                              </button>
                              <button
                                aria-label={`Delete ${set.set_name}`}
                                className="requirements-data-row-button is-danger"
                                disabled={deletingId === set.id}
                                onClick={() => void handleDeleteSet(set)}
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
                <div className="requirements-data-kicker">Set Links</div>
                <h3>
                  {selectedSet
                    ? `Criteria in ${selectedSet.set_name}`
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
              <div className="requirements-data-empty">Select a criteria set to link criteria.</div>
            ) : loading ? (
              <div className="requirements-data-empty">Loading criteria...</div>
            ) : criteria.length === 0 ? (
              <div className="requirements-data-empty">No criteria available to link.</div>
            ) : (
              <div className="acl-tree">
                <div className="acl-tree-toolbar">
                  <span>{linkedCriteriaIds.size} criteria linked</span>
                  <span>{selectedSet?.set_code}</span>
                </div>
                <div className="acl-tree-panel">
                  {criteria.map((row) => {
                    const checked = linkedCriteriaIds.has(row.id);

                    return (
                      <label className="acl-tree-row is-leaf" key={row.id}>
                        <input
                          checked={checked}
                          disabled={linkingId === row.id || !selectedSetId}
                          onChange={(event) =>
                            void handleToggleCriteriaLink(row.id, event.target.checked)
                          }
                          type="checkbox"
                        />
                        <span className="acl-tree-label">
                          {row.name}
                          {" · "}
                          <span className={getLevelClass(row.level)}>{row.level}</span>
                          {row.type ? ` · ${formatTypeLabel(row.type)}` : ""}
                        </span>
                        <span className="acl-tree-id">{row.code}</span>
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
              onSubmit={(event) => void handleCreateCriteria(event)}
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
                        code: buildCodeFromName(name),
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
                      onChange={(event) =>
                        setCriteriaForm((current) => ({
                          ...current,
                          type: event.target.value as CriteriaType,
                        }))
                      }
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
                  <span>Weight</span>
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

              <div className="requirements-data-actions">
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
                      Creating
                    </>
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
              <span>{criteria.length} records</span>
            </div>

            {loading ? (
              <div className="requirements-data-empty">Loading criteria...</div>
            ) : criteria.length === 0 ? (
              <div className="requirements-data-empty">No Data Found</div>
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
                      <th>Weight</th>
                      <th>Sort</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {criteria.map((row) => (
                      <tr key={row.id}>
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
                        <td data-label="Weight">{formatOptionalNumber(row.weight)}</td>
                        <td data-label="Sort">{formatOptionalNumber(row.sort_number)}</td>
                        <td data-label="Actions">
                          <div className="requirements-data-row-actions">
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
              onSubmit={(event) => void handleCreateGradingSet(event)}
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
                        grading_code: buildCodeFromName(name),
                      }));
                    }}
                    placeholder="Grading set name"
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
                    placeholder="e.g. default"
                    required
                    type="text"
                    value={gradingForm.grading_code}
                  />
                </label>
              </div>

              <div className="requirements-data-actions">
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
                      Creating
                    </>
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
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gradingSets.map((set) => (
                      <tr key={set.id}>
                        <td data-label="Name">{set.name}</td>
                        <td data-label="Code">{set.grading_code}</td>
                        <td data-label="Actions">
                          <div className="requirements-data-row-actions">
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
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
