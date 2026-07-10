import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Card } from "@/components/shared/Containers";
import { StyledSelect } from "@/components/shared/Elements";
import SprintGroupedSelect from "@/components/scrum/sprint/SprintGroupedSelect";
import { SectionTitle } from "@/components/shared/Sections";
import { getBackgroundProcessErrorMessage } from "@/lib/backgroundProcesses/backgroundProcess.errors";
import { formatAverage } from "@/lib/helper";
import { Background, Border, Palette, Text } from "@/lib/theme";
import {
  buildStoryPointsEncodeDraftRows,
  buildStoryPointsEncodeBreakdownDraftRows,
  buildStoryPointsEncodeProfessionalismDraftRows,
  buildStoryPointsEncodeSprintDraft,
  buildStoryPointsPageDataForYear,
  formatStoryPointsCell,
  formatStoryPointsSprintOptionLabel,
  getDefaultStoryPointsYear,
  getStoryPointsAvailableYears,
  getStoryPointsEncodeSprintsForYear,
  loadStoryPointsEncodeBreakdownData,
  loadStoryPointsEncodeData,
  loadStoryPointsEncodeProfessionalismData,
  loadStoryPointsPageSourceData,
  parseStoryPointsEncodeCountValue,
  parseStoryPointsEncodeInputValue,
  parseStoryPointsEncodeNullableInputValue,
  saveStoryPointsEncodeBreakdownData,
  saveStoryPointsEncodeData,
  saveStoryPointsEncodeProfessionalismData,
  saveStoryPointsEncodeStoryPoints,
  type ProfessionalismItemColumn,
  type StoryPointsEncodeBreakdownDraftRow,
  type StoryPointsEncodeBreakdownProjectColumn,
  type StoryPointsEncodeDraftRow,
  type StoryPointsEncodeProfessionalismDraftRow,
  type StoryPointsEncodeSprintDraft,
  type StoryPointsEncodeSprintFieldKey,
  type StoryPointsPageData,
  type StoryPointsPageSourceData,
} from "@/lib/utils";
import "@/assets/styles/StoryPoints.page.css";

const EMPTY_SPRINT_ENCODE_DRAFT: StoryPointsEncodeSprintDraft = {
  plannedStoryPointsInput: "0",
  adhocStoryPointsInput: "0",
  completedStoryPointsInput: "0",
  plannedTasksCountInput: "0",
  adhocTasksCountInput: "0",
  rejectCountInput: "0",
  blockedTasksCountInput: "0",
};

const SPRINT_ENCODE_FIELDS: Array<{
  key: StoryPointsEncodeSprintFieldKey;
  label: string;
  inputMode: "decimal" | "numeric";
}> = [
  {
    key: "plannedStoryPointsInput",
    label: "Planned Story Points",
    inputMode: "decimal",
  },
  {
    key: "adhocStoryPointsInput",
    label: "Adhoc Story Points",
    inputMode: "decimal",
  },
  {
    key: "completedStoryPointsInput",
    label: "Completed Story Points",
    inputMode: "decimal",
  },
  {
    key: "plannedTasksCountInput",
    label: "Planned Tasks Count",
    inputMode: "numeric",
  },
  {
    key: "adhocTasksCountInput",
    label: "Adhoc Tasks Count",
    inputMode: "numeric",
  },
  {
    key: "rejectCountInput",
    label: "Reject Count",
    inputMode: "numeric",
  },
  {
    key: "blockedTasksCountInput",
    label: "Blocked Tasks Count",
    inputMode: "numeric",
  },
];

const SPRINT_ENCODE_STORY_POINT_FIELDS = SPRINT_ENCODE_FIELDS.slice(0, 3);
const SPRINT_ENCODE_COUNT_FIELDS = SPRINT_ENCODE_FIELDS.slice(3);

function sumEncodeInputValue(value: string): number {
  try {
    return parseStoryPointsEncodeInputValue(value);
  } catch {
    return 0;
  }
}

function sumEncodeCountInputValue(value: string): number {
  try {
    return parseStoryPointsEncodeCountValue(value);
  } catch {
    return 0;
  }
}

function formatMemberSprintTotalDisplay(
  membersTotal: number,
  sprintTotal: number | null,
): string {
  const membersLabel = formatStoryPointsCell(membersTotal);

  if (sprintTotal === null) {
    return `${membersLabel}/—`;
  }

  return `${membersLabel}/${formatStoryPointsCell(sprintTotal)}`;
}

function parseEncodeSprintStoryPointTotal(
  value: string,
): number | null {
  try {
    return parseStoryPointsEncodeInputValue(value);
  } catch {
    return null;
  }
}

function parseEncodeSprintCountTotal(value: string): number | null {
  try {
    return parseStoryPointsEncodeCountValue(value);
  } catch {
    return null;
  }
}

function encodeStoryPointsEqual(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.001;
}

function buildMemberCompletedTasksValidation(
  row: StoryPointsEncodeDraftRow,
): string | null {
  const plannedSp = sumEncodeInputValue(row.plannedInput);
  const adhocSp = sumEncodeInputValue(row.adhocInput);
  const completedSp = sumEncodeInputValue(row.completedInput);
  const plannedTasks = sumEncodeCountInputValue(row.plannedTasksInput);
  const adhocTasks = sumEncodeCountInputValue(row.adhocTasksInput);
  const completedTasks = sumEncodeCountInputValue(row.completedTasksInput);
  const totalSp = plannedSp + adhocSp;
  const totalTasks = plannedTasks + adhocTasks;
  const completedTasksLabel = formatStoryPointsCell(completedTasks);
  const totalTasksLabel = formatStoryPointsCell(totalTasks);

  if (encodeStoryPointsEqual(completedSp, totalSp)) {
    if (completedTasks === totalTasks) {
      return null;
    }

    if (completedTasks < totalTasks) {
      return `${row.name}: Completed Tasks (${completedTasksLabel}) is less than Planned Tasks + Adhoc Tasks (${totalTasksLabel}).`;
    }

    return `${row.name}: Completed Tasks (${completedTasksLabel}) is greater than Planned Tasks + Adhoc Tasks (${totalTasksLabel}).`;
  }

  if (completedSp < totalSp && completedTasks > totalTasks) {
    return `${row.name}: Completed Tasks (${completedTasksLabel}) is greater than Planned Tasks + Adhoc Tasks (${totalTasksLabel}).`;
  }

  return null;
}

function buildMemberCompletedSpValidation(
  row: StoryPointsEncodeDraftRow,
): string | null {
  const plannedSp = sumEncodeInputValue(row.plannedInput);
  const adhocSp = sumEncodeInputValue(row.adhocInput);
  const completedSp = sumEncodeInputValue(row.completedInput);
  const totalSp = plannedSp + adhocSp;

  if (encodeStoryPointsEqual(completedSp, totalSp) || completedSp < totalSp) {
    return null;
  }

  const completedSpLabel = formatStoryPointsCell(completedSp);
  const totalSpLabel = formatStoryPointsCell(totalSp);

  return `${row.name}: Completed SP (${completedSpLabel}) is greater than Planned SP + Adhoc SP (${totalSpLabel}).`;
}

const EMPTY_PAGE_DATA: StoryPointsPageData = {
  sprintColumns: [],
  assigneeRows: [],
  sprintTotals: [],
  totalAverage: 0,
  breakdownRows: [],
};

type EncodeActiveTab = "sprint" | "members" | "professionalism" | "breakdown";

function measureColumnWidth(cells: HTMLElement[]): number {
  return cells.reduce(
    (maxWidth, cell) => Math.max(maxWidth, Math.ceil(cell.scrollWidth)),
    0,
  );
}

function syncStoryPointsStickyColumns(
  storyPointsTable: HTMLTableElement | null,
  breakdownTable: HTMLTableElement | null,
): void {
  const tables = [storyPointsTable, breakdownTable].filter(
    (table): table is HTMLTableElement => table !== null,
  );

  if (tables.length === 0) {
    return;
  }

  tables.forEach((table) => {
    table.style.removeProperty("--story-points-assignee-width");
    table.style.removeProperty("--story-points-average-width");

    table
      .querySelectorAll<HTMLElement>(
        "th.story-points-assignee, td.story-points-assignee, th.story-points-average, td.story-points-average",
      )
      .forEach((cell) => {
        cell.style.width = "";
        cell.style.minWidth = "";
      });
  });

  tables.forEach((table) => {
    const assigneeCells = Array.from(
      table.querySelectorAll<HTMLElement>(
        "th.story-points-assignee, td.story-points-assignee",
      ),
    );
    const averageCells = Array.from(
      table.querySelectorAll<HTMLElement>(
        "th.story-points-average, td.story-points-average",
      ),
    );

    const assigneeWidth = measureColumnWidth(assigneeCells);
    const averageWidth = measureColumnWidth(averageCells);

    if (assigneeWidth > 0) {
      const width = `${assigneeWidth}px`;
      table.style.setProperty("--story-points-assignee-width", width);
      assigneeCells.forEach((cell) => {
        cell.style.width = width;
        cell.style.minWidth = width;
      });
    }

    if (averageWidth > 0) {
      const width = `${averageWidth}px`;
      table.style.setProperty("--story-points-average-width", width);
      averageCells.forEach((cell) => {
        cell.style.width = width;
        cell.style.minWidth = width;
      });
    }
  });
}

export default function StoryPointsPage() {
  const [sourceData, setSourceData] = useState<StoryPointsPageSourceData | null>(
    null,
  );
  const [selectedYear, setSelectedYear] = useState("");
  const [encodeModalOpen, setEncodeModalOpen] = useState(false);
  const [encodeSprintId, setEncodeSprintId] = useState("");
  const [encodeSprintDraft, setEncodeSprintDraft] =
    useState<StoryPointsEncodeSprintDraft>(EMPTY_SPRINT_ENCODE_DRAFT);
  const [encodeRows, setEncodeRows] = useState<StoryPointsEncodeDraftRow[]>([]);
  const [encodeBreakdownColumns, setEncodeBreakdownColumns] = useState<
    StoryPointsEncodeBreakdownProjectColumn[]
  >([]);
  const [encodeBreakdownRows, setEncodeBreakdownRows] = useState<
    StoryPointsEncodeBreakdownDraftRow[]
  >([]);
  const [encodeProfessionalismColumns, setEncodeProfessionalismColumns] =
    useState<ProfessionalismItemColumn[]>([]);
  const [encodeProfessionalismRows, setEncodeProfessionalismRows] = useState<
    StoryPointsEncodeProfessionalismDraftRow[]
  >([]);
  const [encodeLoading, setEncodeLoading] = useState(false);
  const [encodeSaving, setEncodeSaving] = useState(false);
  const [encodeSaveSuccess, setEncodeSaveSuccess] = useState<string | null>(null);
  const [encodeError, setEncodeError] = useState<string | null>(null);
  const [encodeActiveTab, setEncodeActiveTab] = useState<EncodeActiveTab>("sprint");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const storyPointsTableRef = useRef<HTMLTableElement>(null);
  const breakdownTableRef = useRef<HTMLTableElement>(null);
  const skipEncodeLoadRef = useRef(false);

  const availableYears = useMemo(
    () => getStoryPointsAvailableYears(sourceData?.sprints ?? []),
    [sourceData],
  );

  const selectedYearNumber = useMemo(() => {
    const year = Number(selectedYear);
    return Number.isFinite(year) ? year : null;
  }, [selectedYear]);

  const encodeSprints = useMemo(
    () =>
      sourceData && selectedYearNumber !== null
        ? getStoryPointsEncodeSprintsForYear(
            sourceData.sprints,
            selectedYearNumber,
          )
        : [],
    [selectedYearNumber, sourceData],
  );

  useEffect(() => {
    setEncodeSprintId((currentSprintId) => {
      if (encodeSprints.length === 0) {
        return "";
      }

      if (encodeSprints.some((sprint) => sprint.id === currentSprintId)) {
        return currentSprintId;
      }

      return encodeSprints[0]?.id ?? "";
    });
  }, [encodeSprints]);

  const pageData = useMemo<StoryPointsPageData>(() => {
    if (!sourceData || !selectedYear) {
      return EMPTY_PAGE_DATA;
    }

    const year = Number(selectedYear);
    if (!Number.isFinite(year)) {
      return EMPTY_PAGE_DATA;
    }

    return buildStoryPointsPageDataForYear(sourceData, year);
  }, [selectedYear, sourceData]);

  useEffect(() => {
    let cancelled = false;

    async function loadTableData() {
      setLoading(true);
      setLoadError(null);

      try {
        const nextSourceData = await loadStoryPointsPageSourceData();
        const years = getStoryPointsAvailableYears(nextSourceData.sprints);
        const defaultYear = getDefaultStoryPointsYear(years);

        if (!cancelled) {
          setSourceData(nextSourceData);
          setSelectedYear(defaultYear ? String(defaultYear) : "");
        }
      } catch (error) {
        if (!cancelled) {
          setSourceData(null);
          setSelectedYear("");
          setLoadError(
            error instanceof Error
              ? error.message
              : "Unable to load story points data.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadTableData();

    return () => {
      cancelled = true;
    };
  }, []);

  const {
    sprintColumns,
    assigneeRows,
    sprintTotals,
    totalAverage,
    breakdownRows,
  } = pageData;
  const currentSprintBreakdownTotal =
    breakdownRows.find((row) => row.isTotal)?.values[0] ?? 0;

  useLayoutEffect(() => {
    if (loading) return;

    const scrollContainers = Array.from(
      document.querySelectorAll<HTMLElement>(".story-points-scroll"),
    );

    const sync = () => {
      requestAnimationFrame(() => {
        syncStoryPointsStickyColumns(
          storyPointsTableRef.current,
          breakdownTableRef.current,
        );
      });
    };

    sync();

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => sync())
        : null;

    scrollContainers.forEach((container) => {
      resizeObserver?.observe(container);
    });

    window.addEventListener("resize", sync);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [assigneeRows, breakdownRows, loading, sprintColumns.length]);

  const openEncodeModal = () => {
    setEncodeSprintDraft(EMPTY_SPRINT_ENCODE_DRAFT);
    setEncodeRows([]);
    setEncodeBreakdownColumns([]);
    setEncodeBreakdownRows([]);
    setEncodeProfessionalismColumns([]);
    setEncodeProfessionalismRows([]);
    setEncodeActiveTab("sprint");
    setEncodeError(null);
    setEncodeSaveSuccess(null);
    setEncodeModalOpen(true);
  };

  const closeEncodeModal = () => {
    if (encodeSaving) {
      return;
    }

    setEncodeModalOpen(false);
    setEncodeError(null);
    setEncodeSaveSuccess(null);
    setEncodeSprintDraft(EMPTY_SPRINT_ENCODE_DRAFT);
    setEncodeRows([]);
    setEncodeBreakdownColumns([]);
    setEncodeBreakdownRows([]);
    setEncodeProfessionalismColumns([]);
    setEncodeProfessionalismRows([]);
    setEncodeActiveTab("sprint");
  };

  useEffect(() => {
    if (!encodeModalOpen || !encodeSprintId || !sourceData) {
      return;
    }

    if (skipEncodeLoadRef.current) {
      skipEncodeLoadRef.current = false;
      return;
    }

    let cancelled = false;
    const members = sourceData.members;

    async function loadEncodeRows() {
      setEncodeLoading(true);
      setEncodeError(null);

      try {
        const [encodeData, breakdownData, professionalismData] =
          await Promise.all([
            loadStoryPointsEncodeData(encodeSprintId),
            loadStoryPointsEncodeBreakdownData(encodeSprintId),
            loadStoryPointsEncodeProfessionalismData(
              encodeSprintId,
              members,
            ),
          ]);

        if (!cancelled) {
          setEncodeSprintDraft(
            buildStoryPointsEncodeSprintDraft(encodeData.sprintScore),
          );
          setEncodeRows(
            buildStoryPointsEncodeDraftRows(
              members,
              encodeData.memberScores,
            ),
          );
          const breakdownDraft =
            buildStoryPointsEncodeBreakdownDraftRows(breakdownData);
          setEncodeBreakdownColumns(breakdownDraft.projectColumns);
          setEncodeBreakdownRows(breakdownDraft.rows);
          const professionalismDraft =
            buildStoryPointsEncodeProfessionalismDraftRows(professionalismData);
          setEncodeProfessionalismColumns(professionalismDraft.itemColumns);
          setEncodeProfessionalismRows(professionalismDraft.rows);
        }
      } catch (error) {
        if (!cancelled) {
          setEncodeSprintDraft(EMPTY_SPRINT_ENCODE_DRAFT);
          setEncodeRows([]);
          setEncodeBreakdownColumns([]);
          setEncodeBreakdownRows([]);
          setEncodeProfessionalismColumns([]);
          setEncodeProfessionalismRows([]);
          setEncodeError(
            error instanceof Error
              ? error.message
              : "Unable to load sprint encode data.",
          );
        }
      } finally {
        if (!cancelled) {
          setEncodeLoading(false);
        }
      }
    }

    void loadEncodeRows();

    return () => {
      cancelled = true;
    };
  }, [encodeModalOpen, encodeSprintId, sourceData]);

  useEffect(() => {
    setEncodeSaveSuccess(null);
  }, [encodeSprintId]);

  const updateSprintEncodeField = (
    field: StoryPointsEncodeSprintFieldKey,
    value: string,
  ) => {
    setEncodeSprintDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value,
    }));
  };

  const updateEncodeRowValue = (
    memberId: string,
    field:
      | "plannedInput"
      | "plannedTasksInput"
      | "adhocInput"
      | "adhocTasksInput"
      | "completedInput"
      | "completedTasksInput"
      | "rejectedInput"
      | "hoursInput"
      | "collaborationInput"
      | "completionOverrideInput",
    value: string,
  ) => {
    setEncodeRows((currentRows) =>
      currentRows.map((row) =>
        row.memberId === memberId ? { ...row, [field]: value } : row,
      ),
    );
  };

  const updateEncodeBreakdownValue = (
    projectTypeId: string,
    columnIndex: number,
    value: string,
  ) => {
    setEncodeBreakdownRows((currentRows) =>
      currentRows.map((row) => {
        if (row.projectTypeId !== projectTypeId) {
          return row;
        }

        const valueInputs = [...row.valueInputs];
        valueInputs[columnIndex] = value;

        return {
          ...row,
          valueInputs,
        };
      }),
    );
  };

  const updateEncodeProfessionalismValue = (
    memberId: string,
    columnIndex: number,
    value: string,
    maxValue: number,
  ) => {
    const trimmed = value.trim();
    let nextValue = trimmed;

    if (trimmed !== "") {
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed)) {
        return;
      }

      const cappedMax = Math.max(0, maxValue);
      const clamped = Math.min(Math.max(parsed, 0), cappedMax);
      nextValue = Number.isInteger(clamped)
        ? String(clamped)
        : String(Math.round(clamped * 100) / 100);
    }

    setEncodeProfessionalismRows((currentRows) =>
      currentRows.map((row) => {
        if (row.memberId !== memberId) {
          return row;
        }

        const scoreInputs = [...row.scoreInputs];
        scoreInputs[columnIndex] = nextValue;

        return {
          ...row,
          scoreInputs,
        };
      }),
    );
  };

  const encodeMemberTotals = useMemo(
    () =>
      encodeRows.reduce(
        (totals, row) => ({
          planned: totals.planned + sumEncodeInputValue(row.plannedInput),
          plannedTasks:
            totals.plannedTasks + sumEncodeInputValue(row.plannedTasksInput),
          adhoc: totals.adhoc + sumEncodeInputValue(row.adhocInput),
          adhocTasks:
            totals.adhocTasks + sumEncodeInputValue(row.adhocTasksInput),
          completed: totals.completed + sumEncodeInputValue(row.completedInput),
          completedTasks:
            totals.completedTasks +
            sumEncodeInputValue(row.completedTasksInput),
          rejected: totals.rejected + sumEncodeInputValue(row.rejectedInput),
          hours: totals.hours + sumEncodeInputValue(row.hoursInput),
          collaboration:
            totals.collaboration + sumEncodeInputValue(row.collaborationInput),
        }),
        {
          planned: 0,
          plannedTasks: 0,
          adhoc: 0,
          adhocTasks: 0,
          completed: 0,
          completedTasks: 0,
          rejected: 0,
          hours: 0,
          collaboration: 0,
        },
      ),
    [encodeRows],
  );

  const encodeMemberCollaborationAverage = useMemo(
    () =>
      encodeRows.length === 0
        ? 0
        : encodeMemberTotals.collaboration / encodeRows.length,
    [encodeMemberTotals.collaboration, encodeRows.length],
  );

  const encodeSprintTargetTotals = useMemo(
    () => ({
      planned: parseEncodeSprintStoryPointTotal(
        encodeSprintDraft.plannedStoryPointsInput,
      ),
      plannedTasks: parseEncodeSprintCountTotal(
        encodeSprintDraft.plannedTasksCountInput,
      ),
      adhoc: parseEncodeSprintStoryPointTotal(
        encodeSprintDraft.adhocStoryPointsInput,
      ),
      adhocTasks: parseEncodeSprintCountTotal(
        encodeSprintDraft.adhocTasksCountInput,
      ),
      completed: parseEncodeSprintStoryPointTotal(
        encodeSprintDraft.completedStoryPointsInput,
      ),
      rejected: parseEncodeSprintCountTotal(encodeSprintDraft.rejectCountInput),
    }),
    [encodeSprintDraft],
  );

  const encodeMembersPlannedSpValidation = useMemo(() => {
    let sprintPlanned: number;

    try {
      sprintPlanned = parseStoryPointsEncodeInputValue(
        encodeSprintDraft.plannedStoryPointsInput,
      );
    } catch {
      return null;
    }

    const membersPlannedTotal = encodeMemberTotals.planned;

    if (membersPlannedTotal === sprintPlanned) {
      return null;
    }

    const membersLabel = formatStoryPointsCell(membersPlannedTotal);
    const sprintLabel = formatStoryPointsCell(sprintPlanned);

    if (membersPlannedTotal < sprintPlanned) {
      return {
        message: `Members Planned SP (${membersLabel}) is less than Sprint Planned Story Points (${sprintLabel}).`,
      };
    }

    return {
      message: `Members Planned SP (${membersLabel}) is greater than Sprint Planned Story Points (${sprintLabel}).`,
    };
  }, [
    encodeMemberTotals.planned,
    encodeSprintDraft.plannedStoryPointsInput,
  ]);

  const encodeMembersPlannedTasksValidation = useMemo(() => {
    let sprintPlannedTasks: number;

    try {
      sprintPlannedTasks = parseStoryPointsEncodeCountValue(
        encodeSprintDraft.plannedTasksCountInput,
      );
    } catch {
      return null;
    }

    const membersPlannedTasksTotal = Math.round(encodeMemberTotals.plannedTasks);

    if (membersPlannedTasksTotal === sprintPlannedTasks) {
      return null;
    }

    const membersLabel = formatStoryPointsCell(membersPlannedTasksTotal);
    const sprintLabel = formatStoryPointsCell(sprintPlannedTasks);

    if (membersPlannedTasksTotal < sprintPlannedTasks) {
      return {
        message: `Members Planned Tasks (${membersLabel}) is less than Sprint Planned Tasks Count (${sprintLabel}).`,
      };
    }

    return {
      message: `Members Planned Tasks (${membersLabel}) is greater than Sprint Planned Tasks Count (${sprintLabel}).`,
    };
  }, [
    encodeMemberTotals.plannedTasks,
    encodeSprintDraft.plannedTasksCountInput,
  ]);

  const encodeMembersAdhocSpValidation = useMemo(() => {
    let sprintAdhoc: number;

    try {
      sprintAdhoc = parseStoryPointsEncodeInputValue(
        encodeSprintDraft.adhocStoryPointsInput,
      );
    } catch {
      return null;
    }

    const membersAdhocTotal = encodeMemberTotals.adhoc;

    if (membersAdhocTotal === sprintAdhoc) {
      return null;
    }

    const membersLabel = formatStoryPointsCell(membersAdhocTotal);
    const sprintLabel = formatStoryPointsCell(sprintAdhoc);

    if (membersAdhocTotal < sprintAdhoc) {
      return {
        message: `Members Adhoc SP (${membersLabel}) is less than Sprint Adhoc Story Points (${sprintLabel}).`,
      };
    }

    return {
      message: `Members Adhoc SP (${membersLabel}) is greater than Sprint Adhoc Story Points (${sprintLabel}).`,
    };
  }, [encodeMemberTotals.adhoc, encodeSprintDraft.adhocStoryPointsInput]);

  const encodeMembersAdhocTasksValidation = useMemo(() => {
    let sprintAdhocTasks: number;

    try {
      sprintAdhocTasks = parseStoryPointsEncodeCountValue(
        encodeSprintDraft.adhocTasksCountInput,
      );
    } catch {
      return null;
    }

    const membersAdhocTasksTotal = Math.round(encodeMemberTotals.adhocTasks);

    if (membersAdhocTasksTotal === sprintAdhocTasks) {
      return null;
    }

    const membersLabel = formatStoryPointsCell(membersAdhocTasksTotal);
    const sprintLabel = formatStoryPointsCell(sprintAdhocTasks);

    if (membersAdhocTasksTotal < sprintAdhocTasks) {
      return {
        message: `Members Adhoc Tasks (${membersLabel}) is less than Sprint Adhoc Tasks Count (${sprintLabel}).`,
      };
    }

    return {
      message: `Members Adhoc Tasks (${membersLabel}) is greater than Sprint Adhoc Tasks Count (${sprintLabel}).`,
    };
  }, [encodeMemberTotals.adhocTasks, encodeSprintDraft.adhocTasksCountInput]);

  const encodeMemberCompletedSpValidationMessages = useMemo(
    () =>
      encodeRows
        .map((row) => buildMemberCompletedSpValidation(row))
        .filter((message): message is string => message !== null),
    [encodeRows],
  );

  const encodeMemberCompletedTasksValidationMessages = useMemo(
    () =>
      encodeRows
        .map((row) => buildMemberCompletedTasksValidation(row))
        .filter((message): message is string => message !== null),
    [encodeRows],
  );

  const encodeMembersValidationMessages = useMemo(
    () =>
      [
        encodeMembersPlannedSpValidation?.message,
        encodeMembersPlannedTasksValidation?.message,
        encodeMembersAdhocSpValidation?.message,
        encodeMembersAdhocTasksValidation?.message,
        ...encodeMemberCompletedSpValidationMessages,
        ...encodeMemberCompletedTasksValidationMessages,
      ].filter((message): message is string => message !== undefined),
    [
      encodeMembersPlannedSpValidation,
      encodeMembersPlannedTasksValidation,
      encodeMembersAdhocSpValidation,
      encodeMembersAdhocTasksValidation,
      encodeMemberCompletedSpValidationMessages,
      encodeMemberCompletedTasksValidationMessages,
    ],
  );

  const isEncodeUpdateDisabled = useMemo(
    () =>
      encodeSaving ||
      encodeLoading ||
      encodeSprints.length === 0 ||
      encodeRows.length === 0 ||
      encodeMembersValidationMessages.length > 0,
    [
      encodeSaving,
      encodeLoading,
      encodeSprints.length,
      encodeRows.length,
      encodeMembersValidationMessages.length,
    ],
  );

  const encodeModalErrorMessages = useMemo(
    () =>
      [
        ...encodeMembersValidationMessages,
        ...(encodeError ? [encodeError] : []),
      ],
    [encodeError, encodeMembersValidationMessages],
  );

  const encodeBreakdownColumnTotals = useMemo(
    () =>
      encodeBreakdownColumns.map((_, columnIndex) =>
        encodeBreakdownRows.reduce(
          (sum, row) =>
            sum + sumEncodeInputValue(row.valueInputs[columnIndex] ?? "0"),
          0,
        ),
      ),
    [encodeBreakdownColumns, encodeBreakdownRows],
  );

  const encodeBreakdownRowTotals = useMemo(
    () =>
      encodeBreakdownRows.map((row) =>
        row.valueInputs.reduce(
          (sum, valueInput) => sum + sumEncodeInputValue(valueInput),
          0,
        ),
      ),
    [encodeBreakdownRows],
  );

  const encodeBreakdownGrandTotal = useMemo(
    () =>
      encodeBreakdownRowTotals.reduce((sum, rowTotal) => sum + rowTotal, 0),
    [encodeBreakdownRowTotals],
  );

  const encodeProfessionalismColumnAverages = useMemo(
    () =>
      encodeProfessionalismColumns.map((_, columnIndex) => {
        const values = encodeProfessionalismRows
          .map((row) => (row.scoreInputs[columnIndex] ?? "").trim())
          .filter((value) => value !== "")
          .map((value) => sumEncodeInputValue(value));

        if (values.length === 0) {
          return 0;
        }

        return values.reduce((sum, value) => sum + value, 0) / values.length;
      }),
    [encodeProfessionalismColumns, encodeProfessionalismRows],
  );

  const encodeProfessionalismRowTotals = useMemo(
    () =>
      encodeProfessionalismRows.map((row) =>
        row.scoreInputs.reduce(
          (sum, scoreInput) => sum + sumEncodeInputValue(scoreInput),
          0,
        ),
      ),
    [encodeProfessionalismRows],
  );

  const encodeProfessionalismTotalColumnAverage = useMemo(() => {
    if (encodeProfessionalismRowTotals.length === 0) {
      return 0;
    }

    return (
      encodeProfessionalismRowTotals.reduce((sum, total) => sum + total, 0) /
      encodeProfessionalismRowTotals.length
    );
  }, [encodeProfessionalismRowTotals]);

  const refreshStoryPointsFromDatabase = async (sprintId: string) => {
    const nextSourceData = await loadStoryPointsPageSourceData();
    const [encodeData, breakdownData, professionalismData] = await Promise.all([
      loadStoryPointsEncodeData(sprintId),
      loadStoryPointsEncodeBreakdownData(sprintId),
      loadStoryPointsEncodeProfessionalismData(
        sprintId,
        nextSourceData.members,
      ),
    ]);

    skipEncodeLoadRef.current = true;
    setSourceData(nextSourceData);
    setEncodeSprintDraft(
      buildStoryPointsEncodeSprintDraft(encodeData.sprintScore),
    );
    setEncodeRows(
      buildStoryPointsEncodeDraftRows(
        nextSourceData.members,
        encodeData.memberScores,
      ),
    );
    const breakdownDraft =
      buildStoryPointsEncodeBreakdownDraftRows(breakdownData);
    setEncodeBreakdownColumns(breakdownDraft.projectColumns);
    setEncodeBreakdownRows(breakdownDraft.rows);
    const professionalismDraft =
      buildStoryPointsEncodeProfessionalismDraftRows(professionalismData);
    setEncodeProfessionalismColumns(professionalismDraft.itemColumns);
    setEncodeProfessionalismRows(professionalismDraft.rows);
  };

  const handleEncodeUpdate = async () => {
    if (!encodeSprintId) {
      setEncodeError("Select a sprint.");
      return;
    }

    if (encodeMembersValidationMessages.length > 0) {
      return;
    }

    setEncodeSaving(true);
    setEncodeError(null);
    setEncodeSaveSuccess(null);

    try {
      const sprintUpdate = {
        plannedStoryPoints: parseStoryPointsEncodeInputValue(
          encodeSprintDraft.plannedStoryPointsInput,
        ),
        adhocStoryPoints: parseStoryPointsEncodeInputValue(
          encodeSprintDraft.adhocStoryPointsInput,
        ),
        completedStoryPoints: parseStoryPointsEncodeInputValue(
          encodeSprintDraft.completedStoryPointsInput,
        ),
        plannedTasksCount: parseStoryPointsEncodeCountValue(
          encodeSprintDraft.plannedTasksCountInput,
        ),
        adhocTasksCount: parseStoryPointsEncodeCountValue(
          encodeSprintDraft.adhocTasksCountInput,
        ),
        rejectCount: parseStoryPointsEncodeCountValue(
          encodeSprintDraft.rejectCountInput,
        ),
        blockedTasksCount: parseStoryPointsEncodeCountValue(
          encodeSprintDraft.blockedTasksCountInput,
        ),
      };
      const memberUpdates = encodeRows.map((row) => ({
        memberId: row.memberId,
        plannedStoryPoints: parseStoryPointsEncodeInputValue(row.plannedInput),
        plannedTasksCount: parseStoryPointsEncodeCountValue(
          row.plannedTasksInput,
        ),
        adhocStoryPoints: parseStoryPointsEncodeInputValue(row.adhocInput),
        totalAdhocCount: parseStoryPointsEncodeCountValue(row.adhocTasksInput),
        completedStoryPoints: parseStoryPointsEncodeInputValue(
          row.completedInput,
        ),
        completedTasksCount: parseStoryPointsEncodeCountValue(
          row.completedTasksInput,
        ),
        totalRejectCount: parseStoryPointsEncodeCountValue(row.rejectedInput),
        accumulatedHours: parseStoryPointsEncodeNullableInputValue(
          row.hoursInput,
        ),
        collaboration: parseStoryPointsEncodeNullableInputValue(
          row.collaborationInput,
        ),
        completionRateOverride: parseStoryPointsEncodeNullableInputValue(
          row.completionOverrideInput,
        ),
      }));

      const breakdownProjectNameById = new Map(
        encodeBreakdownColumns.map((column) => [column.id, column.label]),
      );
      const breakdownUpdates = encodeBreakdownRows.flatMap((row) =>
        encodeBreakdownColumns.map((column, columnIndex) => ({
          projectTypeId: row.projectTypeId,
          projectId: column.id,
          realPoints: parseStoryPointsEncodeInputValue(
            row.valueInputs[columnIndex] ?? "0",
          ),
        })),
      );

      const professionalismUpdates = encodeProfessionalismRows.flatMap((row) =>
        encodeProfessionalismColumns.flatMap((column, columnIndex) => {
          const rawValue = (row.scoreInputs[columnIndex] ?? "").trim();
          if (!rawValue) {
            return [];
          }

          const parsed = parseStoryPointsEncodeInputValue(rawValue);
          const maxValue = Math.max(0, column.value);
          const score = Math.min(Math.max(parsed, 0), maxValue);

          return [
            {
              memberId: row.memberId,
              itemId: column.id,
              score,
            },
          ];
        }),
      );

      await saveStoryPointsEncodeData(
        encodeSprintId,
        sprintUpdate,
        memberUpdates,
      );
      await saveStoryPointsEncodeStoryPoints(encodeSprintId, memberUpdates);
      await saveStoryPointsEncodeBreakdownData(
        encodeSprintId,
        breakdownUpdates,
        breakdownProjectNameById,
      );
      await saveStoryPointsEncodeProfessionalismData(
        encodeSprintId,
        professionalismUpdates,
      );

      await refreshStoryPointsFromDatabase(encodeSprintId);

      setEncodeSaveSuccess("Story points updated successfully.");
    } catch (error) {
      setEncodeError(
        getBackgroundProcessErrorMessage(
          error,
          "Unable to update sprint encode values.",
        ),
      );
    } finally {
      setEncodeSaving(false);
    }
  };

  useEffect(() => {
    if (!encodeModalOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (encodeSaving) {
          return;
        }

        event.preventDefault();
        closeEncodeModal();
        return;
      }

      const isSaveShortcut =
        (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s";

      if (!isSaveShortcut || isEncodeUpdateDisabled) {
        return;
      }

      event.preventDefault();
      void handleEncodeUpdate();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [encodeModalOpen, encodeSaving, isEncodeUpdateDisabled, handleEncodeUpdate]);

  return (
    <div className="story-points-page" style={{ padding: "20px 0 40px" }}>
      <div className="story-points-year-filter">
        <div className="story-points-year-filter__actions">
          <span className="story-points-year-filter__label">Year</span>
          <StyledSelect
            value={selectedYear}
            onChange={setSelectedYear}
            placeholder={loading ? "Loading..." : "Select year"}
          >
            {availableYears.map((year) => (
              <option key={year} value={String(year)}>
                {year}
              </option>
            ))}
          </StyledSelect>
          <button
            type="button"
            className="story-points-encode-button"
            aria-label="Encode story points"
            title="Encode"
            disabled={loading || encodeSprints.length === 0 || !encodeSprintId}
            onClick={openEncodeModal}
          >
            <svg
              aria-hidden="true"
              width="15"
              height="15"
              viewBox="0 0 16 16"
              fill="none"
            >
              <path
                d="M5.5 4 2.5 8l3 4"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
              />
              <path
                d="M10.5 4l3 4-3 4"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
              />
              <path
                d="M9 3 7 13"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.5"
              />
            </svg>
          </button>
        </div>
      </div>

      {encodeModalOpen
        ? createPortal(
            <div
              className={`story-points-modal-backdrop${
                encodeSaving ? " story-points-modal-backdrop--locked" : ""
              }`}
              role="presentation"
            >
          <div
            aria-labelledby="story-points-encode-title"
            aria-modal="true"
            className="story-points-modal story-points-modal--encode"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="story-points-modal-header">
              <div className="story-points-encode-header-top">
                <div id="story-points-encode-title">
                  <SectionTitle className="story-points-section-title">
                    Encode Story Points
                  </SectionTitle>
                </div>
                <button
                  type="button"
                  className="story-points-modal-close"
                  onClick={closeEncodeModal}
                  disabled={encodeSaving}
                  aria-label="Close encode story points modal"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M4 4l8 8M12 4l-8 8"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeWidth="1.5"
                    />
                  </svg>
                </button>
              </div>
              <div className="story-points-encode-header-filters">
                <span className="story-points-encode-header-label">Year</span>
                <span className="story-points-encode-header-year">
                  {selectedYearNumber ?? "—"}
                </span>
                <span className="story-points-encode-header-label">Sprint</span>
                <div className="story-points-encode-header-sprint-select">
                  <SprintGroupedSelect
                    sprints={encodeSprints}
                    value={encodeSprintId}
                    onChange={setEncodeSprintId}
                    getLabel={formatStoryPointsSprintOptionLabel}
                    placeholder="Select sprint"
                    disabled={encodeSaving}
                  />
                </div>
              </div>
            </div>

            <div
              className={`story-points-encode-tabbed story-points-encode-tabbed--${encodeActiveTab}`}
            >
              <div
                className="story-points-encode-tabs"
                role="tablist"
                aria-label="Encode story points sections"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={encodeActiveTab === "sprint"}
                  aria-controls="story-points-encode-sprint-panel"
                  className={`story-points-encode-tab story-points-encode-tab--sprint${
                    encodeActiveTab === "sprint" ? " is-active" : ""
                  }`}
                  id="story-points-encode-sprint-tab"
                  disabled={encodeSaving}
                  onClick={() => setEncodeActiveTab("sprint")}
                >
                  Sprint
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={encodeActiveTab === "members"}
                  aria-controls="story-points-encode-members-panel"
                  className={`story-points-encode-tab story-points-encode-tab--members${
                    encodeActiveTab === "members" ? " is-active" : ""
                  }`}
                  id="story-points-encode-members-tab"
                  disabled={encodeSaving}
                  onClick={() => setEncodeActiveTab("members")}
                >
                  Members
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={encodeActiveTab === "professionalism"}
                  aria-controls="story-points-encode-professionalism-panel"
                  className={`story-points-encode-tab story-points-encode-tab--professionalism${
                    encodeActiveTab === "professionalism" ? " is-active" : ""
                  }`}
                  id="story-points-encode-professionalism-tab"
                  disabled={encodeSaving}
                  onClick={() => setEncodeActiveTab("professionalism")}
                >
                  Professionalism
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={encodeActiveTab === "breakdown"}
                  aria-controls="story-points-encode-breakdown-panel"
                  className={`story-points-encode-tab story-points-encode-tab--breakdown${
                    encodeActiveTab === "breakdown" ? " is-active" : ""
                  }`}
                  id="story-points-encode-breakdown-tab"
                  disabled={encodeSaving}
                  onClick={() => setEncodeActiveTab("breakdown")}
                >
                  Breakdown
                </button>
              </div>

              <div className="story-points-modal-body">
              {encodeActiveTab === "sprint" ? (
              <section
                aria-labelledby="story-points-encode-sprint-tab"
                className="story-points-encode-section story-points-encode-section--sprint"
                id="story-points-encode-sprint-panel"
                role="tabpanel"
              >
                <div className="story-points-encode-section-content">
                <div className="story-points-encode-sprint-body">
                  {encodeLoading ? (
                    <div className="story-points-encode-status">
                      Loading sprint fields...
                    </div>
                  ) : (
                    <div className="story-points-encode-sprint-fields">
                      <div className="story-points-encode-sprint-field-group story-points-encode-sprint-field-group--story-points">
                        {SPRINT_ENCODE_STORY_POINT_FIELDS.map((field) => (
                          <label
                            key={field.key}
                            className="story-points-encode-sprint-field"
                          >
                            <span>{field.label}</span>
                            <input
                              type="text"
                              inputMode={field.inputMode}
                              className="story-points-edit-input story-points-encode-input"
                              value={encodeSprintDraft[field.key]}
                              onChange={(event) =>
                                updateSprintEncodeField(
                                  field.key,
                                  event.target.value,
                                )
                              }
                            />
                          </label>
                        ))}
                      </div>
                      <div className="story-points-encode-sprint-field-group story-points-encode-sprint-field-group--counts">
                        {SPRINT_ENCODE_COUNT_FIELDS.map((field) => (
                          <label
                            key={field.key}
                            className="story-points-encode-sprint-field"
                          >
                            <span>{field.label}</span>
                            <input
                              type="text"
                              inputMode={field.inputMode}
                              className="story-points-edit-input story-points-encode-input"
                              value={encodeSprintDraft[field.key]}
                              onChange={(event) =>
                                updateSprintEncodeField(
                                  field.key,
                                  event.target.value,
                                )
                              }
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                </div>
              </section>
              ) : encodeActiveTab === "members" ? (
              <section
                aria-labelledby="story-points-encode-members-tab"
                className="story-points-encode-section story-points-encode-section--members"
                id="story-points-encode-members-panel"
                role="tabpanel"
              >
                <div className="story-points-encode-section-content">

                <div className="story-points-encode-table-wrap">
                  {encodeLoading ? (
                    <div className="story-points-encode-status">
                      Loading members...
                    </div>
                  ) : encodeRows.length === 0 ? (
                    <div className="story-points-encode-status">
                      No scoreboard members found for this sprint.
                    </div>
                  ) : (
                    <div
                      className="story-points-encode-grid"
                      role="table"
                      aria-label="Member story points"
                    >
                      <div className="story-points-encode-grid-scroll">
                        <div className="story-points-encode-grid-inner">
                          <div
                            className="story-points-encode-grid-head"
                            role="row"
                          >
                            <div
                              className="story-points-encode-member-head"
                              role="columnheader"
                            >
                              Member
                            </div>
                            <div role="columnheader" title="Planned SP">
                              Planned SP
                            </div>
                            <div role="columnheader" title="Planned Tasks">
                              Pln Tasks
                            </div>
                            <div role="columnheader" title="Adhoc SP">
                              Adhoc SP
                            </div>
                            <div role="columnheader" title="Adhoc Tasks">
                              Adh Tasks
                            </div>
                            <div role="columnheader" title="Completed SP" className="story-points-encode-completed-sp-head">
                              Cmp SP
                            </div>
                            <div role="columnheader" title="Completed Tasks">
                              Cmp Tasks
                            </div>
                            <div role="columnheader">Rejected</div>
                            <div role="columnheader">Hours</div>
                            <div role="columnheader" title="Collaboration">
                              Collab
                            </div>
                            <div role="columnheader" title="Completion Override">
                              Comp Ovr
                            </div>
                          </div>
                          <div
                            className="story-points-encode-grid-body"
                            role="rowgroup"
                          >
                        {encodeRows.map((row) => (
                          <div
                            key={row.memberId}
                            className="story-points-encode-grid-row"
                            role="row"
                          >
                          <div
                            className="story-points-encode-member-cell"
                            role="cell"
                          >
                            <div className="story-points-encode-member">
                              <span>{row.name}</span>
                              <span>{row.roleLabel}</span>
                            </div>
                          </div>
                          <div
                            className="story-points-encode-field-cell"
                            role="cell"
                          >
                            <span className="story-points-encode-field-label">
                              Planned SP
                            </span>
                            <input
                              type="text"
                              inputMode="decimal"
                              aria-label={`${row.name} planned SP`}
                              className="story-points-edit-input story-points-encode-input"
                              value={row.plannedInput}
                              onChange={(event) =>
                                updateEncodeRowValue(
                                  row.memberId,
                                  "plannedInput",
                                  event.target.value,
                                )
                              }
                            />
                          </div>
                          <div
                            className="story-points-encode-field-cell"
                            role="cell"
                          >
                            <span className="story-points-encode-field-label">
                              Planned Tasks
                            </span>
                            <input
                              type="text"
                              inputMode="numeric"
                              aria-label={`${row.name} planned tasks count`}
                              className="story-points-edit-input story-points-encode-input"
                              value={row.plannedTasksInput}
                              onChange={(event) =>
                                updateEncodeRowValue(
                                  row.memberId,
                                  "plannedTasksInput",
                                  event.target.value,
                                )
                              }
                            />
                          </div>
                          <div
                            className="story-points-encode-field-cell"
                            role="cell"
                          >
                            <span className="story-points-encode-field-label">
                              Adhoc SP
                            </span>
                            <input
                              type="text"
                              inputMode="decimal"
                              aria-label={`${row.name} adhoc SP`}
                              className="story-points-edit-input story-points-encode-input"
                              value={row.adhocInput}
                              onChange={(event) =>
                                updateEncodeRowValue(
                                  row.memberId,
                                  "adhocInput",
                                  event.target.value,
                                )
                              }
                            />
                          </div>
                          <div
                            className="story-points-encode-field-cell"
                            role="cell"
                          >
                            <span className="story-points-encode-field-label">
                              Adhoc Tasks
                            </span>
                            <input
                              type="text"
                              inputMode="numeric"
                              aria-label={`${row.name} adhoc tasks count`}
                              className="story-points-edit-input story-points-encode-input"
                              value={row.adhocTasksInput}
                              onChange={(event) =>
                                updateEncodeRowValue(
                                  row.memberId,
                                  "adhocTasksInput",
                                  event.target.value,
                                )
                              }
                            />
                          </div>
                          <div
                            className="story-points-encode-field-cell"
                            role="cell"
                          >
                            <span className="story-points-encode-field-label">
                              Completed SP
                            </span>
                            <input
                              type="text"
                              inputMode="decimal"
                              aria-label={`${row.name} completed SP`}
                              className="story-points-edit-input story-points-encode-input"
                              value={row.completedInput}
                              onChange={(event) =>
                                updateEncodeRowValue(
                                  row.memberId,
                                  "completedInput",
                                  event.target.value,
                                )
                              }
                            />
                          </div>
                          <div
                            className="story-points-encode-field-cell"
                            role="cell"
                          >
                            <span className="story-points-encode-field-label">
                              Completed Tasks
                            </span>
                            <input
                              type="text"
                              inputMode="numeric"
                              aria-label={`${row.name} completed tasks count`}
                              className="story-points-edit-input story-points-encode-input"
                              value={row.completedTasksInput}
                              onChange={(event) =>
                                updateEncodeRowValue(
                                  row.memberId,
                                  "completedTasksInput",
                                  event.target.value,
                                )
                              }
                            />
                          </div>
                          <div
                            className="story-points-encode-field-cell"
                            role="cell"
                          >
                            <span className="story-points-encode-field-label">
                              Rejected
                            </span>
                            <input
                              type="text"
                              inputMode="numeric"
                              aria-label={`${row.name} rejected count`}
                              className="story-points-edit-input story-points-encode-input"
                              value={row.rejectedInput}
                              onChange={(event) =>
                                updateEncodeRowValue(
                                  row.memberId,
                                  "rejectedInput",
                                  event.target.value,
                                )
                              }
                            />
                          </div>
                          <div
                            className="story-points-encode-field-cell"
                            role="cell"
                          >
                            <span className="story-points-encode-field-label">
                              Hours
                            </span>
                            <input
                              type="text"
                              inputMode="decimal"
                              aria-label={`${row.name} accumulated hours`}
                              className="story-points-edit-input story-points-encode-input"
                              value={row.hoursInput}
                              onChange={(event) =>
                                updateEncodeRowValue(
                                  row.memberId,
                                  "hoursInput",
                                  event.target.value,
                                )
                              }
                            />
                          </div>
                          <div
                            className="story-points-encode-field-cell"
                            role="cell"
                          >
                            <span className="story-points-encode-field-label">
                              Collab
                            </span>
                            <input
                              type="text"
                              inputMode="decimal"
                              aria-label={`${row.name} collab`}
                              className="story-points-edit-input story-points-encode-input"
                              value={row.collaborationInput}
                              onChange={(event) =>
                                updateEncodeRowValue(
                                  row.memberId,
                                  "collaborationInput",
                                  event.target.value,
                                )
                              }
                            />
                          </div>
                          <div
                            className="story-points-encode-field-cell"
                            role="cell"
                          >
                            <span className="story-points-encode-field-label">
                              Completion Override
                            </span>
                            <input
                              type="text"
                              inputMode="decimal"
                              aria-label={`${row.name} completion override`}
                              className="story-points-edit-input story-points-encode-input"
                              value={row.completionOverrideInput}
                              onChange={(event) =>
                                updateEncodeRowValue(
                                  row.memberId,
                                  "completionOverrideInput",
                                  event.target.value,
                                )
                              }
                            />
                          </div>
                        </div>
                      ))}
                      </div>
                      <div
                        className="story-points-encode-grid-foot"
                        role="row"
                      >
                        <div
                          className="story-points-encode-member-cell"
                          role="cell"
                        >
                          <div className="story-points-encode-member">
                            <span>Total</span>
                          </div>
                        </div>
                        <div
                          className="story-points-encode-field-cell story-points-encode-field-cell--planned-sp-total"
                          role="cell"
                        >
                          <span className="story-points-encode-field-label">
                            Planned SP
                          </span>
                          <span className="story-points-encode-total-value">
                            {formatMemberSprintTotalDisplay(
                              encodeMemberTotals.planned,
                              encodeSprintTargetTotals.planned,
                            )}
                          </span>
                        </div>
                        <div
                          className="story-points-encode-field-cell"
                          role="cell"
                        >
                          <span className="story-points-encode-field-label">
                            Planned Tasks
                          </span>
                          <span className="story-points-encode-total-value">
                            {formatMemberSprintTotalDisplay(
                              encodeMemberTotals.plannedTasks,
                              encodeSprintTargetTotals.plannedTasks,
                            )}
                          </span>
                        </div>
                        <div
                          className="story-points-encode-field-cell"
                          role="cell"
                        >
                          <span className="story-points-encode-field-label">
                            Adhoc SP
                          </span>
                          <span className="story-points-encode-total-value">
                            {formatMemberSprintTotalDisplay(
                              encodeMemberTotals.adhoc,
                              encodeSprintTargetTotals.adhoc,
                            )}
                          </span>
                        </div>
                        <div
                          className="story-points-encode-field-cell"
                          role="cell"
                        >
                          <span className="story-points-encode-field-label">
                            Adhoc Tasks
                          </span>
                          <span className="story-points-encode-total-value">
                            {formatMemberSprintTotalDisplay(
                              encodeMemberTotals.adhocTasks,
                              encodeSprintTargetTotals.adhocTasks,
                            )}
                          </span>
                        </div>
                        <div
                          className="story-points-encode-field-cell story-points-encode-field-cell--completed-sp-total"
                          role="cell"
                        >
                          <span className="story-points-encode-field-label">
                            Completed SP
                          </span>
                          <span className="story-points-encode-total-value">
                            {formatMemberSprintTotalDisplay(
                              encodeMemberTotals.completed,
                              encodeSprintTargetTotals.completed,
                            )}
                          </span>
                        </div>
                        <div
                          className="story-points-encode-field-cell"
                          role="cell"
                        >
                          <span className="story-points-encode-field-label">
                            Completed Tasks
                          </span>
                          <span className="story-points-encode-total-value">
                            {formatStoryPointsCell(
                              encodeMemberTotals.completedTasks,
                            )}
                          </span>
                        </div>
                        <div
                          className="story-points-encode-field-cell"
                          role="cell"
                        >
                          <span className="story-points-encode-field-label">
                            Rejected
                          </span>
                          <span className="story-points-encode-total-value">
                            {formatMemberSprintTotalDisplay(
                              encodeMemberTotals.rejected,
                              encodeSprintTargetTotals.rejected,
                            )}
                          </span>
                        </div>
                        <div
                          className="story-points-encode-field-cell"
                          role="cell"
                        >
                          <span className="story-points-encode-field-label">
                            Hours
                          </span>
                          <span className="story-points-encode-total-value">
                            {formatStoryPointsCell(encodeMemberTotals.hours)}
                          </span>
                        </div>
                        <div
                          className="story-points-encode-field-cell story-points-encode-field-cell--collab-average"
                          role="cell"
                        >
                          <span className="story-points-encode-field-label">
                            Collab
                          </span>
                          <span className="story-points-encode-total-kind">
                            Average
                          </span>
                          <span className="story-points-encode-total-value">
                            {formatAverage(encodeMemberCollaborationAverage)}
                          </span>
                        </div>
                        <div
                          className="story-points-encode-field-cell"
                          role="cell"
                        >
                          <span className="story-points-encode-field-label">
                            Completion Override
                          </span>
                          <span className="story-points-encode-total-value">
                            —
                          </span>
                        </div>
                      </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                </div>
              </section>
              ) : encodeActiveTab === "professionalism" ? (
              <section
                aria-labelledby="story-points-encode-professionalism-tab"
                className="story-points-encode-section story-points-encode-section--professionalism"
                id="story-points-encode-professionalism-panel"
                role="tabpanel"
              >
                <div className="story-points-encode-section-content">
                  <div className="story-points-encode-table-wrap">
                    {encodeLoading ? (
                      <div className="story-points-encode-status">
                        Loading professionalism...
                      </div>
                    ) : encodeProfessionalismRows.length === 0 ? (
                      <div className="story-points-encode-status">
                        No scoreboard members found for this sprint.
                      </div>
                    ) : (
                      <div
                        className="story-points-encode-professionalism-grid"
                        role="table"
                        aria-label="Member professionalism scores"
                        style={{
                          ["--encode-professionalism-item-count" as string]:
                            Math.max(encodeProfessionalismColumns.length, 1),
                          ["--encode-professionalism-row-count" as string]:
                            encodeProfessionalismRows.length,
                        }}
                      >
                        {encodeProfessionalismColumns.length === 0 ? (
                          <div className="story-points-encode-status story-points-encode-status--inline">
                            No professionalism checklist items are configured
                            yet. Members are listed below; add rows to
                            professionalism_items to enable score columns.
                          </div>
                        ) : null}
                        <div className="story-points-encode-professionalism-grid-scroll">
                          <div className="story-points-encode-professionalism-grid-inner">
                            <div
                              className="story-points-encode-professionalism-grid-head"
                              role="row"
                            >
                              <div
                                className="story-points-encode-professionalism-member-head"
                                role="columnheader"
                              >
                                Member
                              </div>
                              {encodeProfessionalismColumns.map((item) => (
                                <div
                                  key={item.id}
                                  className="story-points-encode-professionalism-item-head"
                                  role="columnheader"
                                  title={
                                    item.description?.trim() ||
                                    `${item.name} (max ${formatStoryPointsCell(item.value)})`
                                  }
                                >
                                  {item.name}
                                </div>
                              ))}
                              <div
                                className="story-points-encode-professionalism-sum-head"
                                role="columnheader"
                              >
                                Total
                              </div>
                            </div>
                            <div
                              className="story-points-encode-professionalism-grid-body"
                              role="rowgroup"
                            >
                              {encodeProfessionalismRows.map((row, rowIndex) => (
                                <div
                                  key={row.memberId}
                                  className="story-points-encode-professionalism-grid-row"
                                  role="row"
                                >
                                  <div
                                    className="story-points-encode-professionalism-member-cell"
                                    role="cell"
                                  >
                                    <div className="story-points-encode-member">
                                      <span>{row.name}</span>
                                      <span>{row.roleLabel}</span>
                                    </div>
                                  </div>
                                  {encodeProfessionalismColumns.map(
                                    (item, valueIndex) => (
                                      <div
                                        key={`${row.memberId}-${item.id}`}
                                        className="story-points-encode-professionalism-value-cell"
                                        role="cell"
                                      >
                                        <span className="story-points-encode-professionalism-mobile-label">
                                          {item.name}
                                        </span>
                                        <input
                                          type="number"
                                          inputMode="numeric"
                                          min={0}
                                          max={item.value}
                                          step={1}
                                          aria-label={`${row.name} ${item.name} score`}
                                          className="story-points-edit-input story-points-encode-input story-points-encode-professionalism-input"
                                          value={
                                            row.scoreInputs[valueIndex] ?? ""
                                          }
                                          onChange={(event) =>
                                            updateEncodeProfessionalismValue(
                                              row.memberId,
                                              valueIndex,
                                              event.target.value,
                                              item.value,
                                            )
                                          }
                                        />
                                      </div>
                                    ),
                                  )}
                                  <div
                                    className="story-points-encode-professionalism-row-total-cell"
                                    role="cell"
                                  >
                                    <span className="story-points-encode-professionalism-mobile-label">
                                      Total
                                    </span>
                                    <span className="story-points-encode-total-value">
                                      {formatStoryPointsCell(
                                        encodeProfessionalismRowTotals[
                                          rowIndex
                                        ] ?? 0,
                                      )}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div
                              className="story-points-encode-professionalism-grid-foot"
                              role="row"
                            >
                              <div
                                className="story-points-encode-professionalism-member-cell"
                                role="cell"
                              >
                                <div className="story-points-encode-member">
                                  <span>Average</span>
                                </div>
                              </div>
                              {encodeProfessionalismColumnAverages.map(
                                (average, averageIndex) => (
                                  <div
                                    key={`professionalism-average-${encodeProfessionalismColumns[averageIndex]?.id ?? averageIndex}`}
                                    className="story-points-encode-professionalism-total-cell"
                                    role="cell"
                                  >
                                    <span className="story-points-encode-professionalism-mobile-label">
                                      {encodeProfessionalismColumns[
                                        averageIndex
                                      ]?.name ?? "Item"}
                                    </span>
                                    <span className="story-points-encode-total-value">
                                      {formatAverage(average)}
                                    </span>
                                  </div>
                                ),
                              )}
                              <div
                                className="story-points-encode-professionalism-grand-total-cell"
                                role="cell"
                              >
                                <span className="story-points-encode-professionalism-mobile-label">
                                  Average of Totals
                                </span>
                                <span className="story-points-encode-total-value">
                                  {formatAverage(
                                    encodeProfessionalismTotalColumnAverage,
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>
              ) : (
              <section
                aria-labelledby="story-points-encode-breakdown-tab"
                className="story-points-encode-section story-points-encode-section--breakdown"
                id="story-points-encode-breakdown-panel"
                role="tabpanel"
              >
                <div className="story-points-encode-section-content">
                  <div className="story-points-encode-table-wrap">
                    {encodeLoading ? (
                      <div className="story-points-encode-status">
                        Loading breakdown...
                      </div>
                    ) : encodeBreakdownColumns.length === 0 ? (
                      <div className="story-points-encode-status">
                        No projects found for breakdown.
                      </div>
                    ) : encodeBreakdownRows.length === 0 ? (
                      <div className="story-points-encode-status">
                        No project types found for breakdown.
                      </div>
                    ) : (
                      <div
                        className="story-points-encode-breakdown-grid"
                        role="table"
                        aria-label="Story points breakdown by project type and project"
                        style={{
                          ["--encode-breakdown-project-count" as string]:
                            encodeBreakdownColumns.length,
                          ["--encode-breakdown-row-count" as string]:
                            encodeBreakdownRows.length,
                        }}
                      >
                        <div className="story-points-encode-breakdown-grid-scroll">
                          <div className="story-points-encode-breakdown-grid-inner">
                            <div
                              className="story-points-encode-breakdown-grid-head"
                              role="row"
                            >
                              <div
                                className="story-points-encode-breakdown-type-head"
                                role="columnheader"
                              >
                                Project Type
                              </div>
                              {encodeBreakdownColumns.map((project) => (
                                <div
                                  key={project.id}
                                  className="story-points-encode-breakdown-project-head"
                                  role="columnheader"
                                  title={project.label}
                                >
                                  {project.label}
                                </div>
                              ))}
                              <div
                                className="story-points-encode-breakdown-sum-head"
                                role="columnheader"
                              >
                                Total
                              </div>
                            </div>
                            <div
                              className="story-points-encode-breakdown-grid-body"
                              role="rowgroup"
                            >
                              {encodeBreakdownRows.map((row, rowIndex) => (
                                <div
                                  key={row.projectTypeId}
                                  className={`story-points-encode-breakdown-grid-row${
                                    row.category === "bugs"
                                      ? " is-highlighted"
                                      : ""
                                  }`}
                                  role="row"
                                >
                                  <div
                                    className="story-points-encode-breakdown-type-cell"
                                    role="cell"
                                  >
                                    <span>{row.label}</span>
                                  </div>
                                  {encodeBreakdownColumns.map((project, valueIndex) => (
                                    <div
                                      key={`${row.projectTypeId}-${project.id}`}
                                      className="story-points-encode-breakdown-value-cell"
                                      role="cell"
                                    >
                                      <span className="story-points-encode-breakdown-mobile-label">
                                        {project.label}
                                      </span>
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        aria-label={`${row.label} ${project.label} SP`}
                                        className="story-points-edit-input story-points-encode-input"
                                        value={row.valueInputs[valueIndex] ?? "0"}
                                        onChange={(event) =>
                                          updateEncodeBreakdownValue(
                                            row.projectTypeId,
                                            valueIndex,
                                            event.target.value,
                                          )
                                        }
                                      />
                                    </div>
                                  ))}
                                  <div
                                    className="story-points-encode-breakdown-row-total-cell"
                                    role="cell"
                                  >
                                    <span className="story-points-encode-breakdown-mobile-label">
                                      Total
                                    </span>
                                    <span className="story-points-encode-total-value">
                                      {formatStoryPointsCell(
                                        encodeBreakdownRowTotals[rowIndex] ?? 0,
                                      )}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div
                              className="story-points-encode-breakdown-grid-foot"
                              role="row"
                            >
                              <div
                                className="story-points-encode-breakdown-type-cell"
                                role="cell"
                              >
                                <span>Total</span>
                              </div>
                              {encodeBreakdownColumnTotals.map(
                                (total, totalIndex) => (
                                  <div
                                    key={`breakdown-total-${encodeBreakdownColumns[totalIndex]?.id ?? totalIndex}`}
                                    className="story-points-encode-breakdown-total-cell"
                                    role="cell"
                                  >
                                    <span className="story-points-encode-breakdown-mobile-label">
                                      {encodeBreakdownColumns[totalIndex]?.label ??
                                        "Project"}
                                    </span>
                                    <span className="story-points-encode-total-value">
                                      {formatStoryPointsCell(total)}
                                    </span>
                                  </div>
                                ),
                              )}
                              <div
                                className="story-points-encode-breakdown-grand-total-cell"
                                role="cell"
                              >
                                <span className="story-points-encode-breakdown-mobile-label">
                                  Grand Total
                                </span>
                                <span className="story-points-encode-total-value">
                                  {formatStoryPointsCell(encodeBreakdownGrandTotal)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>
              )}
            </div>
            </div>

            {encodeSaving ? (
              <div
                className="story-points-modal-status story-points-modal-status--loading"
                role="status"
                aria-live="polite"
              >
                <span
                  className="story-points-modal-spinner"
                  aria-hidden="true"
                />
                Updating story points...
              </div>
            ) : encodeSaveSuccess ? (
              <div
                className="story-points-modal-status story-points-modal-status--success"
                role="status"
                aria-live="polite"
              >
                {encodeSaveSuccess}
              </div>
            ) : null}

            <div className="story-points-modal-actions-row">
              {encodeModalErrorMessages.length > 0 ? (
                <div
                  className="story-points-modal-actions-row__message"
                  role="alert"
                >
                  {encodeModalErrorMessages.map((message, index) => (
                    <span key={`${message}-${index}`}>{message}</span>
                  ))}
                </div>
              ) : null}

              <div className="story-points-modal-actions">
              <button
                type="button"
                className="story-points-modal-button story-points-modal-button--secondary"
                disabled={encodeSaving}
                onClick={closeEncodeModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="story-points-modal-button story-points-modal-button--primary"
                disabled={isEncodeUpdateDisabled}
                onClick={() => void handleEncodeUpdate()}
              >
                {encodeSaving ? (
                  <>
                    <span
                      className="story-points-modal-spinner"
                      aria-hidden="true"
                    />
                    Updating...
                  </>
                ) : (
                  "Update"
                )}
              </button>
            </div>
            </div>
          </div>
            </div>,
            document.body,
          )
        : null}

      <Card className="story-points-card">
        <div
          className="story-points-header"
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 14,
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          <div>
            <SectionTitle className="story-points-section-title">Story Points</SectionTitle>
            <div
              style={{
                color: Text.faint,
                fontFamily: "'DM Mono',monospace",
                fontSize: 10,
                fontWeight: 800,
                marginTop: -8,
              }}
            >
              Assignee averages and sprint totals from members_sprint_scores
            </div>
          </div>
          <div
            style={{
              padding: "7px 11px",
              borderRadius: 10,
              border: `1px solid ${Palette.cyan}33`,
              background: `${Palette.cyan}10`,
              color: Palette.cyan,
              fontFamily: "'DM Mono',monospace",
              fontSize: 11,
              fontWeight: 900,
            }}
          >
            {sprintColumns.length} sprints
          </div>
        </div>

        {loadError ? (
          <div
            style={{
              marginBottom: 12,
              color: Palette.red,
              fontFamily: "'DM Mono',monospace",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {loadError}
          </div>
        ) : null}

        <div className="story-points-scroll">
          <table ref={storyPointsTableRef} className="story-points-table">
            <thead>
              <tr>
                <th
                  className="story-points-sticky story-points-assignee"
                  style={{
                    padding: "8px 12px",
                    textAlign: "left",
                    borderRadius: "10px 0 0 10px",
                    background: "rgba(9,18,38,0.98)",
                    color: Text.section,
                    fontFamily: "'DM Mono',monospace",
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  Assignee
                </th>
                <th
                  className="story-points-sticky story-points-average"
                  style={{
                    padding: "8px 12px",
                    borderRadius: 0,
                    background: "rgba(9,18,38,0.98)",
                    color: Palette.gold,
                    fontFamily: "'DM Mono',monospace",
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  Average
                </th>
                {sprintColumns.map((sprint, index) => (
                  <th
                    key={sprint.id}
                    style={{
                      padding: "8px 12px",
                      borderRadius:
                        index === sprintColumns.length - 1 ? "0 10px 10px 0" : 0,
                      background: Background.selectActive,
                      color: sprint.isCurrent ? Palette.green : Text.label,
                      fontFamily: "'DM Mono',monospace",
                      fontSize: 10,
                      fontWeight: 900,
                    }}
                  >
                    {sprint.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={2 + sprintColumns.length}
                    className="story-points-message"
                    style={{
                      padding: "18px 12px",
                      color: Text.faint,
                      fontFamily: "'DM Mono',monospace",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    Loading story points...
                  </td>
                </tr>
              ) : assigneeRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={2 + sprintColumns.length}
                    className="story-points-message"
                    style={{
                      padding: "18px 12px",
                      color: Text.faint,
                      fontFamily: "'DM Mono',monospace",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    No members_sprint_scores data available yet.
                  </td>
                </tr>
              ) : (
                assigneeRows.map((assignee, rowIndex) => (
                  <tr
                    className="story-points-animated-row"
                    key={assignee.id}
                    style={{ animationDelay: `${0.06 + rowIndex * 0.045}s` }}
                  >
                    <td
                      className="story-points-sticky story-points-assignee"
                      style={{
                        padding: "10px 12px",
                        textAlign: "left",
                        borderRadius: "10px 0 0 10px",
                        background: "rgba(9,18,38,0.98)",
                        border: `1px solid ${assignee.color}24`,
                        borderRight: "none",
                      }}
                    >
                      <div
                        style={{
                          color: Text.primary,
                          fontFamily: "'DM Sans',sans-serif",
                          fontSize: 12,
                          fontWeight: 800,
                        }}
                      >
                        {assignee.name}
                      </div>
                      <div
                        style={{
                          color: assignee.color,
                          fontFamily: "'DM Mono',monospace",
                          fontSize: 9,
                          fontWeight: 900,
                        }}
                      >
                        {assignee.initials}
                      </div>
                    </td>
                    <td
                      className="story-points-sticky story-points-average"
                      style={{
                        padding: "10px 12px",
                        background: "rgba(9,18,38,0.98)",
                        borderTop: `1px solid ${Palette.gold}24`,
                        borderBottom: `1px solid ${Palette.gold}24`,
                        color: Palette.gold,
                        fontFamily: "'DM Mono',monospace",
                        fontSize: 13,
                        fontWeight: 900,
                      }}
                    >
                      {formatAverage(assignee.average)}
                    </td>
                    {assignee.values.map((value, index) => {
                      const isCurrentSprint = sprintColumns[index]?.isCurrent ?? false;

                      return (
                        <td
                          key={`${assignee.id}-${sprintColumns[index]?.id ?? index}`}
                          style={{
                            padding: "10px 12px",
                            borderRadius:
                              index === sprintColumns.length - 1
                                ? "0 10px 10px 0"
                                : 0,
                            background: isCurrentSprint
                              ? `${assignee.color}14`
                              : Background.row,
                            borderTop: `1px solid ${Border.faint}`,
                            borderBottom: `1px solid ${Border.faint}`,
                            color: isCurrentSprint ? assignee.color : Text.body,
                            fontFamily: "'DM Mono',monospace",
                            fontSize: 12,
                            fontWeight: isCurrentSprint ? 900 : 700,
                          }}
                        >
                          {formatStoryPointsCell(value)}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
              {!loading && assigneeRows.length > 0 ? (
                <tr
                  className="story-points-animated-row"
                  style={{
                    animationDelay: `${0.06 + assigneeRows.length * 0.045}s`,
                  }}
                >
                  <td
                    className="story-points-sticky story-points-assignee"
                    style={{
                      padding: "11px 12px",
                      textAlign: "left",
                      borderRadius: "10px 0 0 10px",
                      background: "#08243b",
                      color: Text.primary,
                      fontFamily: "'DM Sans',sans-serif",
                      fontSize: 12,
                      fontWeight: 900,
                      textTransform: "uppercase",
                    }}
                  >
                    Total
                  </td>
                  <td
                    className="story-points-sticky story-points-average"
                    style={{
                      padding: "11px 12px",
                      background: "#342c17",
                      color: Palette.gold,
                      fontFamily: "'DM Mono',monospace",
                      fontSize: 14,
                      fontWeight: 900,
                    }}
                  >
                    {formatAverage(totalAverage)}
                  </td>
                  {sprintTotals.map((value, index) => {
                    const isCurrentSprint = sprintColumns[index]?.isCurrent ?? false;

                    return (
                      <td
                        key={`total-${sprintColumns[index]?.id ?? index}`}
                        style={{
                          padding: "11px 12px",
                          borderRadius:
                            index === sprintColumns.length - 1
                              ? "0 10px 10px 0"
                              : 0,
                          background: isCurrentSprint
                            ? "rgba(0,229,160,0.16)"
                            : "rgba(0,200,255,0.08)",
                          color: isCurrentSprint ? Palette.green : Palette.cyan,
                          fontFamily: "'DM Mono',monospace",
                          fontSize: 13,
                          fontWeight: 900,
                        }}
                      >
                        {formatStoryPointsCell(value)}
                      </td>
                    );
                  })}
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
      <Card className="story-points-card" style={{ marginTop: 18 }}>
        <div
          className="story-points-header"
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 14,
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          <div>
            <SectionTitle className="story-points-section-title">SP Breakdown</SectionTitle>
            <div
              style={{
                color: Text.faint,
                fontFamily: "'DM Mono',monospace",
                fontSize: 10,
                fontWeight: 800,
                marginTop: -8,
              }}
            >
              Category totals by project type from sprint_story_points
            </div>
          </div>
          <div
            style={{
              padding: "7px 11px",
              borderRadius: 10,
              border: `1px solid ${Palette.green}33`,
              background: `${Palette.green}10`,
              color: Palette.green,
              fontFamily: "'DM Mono',monospace",
              fontSize: 11,
              fontWeight: 900,
            }}
          >
            SP Total = {formatStoryPointsCell(currentSprintBreakdownTotal)}
          </div>
        </div>

        <div className="story-points-scroll">
          <table ref={breakdownTableRef} className="story-points-table">
            <thead>
              <tr>
                <th
                  className="story-points-sticky story-points-assignee"
                  style={{
                    padding: "8px 12px",
                    textAlign: "left",
                    borderRadius: "10px 0 0 10px",
                    background: "rgba(9,18,38,0.98)",
                    color: Text.section,
                    fontFamily: "'DM Mono',monospace",
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  SP Breakdown
                </th>
                <th
                  className="story-points-sticky story-points-average"
                  style={{
                    padding: "8px 12px",
                    borderRadius: 0,
                    background: "rgba(9,18,38,0.98)",
                    color: Palette.gold,
                    fontFamily: "'DM Mono',monospace",
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  Average
                </th>
                {sprintColumns.map((sprint, index) => (
                  <th
                    key={`breakdown-header-${sprint.id}`}
                    style={{
                      padding: "8px 12px",
                      borderRadius:
                        index === sprintColumns.length - 1 ? "0 10px 10px 0" : 0,
                      background: Background.selectActive,
                      color: sprint.isCurrent ? Palette.green : Text.label,
                      fontFamily: "'DM Mono',monospace",
                      fontSize: 10,
                      fontWeight: 900,
                    }}
                  >
                    {sprint.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={2 + sprintColumns.length}
                    className="story-points-message"
                    style={{
                      padding: "18px 12px",
                      color: Text.faint,
                      fontFamily: "'DM Mono',monospace",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    Loading SP breakdown...
                  </td>
                </tr>
              ) : breakdownRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={2 + sprintColumns.length}
                    className="story-points-message"
                    style={{
                      padding: "18px 12px",
                      color: Text.faint,
                      fontFamily: "'DM Mono',monospace",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    No sprint_story_points project type data available yet.
                  </td>
                </tr>
              ) : (
                breakdownRows.map((row, rowIndex) => {
                  const rowColor = row.isTotal
                    ? Palette.green
                    : row.highlighted
                      ? Palette.gold
                      : Text.body;
                  const rowBackground = row.isTotal
                    ? "#08243b"
                    : row.highlighted
                      ? "#342c17"
                      : "rgba(9,18,38,0.98)";

                  return (
                    <tr
                      className="story-points-animated-row"
                      key={row.label}
                      style={{ animationDelay: `${0.12 + rowIndex * 0.045}s` }}
                    >
                      <td
                        className="story-points-sticky story-points-assignee"
                        style={{
                          padding: row.isTotal ? "11px 12px" : "10px 12px",
                          textAlign: "left",
                          borderRadius: "10px 0 0 10px",
                          background: rowBackground,
                          color: row.isTotal ? Text.primary : rowColor,
                          border: row.isTotal
                            ? undefined
                            : `1px solid ${row.highlighted ? rowColor + "55" : Border.faint}`,
                          borderRight: row.isTotal ? undefined : "none",
                          fontFamily: "'DM Sans',sans-serif",
                          fontSize: 12,
                          fontWeight: row.isTotal || row.highlighted ? 900 : 800,
                          textTransform: row.isTotal ? "uppercase" : undefined,
                          lineHeight: 1.2,
                        }}
                      >
                        {row.label}
                      </td>
                      <td
                        className="story-points-sticky story-points-average"
                        style={{
                          padding: row.isTotal ? "11px 12px" : "10px 12px",
                          background: row.isTotal || row.highlighted
                            ? "#342c17"
                            : "rgba(9,18,38,0.98)",
                          borderTop: row.isTotal
                            ? undefined
                            : `1px solid ${row.highlighted ? rowColor + "44" : Palette.gold + "24"}`,
                          borderBottom: row.isTotal
                            ? undefined
                            : `1px solid ${row.highlighted ? rowColor + "44" : Palette.gold + "24"}`,
                          color: row.highlighted ? rowColor : Palette.gold,
                          fontFamily: "'DM Mono',monospace",
                          fontSize: row.isTotal ? 14 : 13,
                          fontWeight: 900,
                        }}
                      >
                        {formatAverage(row.average)}
                      </td>
                      {row.values.map((value, index) => {
                        const isCurrentSprint =
                          sprintColumns[index]?.isCurrent ?? false;

                        return (
                          <td
                            key={`${row.label}-${sprintColumns[index]?.id ?? index}`}
                            style={{
                              padding: row.isTotal ? "11px 12px" : "10px 12px",
                              borderRadius:
                                index === row.values.length - 1
                                  ? "0 10px 10px 0"
                                  : 0,
                              background: row.isTotal
                                ? isCurrentSprint
                                  ? "rgba(0,229,160,0.16)"
                                  : "rgba(0,200,255,0.08)"
                                : row.highlighted
                                  ? "rgba(245,200,66,0.12)"
                                  : isCurrentSprint
                                    ? "rgba(0,200,255,0.08)"
                                    : Background.row,
                              borderTop: row.isTotal
                                ? undefined
                                : `1px solid ${row.highlighted ? rowColor + "33" : Border.faint}`,
                              borderBottom: row.isTotal
                                ? undefined
                                : `1px solid ${row.highlighted ? rowColor + "33" : Border.faint}`,
                              color: row.isTotal
                                ? isCurrentSprint
                                  ? Palette.green
                                  : Palette.cyan
                                : row.highlighted
                                  ? rowColor
                                  : Text.body,
                              fontFamily: "'DM Mono',monospace",
                              fontSize: row.isTotal ? 13 : 12,
                              fontWeight:
                                row.isTotal || row.highlighted ? 900 : 700,
                            }}
                          >
                            {formatStoryPointsCell(value)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
