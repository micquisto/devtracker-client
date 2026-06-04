import { useCallback, useState } from "react";
import { Card } from "@/components/shared/Containers";
import { Title } from "@/components/shared/page";
import { getTrelloSprintCards, type TrelloSprintCard } from "@/lib/utils";
import {
  createSupabaseAuthUsers,
  getSupabaseRows,
  insertSupabaseRows,
  type CreateSupabaseAuthUserResult,
  updateSupabaseRows,
} from "@/lib/supabase";
import { Border, Palette, Text } from "@/lib/theme";
import "@/assets/styles/Test.page.css";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | Date
  | JsonValue[]
  | { [key: string]: JsonValue };

type FetchState = {
  data: TrelloSprintCard[] | null;
  loading: boolean;
  error: string | null;
};

type CreateUsersState = {
  data: CreateSupabaseAuthUserResult[] | null;
  loading: boolean;
  error: string | null;
};

type ProjectRow = {
  trello_board_id: string;
  name: string;
  status: string;
};

type ProjectUpdateResult = ProjectRow & {
  action: "inserted" | "updated";
};

type UpdateProjectsState = {
  data: ProjectUpdateResult[] | null;
  loading: boolean;
  error: string | null;
};

type SupabaseLikeError = {
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  code?: unknown;
};

const TEST_USER_EMAILS = [
  "michaelq@plumbersstock.com",
  "doerr@plumbersstock.com",
  "louiegualingco01@gmail.com",
  "joshuab@plumbersstock.com",
  "joshuap@plumbersstock.com",
  "thomasz@plumbersstock.com",
];

const TRELLO_CUSTOM_FIELD_NAMES = ["Date Completed","Assignee", "Severity", "Priority", "Type", "Status", "Date Added"];

const TRELLO_LIST_NAMES = ["Current Sprint", "In Development", "For Dev Deployment", "On Dev Environment"];

const PROJECTS: ProjectRow[] = [
  { trello_board_id: "5oj0clmi", name: "All DevDenPH", status: "active" },
  { trello_board_id: "5oj0clmi", name: "PSLite Symfony Backend", status: "active" },
  { trello_board_id: "5oj0clmi", name: "PSLite Symfony Frontend", status: "active" },
  { trello_board_id: "5oj0clmi", name: "Adams & Co", status: "active" },
  { trello_board_id: "5oj0clmi", name: "PS Edit", status: "active" },
  { trello_board_id: "5oj0clmi", name: "Legacy Frontend", status: "active" },
  { trello_board_id: "5oj0clmi", name: "Legacy Backend", status: "active" },
  { trello_board_id: "5oj0clmi", name: "MonekyWrench", status: "active" },
  { trello_board_id: "5oj0clmi", name: "PPN", status: "active" },
  { trello_board_id: "l7BOmeGw", name: "All Gilbor's Team", status: "active" },
];

const TEST_USER_PASSWORD = "P@55W0rd";

function isRecord(value: JsonValue): value is { [key: string]: JsonValue } {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  );
}

function formatPrimitive(value: JsonValue): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (typeof value === "string") return JSON.stringify(value);
  return String(value);
}

function formatUnknownError(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  if (error && typeof error === "object") {
    const supabaseError = error as SupabaseLikeError;
    const parts = [
      supabaseError.message,
      supabaseError.details,
      supabaseError.hint,
      supabaseError.code ? `Code: ${String(supabaseError.code)}` : undefined,
    ].filter((item): item is string => typeof item === "string" && item.length > 0);

    if (parts.length > 0) return parts.join(" ");
    return JSON.stringify(error);
  }

  return fallback;
}

function JsonTree({
  label,
  value,
  defaultOpen = false,
}: {
  label: string;
  value: JsonValue;
  defaultOpen?: boolean;
}) {
  if (Array.isArray(value)) {
    return (
      <details open={defaultOpen} style={{ marginLeft: 12 }}>
        <summary style={{ cursor: "pointer", color: Palette.cyan }}>
          {label}: Array({value.length})
        </summary>
        <div style={{ marginLeft: 12 }}>
          {value.map((item, index) => (
            <JsonTree key={index} label={String(index)} value={item} />
          ))}
        </div>
      </details>
    );
  }

  if (isRecord(value)) {
    const entries = Object.entries(value);

    return (
      <details open={defaultOpen} style={{ marginLeft: 12 }}>
        <summary style={{ cursor: "pointer", color: Palette.cyan }}>
          {label}: Object({entries.length})
        </summary>
        <div style={{ marginLeft: 12 }}>
          {entries.map(([key, item]) => (
            <JsonTree key={key} label={key} value={item} />
          ))}
        </div>
      </details>
    );
  }

  return (
    <div style={{ marginLeft: 24 }}>
      <span style={{ color: Text.faint }}>{label}: </span>
      <span style={{ color: "#e8f4ff" }}>{formatPrimitive(value)}</span>
    </div>
  );
}

export default function TestPage() {
  const [state, setState] = useState<FetchState>({
    data: null,
    loading: false,
    error: null,
  });
  const [createUsersState, setCreateUsersState] = useState<CreateUsersState>({
    data: null,
    loading: false,
    error: null,
  });
  const [updateProjectsState, setUpdateProjectsState] =
    useState<UpdateProjectsState>({
      data: null,
      loading: false,
      error: null,
    });

  const fetchCards = useCallback(async () => {
    setState({ data: null, loading: true, error: null });

    try {
      const data = await getTrelloSprintCards({
        boardIds: null,
        listNames: TRELLO_LIST_NAMES,
        customFieldNames: TRELLO_CUSTOM_FIELD_NAMES,
      });
      setState({ data, loading: false, error: null });
    } catch (error) {
      setState({
        data: null,
        loading: false,
        error: error instanceof Error ? error.message : "Unable to fetch Trello cards.",
      });
    }
  }, []);

  const createUsers = useCallback(async () => {
    setCreateUsersState({ data: null, loading: true, error: null });

    try {
      const data = await createSupabaseAuthUsers(
        TEST_USER_EMAILS,
        TEST_USER_PASSWORD,
      );
      setCreateUsersState({ data, loading: false, error: null });
    } catch (error) {
      setCreateUsersState({
        data: null,
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to create Supabase auth users.",
      });
    }
  }, []);

  const updateProjects = useCallback(async () => {
    setUpdateProjectsState({ data: null, loading: true, error: null });

    try {
      const results: ProjectUpdateResult[] = [];

      for (const project of PROJECTS) {
        const existingProjects = await getSupabaseRows<ProjectRow>("projects", {
          eq: { name: project.name },
          limit: 1,
        });

        if (existingProjects.length > 0) {
          await updateSupabaseRows<ProjectRow, ProjectRow>("projects", project, {
            eq: { name: project.name },
          });
          results.push({ ...project, action: "updated" });
          continue;
        }

        await insertSupabaseRows<ProjectRow, ProjectRow>("projects", project);
        results.push({ ...project, action: "inserted" });
      }

      setUpdateProjectsState({
        data: results,
        loading: false,
        error: null,
      });
    } catch (error) {
      setUpdateProjectsState({
        data: null,
        loading: false,
        error: formatUnknownError(error, "Unable to update projects."),
      });
    }
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "calc(100vh - 96px)",
        padding: "20px 0 0",
        textAlign: "left",
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <Title
          title="Test"
          eyebrow="Trello API"
          subtitle="Current Sprint cards rendered as collapsible JSON"
        />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => void updateProjects()}
            disabled={updateProjectsState.loading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              borderRadius: 999,
              border: `1px solid ${Border.default}`,
              background: updateProjectsState.loading
                ? "rgba(255,255,255,0.04)"
                : "rgba(245,200,66,0.12)",
              color: updateProjectsState.loading ? Text.faint : Palette.gold,
              cursor: updateProjectsState.loading ? "not-allowed" : "pointer",
              fontFamily: "'DM Mono', monospace",
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            {updateProjectsState.loading && (
              <span
                aria-hidden="true"
                className="test-page__button-loader"
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  border: `2px solid ${Text.faint}`,
                  borderTopColor: Palette.gold,
                }}
              />
            )}
            {updateProjectsState.loading ? "Updating..." : "Update Projects"}
          </button>
          <button
            onClick={() => void createUsers()}
            disabled={createUsersState.loading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              borderRadius: 999,
              border: `1px solid ${Border.default}`,
              background: createUsersState.loading
                ? "rgba(255,255,255,0.04)"
                : "rgba(0,229,160,0.12)",
              color: createUsersState.loading ? Text.faint : "#00e5a0",
              cursor: createUsersState.loading ? "not-allowed" : "pointer",
              fontFamily: "'DM Mono', monospace",
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            {createUsersState.loading && (
              <span
                aria-hidden="true"
                className="test-page__button-loader"
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  border: `2px solid ${Text.faint}`,
                  borderTopColor: "#00e5a0",
                }}
              />
            )}
            {createUsersState.loading ? "Creating..." : "Create users"}
          </button>
          <button
            onClick={() => void fetchCards()}
            disabled={state.loading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              borderRadius: 999,
              border: `1px solid ${Border.default}`,
              background: state.loading
                ? "rgba(255,255,255,0.04)"
                : "rgba(0,200,255,0.12)",
              color: state.loading ? Text.faint : Palette.cyan,
              cursor: state.loading ? "not-allowed" : "pointer",
              fontFamily: "'DM Mono', monospace",
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            {state.loading && (
              <span
                aria-hidden="true"
                className="test-page__button-loader"
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  border: `2px solid ${Text.faint}`,
                  borderTopColor: Palette.cyan,
                }}
              />
            )}
            {state.loading ? "Syncing..." : "Sync with Trello"}
          </button>
        </div>
      </div>

      <Card
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          padding: 16,
          width: "100%",
        }}
      >
        {updateProjectsState.loading && (
          <p style={{ color: Text.faint, margin: "0 0 14px" }}>
            Updating projects...
          </p>
        )}

        {updateProjectsState.error && (
          <pre
            style={{
              margin: "0 0 14px",
              whiteSpace: "pre-wrap",
              color: "#ff8d8d",
              fontFamily: "'DM Mono', monospace",
              fontSize: 12,
            }}
          >
            {updateProjectsState.error}
          </pre>
        )}

        {updateProjectsState.data && (
          <div
            style={{
              borderBottom: `1px solid ${Border.faint}`,
              color: Text.label,
              fontFamily: "'DM Mono', monospace",
              fontSize: 12,
              lineHeight: 1.7,
              marginBottom: 14,
              maxHeight: 260,
              overflow: "auto",
              paddingBottom: 14,
              textAlign: "left",
              width: "100%",
            }}
          >
            <JsonTree
              label="updatedProjects"
              value={updateProjectsState.data as unknown as JsonValue}
              defaultOpen
            />
          </div>
        )}

        {createUsersState.loading && (
          <p style={{ color: Text.faint, margin: "0 0 14px" }}>
            Creating Supabase auth users...
          </p>
        )}

        {createUsersState.error && (
          <pre
            style={{
              margin: "0 0 14px",
              whiteSpace: "pre-wrap",
              color: "#ff8d8d",
              fontFamily: "'DM Mono', monospace",
              fontSize: 12,
            }}
          >
            {createUsersState.error}
          </pre>
        )}

        {createUsersState.data && (
          <div
            style={{
              borderBottom: `1px solid ${Border.faint}`,
              color: Text.label,
              fontFamily: "'DM Mono', monospace",
              fontSize: 12,
              lineHeight: 1.7,
              marginBottom: 14,
              maxHeight: 260,
              overflow: "auto",
              paddingBottom: 14,
              textAlign: "left",
              width: "100%",
            }}
          >
            <JsonTree
              label="createdUsers"
              value={createUsersState.data as unknown as JsonValue}
              defaultOpen
            />
          </div>
        )}

        {!updateProjectsState.loading &&
          !updateProjectsState.error &&
          !updateProjectsState.data &&
          !createUsersState.loading &&
          !createUsersState.error &&
          !createUsersState.data &&
          !state.loading &&
          !state.error &&
          !state.data && (
          <p style={{ color: Text.faint, margin: 0 }}>
            Click Sync with Trello to fetch Current Sprint cards.
          </p>
        )}

        {state.loading && (
          <p style={{ color: Text.faint, margin: 0 }}>Fetching Trello cards...</p>
        )}

        {state.error && (
          <pre
            style={{
              margin: 0,
              whiteSpace: "pre-wrap",
              color: "#ff8d8d",
              fontFamily: "'DM Mono', monospace",
              fontSize: 12,
            }}
          >
            {state.error}
          </pre>
        )}

        {state.data && (
          <div
            style={{
              color: Text.label,
              fontFamily: "'DM Mono', monospace",
              fontSize: 12,
              height: "100%",
              lineHeight: 1.7,
              overflow: "auto",
              textAlign: "left",
              width: "100%",
            }}
          >
            <JsonTree label="cards" value={state.data as unknown as JsonValue} defaultOpen />
          </div>
        )}
      </Card>
    </div>
  );
}
