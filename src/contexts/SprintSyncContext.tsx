import { syncCurrentSprintTasks } from "@/lib/utils";
import {
  BACKGROUND_PROCESS_KEYS,
} from "@/lib/backgroundProcesses/backgroundProcess.registry";
import { getBackgroundProcessIntervalMs } from "@/lib/backgroundProcesses/backgroundProcess.config";
import { runTrackedBackgroundProcess } from "@/lib/backgroundProcesses/backgroundProcessRun.service";
import {
  useBackgroundProcess,
  useBackgroundProcessEnabled,
  useBackgroundProcesses,
} from "@/contexts/BackgroundProcessContext";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import "@/assets/styles/Sprint.page.css";

export type SprintSyncTrigger = "manual" | "auto" | "scheduled";

type RunSyncOptions = {
  sprintId?: string;
  sprintStatus?: string;
  trigger?: SprintSyncTrigger;
};

type SprintSyncContextValue = {
  isSyncing: boolean;
  syncProgressPercent: number | null;
  syncVersion: number;
  lastError: string | null;
  lastMessage: string | null;
  runSync: (
    options?: RunSyncOptions,
  ) => ReturnType<typeof syncCurrentSprintTasks>;
};

const SprintSyncContext = createContext<SprintSyncContextValue | null>(null);

type SprintSyncProviderProps = {
  children: ReactNode;
};

export function SprintSyncProvider({
  children,
}: SprintSyncProviderProps) {
  const { loading: backgroundProcessesLoading, refreshProcesses, patchProcess } =
    useBackgroundProcesses();
  const sprintTrelloSyncProcess = useBackgroundProcess(
    BACKGROUND_PROCESS_KEYS.SPRINT_TRELLO_SYNC,
  );
  const autoSyncEnabled = useBackgroundProcessEnabled(
    BACKGROUND_PROCESS_KEYS.SPRINT_TRELLO_SYNC,
  );
  const syncIntervalMs = getBackgroundProcessIntervalMs(sprintTrelloSyncProcess);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgressPercent, setSyncProgressPercent] = useState<number | null>(
    null,
  );
  const [syncVersion, setSyncVersion] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [syncIndicatorCollapsed, setSyncIndicatorCollapsed] = useState(false);
  const isSyncingRef = useRef(false);

  const runSync = useCallback(async (options: RunSyncOptions = {}) => {
    const trigger = options.trigger ?? "manual";

    if (
      (trigger === "scheduled" || trigger === "auto") &&
      !autoSyncEnabled
    ) {
      return {
        cards: [],
        result: {
          action: "skipped" as const,
          message: "Sprint Trello auto-sync is disabled.",
          sprint: null,
          cardsFetched: 0,
          tasksDeleted: 0,
          tasksInserted: 0,
        },
      };
    }

    if (isSyncingRef.current) {
      if (trigger === "scheduled" || trigger === "auto") {
        return {
          cards: [],
          result: {
            action: "skipped" as const,
            message: "A Trello sync is already in progress.",
            sprint: null,
            cardsFetched: 0,
            tasksDeleted: 0,
            tasksInserted: 0,
          },
        };
      }
    }

    while (isSyncingRef.current) {
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }

    isSyncingRef.current = true;
    setIsSyncing(true);
    setSyncProgressPercent(0);
    setLastError(null);

    try {
      const result = await runTrackedBackgroundProcess(
        BACKGROUND_PROCESS_KEYS.SPRINT_TRELLO_SYNC,
        () =>
          syncCurrentSprintTasks({
            sprintId: options.sprintId,
            sprintStatus: options.sprintStatus,
            onProgress: ({ percent }) => {
              setSyncProgressPercent(percent);
            },
          }),
        {
          onStateChange: (row) => {
            if (row) patchProcess(row);
            void refreshProcesses();
          },
        },
      );
      setLastMessage(result.result.message);
      setSyncVersion((value) => value + 1);
      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to sync Trello cards.";
      setLastError(message);
      throw error;
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
      setSyncProgressPercent(null);
      void refreshProcesses();
    }
  }, [autoSyncEnabled, refreshProcesses, patchProcess]);

  useEffect(() => {
    if (
      backgroundProcessesLoading ||
      !autoSyncEnabled ||
      syncIntervalMs === null
    ) {
      return;
    }

    let intervalId: number | undefined;

    const startSyncSchedule = () => {
      void runSync({ trigger: "auto" });

      intervalId = window.setInterval(() => {
        void runSync({ trigger: "scheduled" });
      }, syncIntervalMs);
    };

    const onPageLoad = () => {
      startSyncSchedule();
    };

    if (document.readyState === "complete") {
      startSyncSchedule();
    } else {
      window.addEventListener("load", onPageLoad, { once: true });
    }

    return () => {
      window.removeEventListener("load", onPageLoad);
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
      }
    };
  }, [
    backgroundProcessesLoading,
    autoSyncEnabled,
    syncIntervalMs,
    runSync,
  ]);

  useEffect(() => {
    if (!isSyncing) {
      setSyncIndicatorCollapsed(false);
      return;
    }

    setSyncIndicatorCollapsed(false);

    const timeoutId = window.setTimeout(() => {
      setSyncIndicatorCollapsed(true);
    }, 5000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isSyncing]);

  const value = useMemo(
    () => ({
      isSyncing,
      syncProgressPercent,
      syncVersion,
      lastError,
      lastMessage,
      runSync,
    }),
    [isSyncing, syncProgressPercent, syncVersion, lastError, lastMessage, runSync],
  );

  return (
    <SprintSyncContext.Provider value={value}>
      {isSyncing ? (
        <button
          aria-expanded={!syncIndicatorCollapsed}
          aria-label={
            syncIndicatorCollapsed
              ? `Syncing data in progress${
                  syncProgressPercent !== null
                    ? ` ${syncProgressPercent}%`
                    : ""
                }. Click to expand.`
              : `Syncing data in progress${
                  syncProgressPercent !== null
                    ? ` ${syncProgressPercent}%`
                    : ""
                }. Click to collapse.`
          }
          className={`sprint-floating-sync-indicator${
            syncIndicatorCollapsed
              ? " sprint-floating-sync-indicator--collapsed"
              : ""
          }`}
          onClick={() => setSyncIndicatorCollapsed((collapsed) => !collapsed)}
          type="button"
        >
          <span className="sprint-action-loader" aria-hidden="true" />
          <span className="sprint-floating-sync-indicator__label">
            Syncing data in progress
            {syncProgressPercent !== null ? ` ${syncProgressPercent}%` : ""}
          </span>
        </button>
      ) : null}
      {children}
    </SprintSyncContext.Provider>
  );
}

export function useSprintSync(): SprintSyncContextValue {
  const context = useContext(SprintSyncContext);
  if (!context) {
    throw new Error("useSprintSync must be used within SprintSyncProvider.");
  }

  return context;
}
