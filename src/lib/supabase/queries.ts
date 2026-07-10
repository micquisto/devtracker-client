import { supabase } from "./client";

type SupabaseFilterValue = string | number | boolean | null;
type SupabaseValue = string | number | boolean | null | Record<string, unknown>;
type SupabaseRow = Record<string, SupabaseValue>;

type SupabaseInFilterValue = string | number;

type SupabaseOrder = {
  column: string;
  ascending?: boolean;
};

export type GetSupabaseRowsOptions = {
  select?: string;
  eq?: Record<string, SupabaseFilterValue>;
  in?: Record<string, SupabaseInFilterValue[]>;
  order?: SupabaseOrder;
  limit?: number;
};

export type SupabaseJoin = {
  table: string;
  alias?: string;
  columns?: string[];
  modifier?: string;
};

export type GetSupabaseJoinedRowsOptions = Omit<
  GetSupabaseRowsOptions,
  "select"
> & {
  columns?: string[];
  joins: SupabaseJoin[];
};

export type MutateSupabaseRowsOptions = {
  select?: string;
  eq: Record<string, SupabaseFilterValue>;
};

function ensureFilters(eq: Record<string, SupabaseFilterValue>): void {
  if (Object.keys(eq).length === 0) {
    throw new Error("At least one equality filter is required.");
  }
}

function buildSupabaseJoinSelect(
  columns: string[] = ["*"],
  joins: SupabaseJoin[],
): string {
  const joinedTables = joins.map(({ table, alias, columns, modifier }) => {
    const relationName = `${alias ? `${alias}:` : ""}${table}`;
    const relationModifier = modifier ? `!${modifier}` : "";
    const relationColumns = columns?.length ? columns.join(",") : "*";

    return `${relationName}${relationModifier}(${relationColumns})`;
  });

  return [...columns, ...joinedTables].join(",");
}

export async function getSupabaseRows<T>(
  table: string,
  options: GetSupabaseRowsOptions = {},
): Promise<T[]> {
  const { select = "*", eq = {}, in: inFilters = {}, order, limit } = options;
  const resolvedOrder =
    order ??
    (table === "members"
      ? { column: "last_name", ascending: true }
      : undefined);

  let query = supabase.from(table).select(select);

  for (const [column, value] of Object.entries(eq)) {
    query = query.eq(column, value);
  }

  for (const [column, values] of Object.entries(inFilters)) {
    if (values.length > 0) {
      query = query.in(column, values);
    }
  }

  if (resolvedOrder) {
    query = query.order(resolvedOrder.column, {
      ascending: resolvedOrder.ascending ?? true,
    });
  }

  if (typeof limit === "number") {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []) as T[];
}

export async function getSupabaseJoinedRows<T>(
  table: string,
  options: GetSupabaseJoinedRowsOptions,
): Promise<T[]> {
  const { columns, joins, ...queryOptions } = options;

  return getSupabaseRows<T>(table, {
    ...queryOptions,
    select: buildSupabaseJoinSelect(columns, joins),
  });
}

export async function insertSupabaseRows<T, TRow extends SupabaseRow>(
  table: string,
  rows: TRow | TRow[],
  select = "*",
): Promise<T[]> {
  const { data, error } = await supabase
    .from(table)
    .insert(rows as never)
    .select(select);

  if (error) {
    throw error;
  }

  return (data ?? []) as T[];
}

export async function updateSupabaseRows<T, TRow extends SupabaseRow>(
  table: string,
  values: Partial<TRow>,
  options: MutateSupabaseRowsOptions,
): Promise<T[]> {
  const { select = "*", eq } = options;
  ensureFilters(eq);

  let query = supabase.from(table).update(values as never);

  for (const [column, value] of Object.entries(eq)) {
    query = query.eq(column, value);
  }

  const { data, error } = await query.select(select);

  if (error) {
    throw error;
  }

  return (data ?? []) as T[];
}

export async function deleteSupabaseRows<T>(
  table: string,
  options: MutateSupabaseRowsOptions,
): Promise<T[]> {
  const { select = "*", eq } = options;
  ensureFilters(eq);

  let query = supabase.from(table).delete();

  for (const [column, value] of Object.entries(eq)) {
    query = query.eq(column, value);
  }

  const { data, error } = await query.select(select);

  if (error) {
    throw error;
  }

  return (data ?? []) as T[];
}
