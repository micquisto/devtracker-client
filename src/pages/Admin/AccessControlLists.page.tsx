import { useEffect, useState } from "react";
import { Card } from "@/components/shared/Containers";
import { Title } from "@/components/shared/page";
import { getSupabaseRows, supabase } from "@/lib/supabase";
import "@/assets/styles/RequirementsData.page.css";

type AccessControlRow = {
  id: string;
  role: string;
  page_id: string;
  page_label: string;
  can_access: boolean;
};

type AccessControlInsertRow = {
  role: string;
  page_id: string;
  page_label: string;
  can_access: boolean;
};

type AccessControlResource = {
  id: string;
  label: string;
  children?: AccessControlResource[];
};

const ACCESS_CONTROL_TREE: AccessControlResource[] = [
  { id: "dashboard", label: "Dashboard" },
  {
    id: "scrum",
    label: "Scrum",
    children: [
      { id: "scrum-sprint", label: "Sprint" },
      { id: "scrum-tasks-list", label: "Tasks List" },
      { id: "scrum-story-points", label: "Story Points" },
    ],
  },
  { id: "profile", label: "Profile" },
  { id: "album", label: "Album" },
  {
    id: "collection",
    label: "Collection",
    children: [
      { id: "col-heroes", label: "Heroes" },
      { id: "col-skins", label: "Skins" },
      { id: "col-emblems", label: "Emblems" },
    ],
  },
  { id: "history", label: "History" },
  {
    id: "battlefield",
    label: "Accountabilities",
    children: [
      { id: "stats", label: "Statistics" },
      { id: "favorite", label: "Favorite" },
      { id: "replays", label: "Replays" },
    ],
  },
  { id: "credit", label: "Credit Score" },
  { id: "test", label: "Test" },
  { id: "app-flow", label: "App Flow" },
  {
    id: "admin",
    label: "Admin",
    children: [
      {
        id: "admin-data-override",
        label: "Data Override",
        children: [
          { id: "admin-requirements-data", label: "Requirements Data" },
          { id: "admin-sprint-requirements", label: "Sprint Requirements" },
          { id: "admin-sprint-data", label: "Sprint Data" },
        ],
      },
      {
        id: "admin-user",
        label: "Users",
        children: [
          { id: "admin-user-change-passwords", label: "Change Passwords" },
        ],
      },
      { id: "admin-access-control-lists", label: "Access Control Lists" },
    ],
  },
];

function flattenResources(resources: AccessControlResource[]): AccessControlResource[] {
  return resources.flatMap((resource) => [
    resource,
    ...flattenResources(resource.children ?? []),
  ]);
}

function getResourceDescendantIds(resource: AccessControlResource): string[] {
  return [
    resource.id,
    ...(resource.children ?? []).flatMap(getResourceDescendantIds),
  ];
}

const ACCESS_CONTROL_PAGES = flattenResources(ACCESS_CONTROL_TREE);

const CONFIGURABLE_ROLES = [
  "developer",
  "senior_developer",
  "project_manager",
  "qa_engineer",
  "desinger",
];

function normalizeRole(role: string): string {
  return role.trim().toLowerCase();
}

function formatRoleLabel(role: string): string {
  return role
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

export default function AccessControlListsPage() {
  const [roles, setRoles] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState("");
  const [aclRows, setAclRows] = useState<AccessControlRow[]>([]);
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadRoles(): Promise<void> {
    const roleValues = CONFIGURABLE_ROLES;

    setRoles(roleValues);
    setSelectedRole((current) => current || roleValues[0] || "");
  }

  async function loadAcl(role: string): Promise<void> {
    if (!role) {
      setAclRows([]);
      setSelectedPageIds(new Set());
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const rows = await getSupabaseRows<AccessControlRow>("access_control_lists", {
        select: "id,role,page_id,page_label,can_access",
        eq: { role },
        order: { column: "page_label", ascending: true },
      });

      setAclRows(rows);
      setSelectedPageIds(
        new Set(rows.filter((row) => row.can_access).map((row) => row.page_id)),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRoles().catch((error) => {
      setMessage(
        error instanceof Error ? error.message : "Unable to load member roles.",
      );
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    void loadAcl(selectedRole);
  }, [selectedRole]);

  function togglePage(pageId: string): void {
    setSelectedPageIds((current) => {
      const next = new Set(current);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  }

  function toggleResource(resource: AccessControlResource): void {
    const resourceIds = getResourceDescendantIds(resource);
    setSelectedPageIds((current) => {
      const next = new Set(current);
      const shouldSelect = resourceIds.some((id) => !next.has(id));

      for (const id of resourceIds) {
        if (shouldSelect) next.add(id);
        else next.delete(id);
      }

      return next;
    });
  }

  function isResourceChecked(resource: AccessControlResource): boolean {
    return getResourceDescendantIds(resource).every((id) => selectedPageIds.has(id));
  }

  function isResourcePartial(resource: AccessControlResource): boolean {
    const ids = getResourceDescendantIds(resource);
    return ids.some((id) => selectedPageIds.has(id)) && !ids.every((id) => selectedPageIds.has(id));
  }

  function renderResourceNode(resource: AccessControlResource, depth = 0) {
    const hasChildren = Boolean(resource.children?.length);
    const checked = isResourceChecked(resource);
    const partial = isResourcePartial(resource);

    return (
      <div className="acl-tree-node" key={resource.id}>
        <label
          className={`acl-tree-row ${hasChildren ? "is-parent" : "is-leaf"}`}
          style={{ paddingLeft: 12 + depth * 22 }}
        >
          <input
            checked={checked}
            onChange={() => {
              if (hasChildren) toggleResource(resource);
              else togglePage(resource.id);
            }}
            ref={(element) => {
              if (element) element.indeterminate = partial;
            }}
            type="checkbox"
          />
          <span className="acl-tree-label">{resource.label}</span>
          <span className="acl-tree-id">{resource.id}</span>
        </label>
        {resource.children?.length ? (
          <div className="acl-tree-children">
            {resource.children.map((child) => renderResourceNode(child, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  }

  async function saveAcl(): Promise<void> {
    setSaving(true);
    setMessage(null);

    try {
      const { error: deleteError } = await supabase
        .from("access_control_lists")
        .delete()
        .eq("role", selectedRole);

      if (deleteError) throw deleteError;

      const rows: AccessControlInsertRow[] = ACCESS_CONTROL_PAGES.map((page) => ({
        role: selectedRole,
        page_id: page.id,
        page_label: page.label,
        can_access: selectedPageIds.has(page.id),
      }));
      const { error } = await supabase.from("access_control_lists").insert(rows);

      if (error) throw error;

      await loadAcl(selectedRole);
      setMessage(`Saved ACL for ${formatRoleLabel(selectedRole)}.`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save access control list.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="requirements-data-page">
      <Title
        eyebrow="Admin"
        title="Access Control Lists"
        subtitle="Configure menu and page visibility for each member role."
        size="large"
      />

      <Card className="requirements-data-card">
        <div className="requirements-data-table-header">
          <div>
            <div className="requirements-data-kicker">Role Access</div>
            <h3>Menu Visibility</h3>
          </div>
          <div className="requirements-data-table-tools">
            <label className="requirements-data-filter-field">
              <span>Role</span>
              <div className="requirements-data-select-wrap">
                <select
                  value={selectedRole}
                  onChange={(event) => setSelectedRole(normalizeRole(event.target.value))}
                >
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {formatRoleLabel(role)}
                    </option>
                  ))}
                </select>
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
              </div>
            </label>
            <button
              className="requirements-data-submit"
              disabled={saving || !selectedRole}
              onClick={() => void saveAcl()}
              type="button"
            >
              {saving ? "Saving..." : "Save ACL"}
            </button>
          </div>
        </div>

        {message ? (
          <div className="requirements-data-message is-success">{message}</div>
        ) : null}

        {loading ? (
          <div className="requirements-data-empty">Loading access rules...</div>
        ) : (
          <div className="acl-tree">
            <div className="acl-tree-toolbar">
              <span>{selectedPageIds.size} resources selected</span>
              <span>
                {aclRows.length > 0 ? "Configured role" : "Default until saved"}
              </span>
            </div>
            <div className="acl-tree-panel">
              {ACCESS_CONTROL_TREE.map((resource) => renderResourceNode(resource))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
