import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Card } from "@/components/shared/Containers";
import { Title } from "@/components/shared/page";
import { Border, Palette, Text } from "@/lib/theme";
import "@/assets/styles/AppFlow.page.css";

type SprintStatus = "planning" | "active" | "completed" | "done";

type FlowStep = {
  id: string;
  title: string;
  summary: string;
  details: string[];
  output: string;
  accent: string;
};

type StatusRule = {
  label: string;
  behavior: string;
  taskMutation: string;
  storyPointMutation: string;
};

const STATUS_RULES: Record<SprintStatus, StatusRule> = {
  planning: {
    label: "Planning",
    behavior: "Exclude Ad hoc cards. Use Trello as the source of truth.",
    taskMutation: "Delete and replace all tasks for the selected current sprint.",
    storyPointMutation: "Refresh assigned SP from planned tasks.",
  },
  active: {
    label: "Active",
    behavior: "Include eligible Ad hoc cards and update existing sprint work.",
    taskMutation:
      "Preserve planned/adhoc tasks, update all Trello details, and keep sp_type unless moved to Blocked.",
    storyPointMutation:
      "Refresh assigned SP, adhoc SP, completed SP, and bonus points.",
  },
  completed: {
    label: "Completed",
    behavior: "Update final Trello details without rebuilding committed planned/adhoc rows.",
    taskMutation:
      "Preserve planned/adhoc tasks, update all Trello details, and keep sp_type unless moved to Blocked.",
    storyPointMutation:
      "Refresh completed SP and preserve assigned/adhoc values where gated.",
  },
  done: {
    label: "Done",
    behavior: "Same preservation flow as completed sprints.",
    taskMutation:
      "Preserve planned/adhoc tasks, update all Trello details, and keep sp_type unless moved to Blocked.",
    storyPointMutation:
      "Refresh completed SP and preserve assigned/adhoc values where gated.",
  },
};

const TRELLO_LISTS = [
  "Current Sprint",
  "In Development",
  "For Dev Deployment",
  "On Dev Environment",
  "For Live Deployment",
  "On Live🎉",
  "On Live",
  "Blocked",
  "Project Refinement",
  "On-Deck Sprint Backlog",
  "Backlog",
  "Next Sprint",
  "Done QA",
  "Done Sprint",
];

const FLOW_STEPS: FlowStep[] = [
  {
    id: "current-sprint",
    title: "Find Current Sprint",
    summary: "Load the current sprint from Supabase.",
    details: [
      "Read the current row from the sprints table.",
      "Stop when no current sprint exists.",
      "Allow only planning, active, completed, and done statuses.",
    ],
    output: "Sprint context for the rest of the sync.",
    accent: Palette.cyan,
  },
  {
    id: "fetch-trello",
    title: "Fetch Trello Cards",
    summary: "Pull cards from the supported Trello lists.",
    details: [
      "Fetch from Trello boards 5oj0clmi and l7BOmeGw.",
      "Fetch cards, members, labels, list names, and custom fields.",
      "Keep the original board fetch and merge the additional l7BOmeGw cards into the same sync flow.",
      "Keep fetched-only lists hidden from the Kanban board.",
    ],
    output: "Raw Trello cards with custom field data.",
    accent: Palette.purple,
  },
  {
    id: "load-lookups",
    title: "Load Supabase Lookups",
    summary: "Load members and project types used for mapping.",
    details: [
      "Build assignee lookup from members.",
      "Build project type lookup from project_type.",
      "Build a set of Supabase member Trello usernames for card eligibility.",
    ],
    output: "Mapping helpers for Trello-to-Supabase conversion.",
    accent: Palette.indigo,
  },
  {
    id: "filter-cards",
    title: "Filter Eligible Cards",
    summary: "Apply status-aware card filtering.",
    details: [
      "For Planning list excludes Ad hoc cards and is synced with sp_type done, not planned.",
      "Non-Ad hoc cards require the required Trello member and another Supabase member.",
      "Ad hoc cards on Current Sprint or In Development with a Supabase assignee are inserted or updated by Trello card id.",
      "Ad hoc cards require custom Status not Done.",
    ],
    output: "Cards eligible for task sync.",
    accent: Palette.gold,
  },
  {
    id: "map-tasks",
    title: "Map Cards To Tasks",
    summary: "Convert Trello cards into task rows.",
    details: [
      "Map Trello IDs, title, description, list name, URL, assignee, priority, severity, project type, and story points.",
      "Set sp_type to planned, adhoc, done, or blocked.",
      "For Planning list cards always use sp_type done.",
      "Blocked cards become sp_type blocked and is_completed pending.",
      "Completion state becomes pending, completed, or incompleted based on list and Incomplete label.",
    ],
    output: "Supabase task payloads.",
    accent: Palette.green,
  },
  {
    id: "mutate-tasks",
    title: "Update Tasks Table",
    summary: "Write mapped tasks to Supabase.",
    details: [
      "Planning deletes and replaces all current sprint tasks.",
      "Active/completed/done preserve planned and adhoc rows.",
      "Preserved rows are updated by task id with latest Trello details including trello_list_name.",
      "Preserved sp_type is not changed, except Blocked cards become blocked.",
      "Non-preserved rows are deleted and new Trello rows are inserted.",
    ],
    output: "Final saved tasks for the sprint.",
    accent: Palette.orange,
  },
  {
    id: "refresh-saved",
    title: "Re-fetch Saved Tasks",
    summary: "Read the final task state after mutations.",
    details: [
      "Fetch tasks back from Supabase after all task changes.",
      "Use saved rows rather than raw Trello payloads for story point calculations.",
    ],
    output: "Authoritative saved task rows.",
    accent: Palette.pink,
  },
  {
    id: "story-points",
    title: "Replace Story Points",
    summary: "Recalculate member story point totals.",
    details: [
      "assigned_story_points sums planned tasks using story_points when sprint is planning or active.",
      "completed_story_points sums completed planned/adhoc tasks using real_story_points.",
      "adhoc_story_points updates from story_points only when sprint is active.",
      "total_bonus_points is completed SP minus assigned SP, floored at zero.",
    ],
    output: "Updated story_points rows through the replace RPC.",
    accent: Palette.redSoft,
  },
];

const TABLE_IMPACTS = [
  {
    table: "tasks",
    writes:
      "Creates, updates, and deletes sprint tasks based on status rules and Trello card data.",
  },
  {
    table: "story_points",
    writes:
      "Replaced after task sync using final saved task rows and sprint status gates.",
  },
  {
    table: "members",
    writes:
      "Read-only during sync. Used to resolve assignees and card eligibility.",
  },
  {
    table: "project_type",
    writes:
      "Read-only during sync. Used to resolve the task project_type value.",
  },
];

export default function AppFlowPage() {
  const [selectedStepId, setSelectedStepId] = useState(FLOW_STEPS[0].id);
  const [selectedStatus, setSelectedStatus] = useState<SprintStatus>("active");
  const selectedStep = useMemo(
    () => FLOW_STEPS.find((step) => step.id === selectedStepId) ?? FLOW_STEPS[0],
    [selectedStepId],
  );
  const selectedStatusRule = STATUS_RULES[selectedStatus];

  return (
    <div className="app-flow-page">
      <Title
        eyebrow="Process Map"
        title="App Flow"
        subtitle="Interactive reference for the current Sync with Trello process."
        size="large"
      />

      <div className="app-flow-layout">
        <Card className="app-flow-card app-flow-card--wide">
          <div className="app-flow-card__header">
            <div>
              <div className="app-flow-kicker">Visual Diagram</div>
              <h3 className="app-flow-heading">Sync With Trello Flow</h3>
            </div>
            <span className="app-flow-pill">Clickable nodes</span>
          </div>

          <div className="app-flow-diagram" aria-label="Sync with Trello process diagram">
            <div className="app-flow-diagram__lane app-flow-diagram__lane--main">
              {FLOW_STEPS.slice(0, 4).map((step, index) => (
                <button
                  className={`app-flow-diagram-node ${
                    selectedStep.id === step.id ? "is-active" : ""
                  }`}
                  key={step.id}
                  onClick={() => setSelectedStepId(step.id)}
                  style={{ "--node-accent": step.accent } as CSSProperties}
                  type="button"
                >
                  <span>{index + 1}</span>
                  {step.title}
                </button>
              ))}
            </div>

            <div className="app-flow-diagram__split">
              <div className="app-flow-diagram-decision">
                Current sprint status?
              </div>
              <div className="app-flow-diagram-branches">
                <button
                  className={`app-flow-diagram-branch ${
                    selectedStatus === "planning" ? "is-active" : ""
                  }`}
                  onClick={() => setSelectedStatus("planning")}
                  type="button"
                >
                  <span>Planning</span>
                  Delete and replace all tasks
                </button>
                <button
                  className={`app-flow-diagram-branch ${
                    selectedStatus !== "planning" ? "is-active" : ""
                  }`}
                  onClick={() => setSelectedStatus("active")}
                  type="button"
                >
                  <span>Active / Completed / Done</span>
                  Preserve planned and adhoc tasks
                </button>
              </div>
            </div>

            <div className="app-flow-diagram__lane app-flow-diagram__lane--main">
              {FLOW_STEPS.slice(4).map((step, index) => (
                <button
                  className={`app-flow-diagram-node ${
                    selectedStep.id === step.id ? "is-active" : ""
                  }`}
                  key={step.id}
                  onClick={() => setSelectedStepId(step.id)}
                  style={{ "--node-accent": step.accent } as CSSProperties}
                  type="button"
                >
                  <span>{index + 5}</span>
                  {step.title}
                </button>
              ))}
            </div>
          </div>
        </Card>

        <Card className="app-flow-card app-flow-card--wide">
          <div className="app-flow-card__header">
            <div>
              <div className="app-flow-kicker">Sync With Trello</div>
              <h3 className="app-flow-heading">Process Sequence</h3>
            </div>
            <div className="app-flow-status-tabs" aria-label="Sprint status view">
              {(Object.keys(STATUS_RULES) as SprintStatus[]).map((status) => (
                <button
                  className={`app-flow-status-tab ${
                    selectedStatus === status ? "is-active" : ""
                  }`}
                  key={status}
                  onClick={() => setSelectedStatus(status)}
                  type="button"
                >
                  {STATUS_RULES[status].label}
                </button>
              ))}
            </div>
          </div>

          <div className="app-flow-chart" aria-label="Sync with Trello flow chart">
            {FLOW_STEPS.map((step, index) => {
              const isActive = step.id === selectedStep.id;

              return (
                <button
                  className={`app-flow-step ${isActive ? "is-active" : ""}`}
                  key={step.id}
                  onClick={() => setSelectedStepId(step.id)}
                  style={{ "--step-accent": step.accent } as CSSProperties}
                  type="button"
                >
                  <span className="app-flow-step__index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="app-flow-step__body">
                    <span className="app-flow-step__title">{step.title}</span>
                    <span className="app-flow-step__summary">{step.summary}</span>
                  </span>
                  {index < FLOW_STEPS.length - 1 && (
                    <span className="app-flow-step__arrow" aria-hidden="true">
                      →
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="app-flow-card">
          <div className="app-flow-kicker">Selected Step</div>
          <h3 className="app-flow-heading" style={{ color: selectedStep.accent }}>
            {selectedStep.title}
          </h3>
          <p className="app-flow-copy">{selectedStep.summary}</p>
          <ul className="app-flow-list">
            {selectedStep.details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
          <div className="app-flow-output">
            <span>Output</span>
            {selectedStep.output}
          </div>
        </Card>

        <Card className="app-flow-card">
          <div className="app-flow-kicker">Status Branch</div>
          <h3 className="app-flow-heading">{selectedStatusRule.label}</h3>
          <div className="app-flow-rule">
            <span>Card Behavior</span>
            {selectedStatusRule.behavior}
          </div>
          <div className="app-flow-rule">
            <span>Tasks Mutation</span>
            {selectedStatusRule.taskMutation}
          </div>
          <div className="app-flow-rule">
            <span>Story Points Mutation</span>
            {selectedStatusRule.storyPointMutation}
          </div>
        </Card>

        <Card className="app-flow-card app-flow-card--wide">
          <div className="app-flow-card__header">
            <div>
              <div className="app-flow-kicker">Trello Inputs</div>
              <h3 className="app-flow-heading">Fetched Lists</h3>
            </div>
            <span className="app-flow-pill">{TRELLO_LISTS.length} lists</span>
          </div>
          <div className="app-flow-pill-grid">
            {TRELLO_LISTS.map((listName) => (
              <span className="app-flow-pill" key={listName}>
                {listName}
              </span>
            ))}
          </div>
        </Card>

        <Card className="app-flow-card">
          <div className="app-flow-kicker">Database Impact</div>
          <h3 className="app-flow-heading">Tables Used</h3>
          <div className="app-flow-table-impact">
            {TABLE_IMPACTS.map((impact) => (
              <div className="app-flow-rule" key={impact.table}>
                <span>{impact.table}</span>
                {impact.writes}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div
        className="app-flow-note"
        style={{ borderColor: Border.default, color: Text.muted }}
      >
        This page is intentionally data-driven. Update the arrays in
        <code>src/pages/AppFlow.page.tsx</code> when the Sync with Trello process
        changes so this flow remains the development baseline.
      </div>
    </div>
  );
}
