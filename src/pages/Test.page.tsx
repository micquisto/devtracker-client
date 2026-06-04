import { useCallback, useState } from "react";
import { Card } from "@/components/shared/Containers";
import { Title } from "@/components/shared/page";
import { getTrelloSprintCards, type TrelloSprintCard } from "@/lib/utils";
import {
  createSupabaseAuthUsers,
  type CreateSupabaseAuthUserResult,
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

const TEST_USER_EMAILS = [
  "michaelq@plumbersstock.com",
  "doerr@plumbersstock.com",
  "louiegualingco01@gmail.com",
  "joshuab@plumbersstock.com",
  "joshuap@plumbersstock.com",
  "thomasz@plumbersstock.com",
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

  const fetchCards = useCallback(async () => {
    setState({ data: null, loading: true, error: null });

    try {
      const data = await getTrelloSprintCards({
        boardIds: null,
        listNames: ["Current Sprint", "In Development", "For Dev Deployment"],
        memberIds: [
          "doerrosales1",
          "joshuabalansa",
          "646441dfe7163b3877287c31",
          "louiefranzgualingco",
          "thomasandrewzaragoza1"
        ],
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

        {!state.loading && !state.error && !state.data && (
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
