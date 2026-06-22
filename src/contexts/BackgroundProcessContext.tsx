import {
  DEFAULT_BACKGROUND_PROCESSES,
  isMissingBackgroundProcessesTableError,
} from "@/lib/backgroundProcesses/backgroundProcess.defaults";
import { findBackgroundProcess } from "@/lib/backgroundProcesses/backgroundProcess.config";
import { getBackgroundProcessErrorMessage } from "@/lib/backgroundProcesses/backgroundProcess.errors";
import { normalizeBackgroundProcessRows } from "@/lib/backgroundProcesses/backgroundProcess.mapper";
import {
  type BackgroundProcessKey,
  type BackgroundProcessRow,
} from "@/lib/backgroundProcesses/backgroundProcess.registry";
import { getSupabaseRows, supabase } from "@/lib/supabase";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type { BackgroundProcessRow };

const BACKGROUND_PROCESS_SELECT = "*";

async function loadBackgroundProcessRows(): Promise<BackgroundProcessRow[]> {
  const rows = await getSupabaseRows<Record<string, unknown>>(
    "background_processes",
    {
      select: BACKGROUND_PROCESS_SELECT,
    },
  );

  return normalizeBackgroundProcessRows(rows).sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

type BackgroundProcessContextValue = {
  processes: BackgroundProcessRow[];
  loading: boolean;
  error: string | null;
  usingDefaults: boolean;
  version: number;
  getProcess: (processKey: BackgroundProcessKey) => BackgroundProcessRow | null;
  isProcessEnabled: (processKey: BackgroundProcessKey) => boolean;
  refreshProcesses: () => Promise<void>;
  patchProcess: (row: BackgroundProcessRow) => void;
  setProcessesEnabled: (
    processKeys: BackgroundProcessKey[],
    enabled: boolean,
  ) => Promise<void>;
  updateBackgroundProcess: (input: {
    processKey: BackgroundProcessKey;
    frequency: string;
    frequency_interval_ms: number;
    is_enabled: boolean;
  }) => Promise<void>;
};

const BackgroundProcessContext =
  createContext<BackgroundProcessContextValue | null>(null);

type BackgroundProcessProviderProps = {
  children: ReactNode;
};

async function ensureBackgroundProcessRecords(): Promise<void> {
  const { error } = await supabase.rpc("ensure_background_processes");
  if (error) {
    throw error;
  }
}

export function BackgroundProcessProvider({
  children,
}: BackgroundProcessProviderProps) {
  const [processes, setProcesses] = useState<BackgroundProcessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingDefaults, setUsingDefaults] = useState(false);
  const [version, setVersion] = useState(0);

  const refreshProcesses = useCallback(async () => {
    setError(null);

    try {
      await ensureBackgroundProcessRecords().catch((ensureError) => {
        if (!isMissingBackgroundProcessesTableError(ensureError)) {
          throw ensureError;
        }
      });

      const normalizedRows = await loadBackgroundProcessRows();

      setProcesses(normalizedRows);
      setUsingDefaults(false);
      setVersion((value) => value + 1);
    } catch (loadError) {
      if (isMissingBackgroundProcessesTableError(loadError)) {
        setProcesses(DEFAULT_BACKGROUND_PROCESSES);
        setUsingDefaults(true);
        setError(
          "Background process settings table is not available yet. Using defaults until the database migration is applied.",
        );
        setVersion((value) => value + 1);
        return;
      }

      setError(
        getBackgroundProcessErrorMessage(
          loadError,
          "Unable to load background processes.",
        ),
      );
    }
  }, []);

  const patchProcess = useCallback((row: BackgroundProcessRow) => {
    setProcesses((current) => {
      const next = current.some((process) => process.process_key === row.process_key)
        ? current.map((process) =>
            process.process_key === row.process_key ? row : process,
          )
        : [...current, row];

      return next.sort((left, right) => left.name.localeCompare(right.name));
    });
    setVersion((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialProcesses(): Promise<void> {
      setLoading(true);
      await refreshProcesses();
      if (!cancelled) setLoading(false);
    }

    void loadInitialProcesses();

    const channel = supabase
      .channel("background-processes-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "background_processes" },
        () => {
          void refreshProcesses();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [refreshProcesses]);

  const getProcess = useCallback(
    (processKey: BackgroundProcessKey) =>
      findBackgroundProcess(processes, processKey),
    [processes],
  );

  const isProcessEnabled = useCallback(
    (processKey: BackgroundProcessKey) => {
      const process = findBackgroundProcess(processes, processKey);
      return process?.is_enabled ?? false;
    },
    [processes],
  );

  const setProcessesEnabled = useCallback(
    async (processKeys: BackgroundProcessKey[], enabled: boolean) => {
      if (processKeys.length === 0) return;

      if (usingDefaults) {
        throw new Error(
          "Background process settings are unavailable until the database migration is applied.",
        );
      }

      setError(null);

      const { error: updateError } = await supabase
        .from("background_processes")
        .update({ is_enabled: enabled })
        .in("process_key", processKeys);

      if (updateError) {
        throw updateError;
      }

      await refreshProcesses();
    },
    [refreshProcesses, usingDefaults],
  );

  const updateBackgroundProcess = useCallback(
    async (input: {
      processKey: BackgroundProcessKey;
      frequency: string;
      frequency_interval_ms: number;
      is_enabled: boolean;
    }) => {
      if (usingDefaults) {
        throw new Error(
          "Background process settings are unavailable until the database migration is applied.",
        );
      }

      setError(null);

      const { error: updateError } = await supabase
        .from("background_processes")
        .update({
          frequency: input.frequency,
          frequency_interval_ms: input.frequency_interval_ms,
          is_enabled: input.is_enabled,
        })
        .eq("process_key", input.processKey);

      if (updateError) {
        throw updateError;
      }

      await refreshProcesses();
    },
    [refreshProcesses, usingDefaults],
  );

  const value = useMemo(
    () => ({
      processes,
      loading,
      error,
      usingDefaults,
      version,
      getProcess,
      isProcessEnabled,
      refreshProcesses,
      patchProcess,
      setProcessesEnabled,
      updateBackgroundProcess,
    }),
    [
      processes,
      loading,
      error,
      usingDefaults,
      version,
      getProcess,
      isProcessEnabled,
      refreshProcesses,
      patchProcess,
      setProcessesEnabled,
      updateBackgroundProcess,
    ],
  );

  return (
    <BackgroundProcessContext.Provider value={value}>
      {children}
    </BackgroundProcessContext.Provider>
  );
}

export function useBackgroundProcesses(): BackgroundProcessContextValue {
  const context = useContext(BackgroundProcessContext);
  if (!context) {
    throw new Error(
      "useBackgroundProcesses must be used within BackgroundProcessProvider.",
    );
  }

  return context;
}

export function useBackgroundProcess(
  processKey: BackgroundProcessKey,
): BackgroundProcessRow | null {
  const { getProcess } = useBackgroundProcesses();
  return getProcess(processKey);
}

export function useBackgroundProcessEnabled(
  processKey: BackgroundProcessKey,
): boolean {
  const { isProcessEnabled } = useBackgroundProcesses();
  return isProcessEnabled(processKey);
}
