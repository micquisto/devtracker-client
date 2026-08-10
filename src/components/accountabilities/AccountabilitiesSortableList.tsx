import { useState, type DragEvent, type ReactNode } from "react";
import { updateSupabaseRows } from "@/lib/supabase";

type SortableItem = {
  id: string;
};

function reorderItems<T extends SortableItem>(
  items: T[],
  fromId: string,
  toId: string,
): T[] | null {
  if (fromId === toId) {
    return null;
  }

  const fromIndex = items.findIndex((item) => item.id === fromId);
  const toIndex = items.findIndex((item) => item.id === toId);
  if (fromIndex < 0 || toIndex < 0) {
    return null;
  }

  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function AccountabilitiesSortableList<T extends SortableItem>({
  items,
  disabled = false,
  className,
  itemClassName,
  onReorder,
  renderItem,
  as = "div",
}: {
  items: T[];
  disabled?: boolean;
  className?: string;
  itemClassName?: string | ((item: T, index: number) => string);
  onReorder: (nextItems: T[]) => void | Promise<void>;
  renderItem: (item: T, index: number) => ReactNode;
  as?: "div" | "ul";
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const canDrag = !disabled && !savingOrder;

  async function commitReorder(fromId: string, toId: string) {
    const nextItems = reorderItems(items, fromId, toId);
    if (!nextItems) {
      return;
    }

    setSavingOrder(true);
    try {
      await onReorder(nextItems);
    } finally {
      setSavingOrder(false);
    }
  }

  function handleDragStart(event: DragEvent<HTMLElement>, id: string) {
    if (!canDrag) {
      event.preventDefault();
      return;
    }

    setDraggingId(id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);

    const itemElement = event.currentTarget.closest(
      ".accountabilities-sortable-item",
    );
    if (itemElement instanceof HTMLElement) {
      event.dataTransfer.setDragImage(itemElement, 16, 16);
    }
  }

  function handleDragOver(event: DragEvent<HTMLElement>, id: string) {
    if (!canDrag || !draggingId || draggingId === id) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (overId !== id) {
      setOverId(id);
    }
  }

  async function handleDrop(event: DragEvent<HTMLElement>, id: string) {
    event.preventDefault();
    const fromId = event.dataTransfer.getData("text/plain") || draggingId;
    setDraggingId(null);
    setOverId(null);

    if (!fromId || !canDrag) {
      return;
    }

    await commitReorder(fromId, id);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setOverId(null);
  }

  function renderHandle(id: string) {
    if (!canDrag) {
      return null;
    }

    return (
      <span
        className="accountabilities-sortable-item__handle"
        draggable
        onDragStart={(event) => handleDragStart(event, id)}
        onDragEnd={handleDragEnd}
        aria-hidden="true"
        title="Drag to reorder"
      >
        ⋮⋮
      </span>
    );
  }

  function resolveClassName(item: T, index: number) {
    const resolvedItemClassName =
      typeof itemClassName === "function"
        ? itemClassName(item, index)
        : itemClassName;
    const isDragging = draggingId === item.id;
    const isOver = overId === item.id && draggingId !== item.id;

    return [
      resolvedItemClassName,
      "accountabilities-sortable-item",
      canDrag ? "accountabilities-sortable-item--sortable" : "",
      isDragging ? "accountabilities-sortable-item--dragging" : "",
      isOver ? "accountabilities-sortable-item--over" : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (as === "ul") {
    return (
      <ul className={className}>
        {items.map((item, index) => (
          <li
            key={item.id}
            className={resolveClassName(item, index)}
            onDragOver={(event) => handleDragOver(event, item.id)}
            onDrop={(event) => {
              void handleDrop(event, item.id);
            }}
          >
            {renderHandle(item.id)}
            <div className="accountabilities-sortable-item__content">
              {renderItem(item, index)}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className={className}>
      {items.map((item, index) => (
        <div
          key={item.id}
          className={resolveClassName(item, index)}
          onDragOver={(event) => handleDragOver(event, item.id)}
          onDrop={(event) => {
            void handleDrop(event, item.id);
          }}
        >
          {renderHandle(item.id)}
          <div className="accountabilities-sortable-item__content">
            {renderItem(item, index)}
          </div>
        </div>
      ))}
    </div>
  );
}

export function withUpdatedSortOrder<T extends SortableItem>(
  items: T[],
): Array<T & { sort_order: number }> {
  return items.map((item, index) => ({
    ...item,
    sort_order: index + 1,
  }));
}

export async function persistAccountabilitiesSortOrder(
  table: string,
  items: Array<{ id: string; sort_order: number }>,
) {
  await Promise.all(
    items.map((item) =>
      updateSupabaseRows(table, { sort_order: item.sort_order }, {
        eq: { id: item.id },
        select: "id",
      }),
    ),
  );
}
