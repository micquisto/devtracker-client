import { useEffect, useState } from "react";
import { TEAM_MEMBERS } from "@/data/Mock.data";
import { SPRINT_BOARD_TASKS } from "@/data/SprintBoard.data";
import { Background, Border, Chart } from "@/lib/theme";
import { Card } from "@/components/shared/Containers";
import { SectionTitle } from "@/components/shared/Sections";
import { StackedColumnChart } from "@/components/shared/Charts";
import { getSupabaseRows } from "@/lib/supabase";

type SprintRow = {
  id: string;
};

type DashboardCompletionTaskRow = {
  real_story_points: number | null;
  sp_type: string | null;
  assigned_to: string | null;
  is_completed: string | null;
};

type MemberRow = {
  id: string | null;
  trello_username: string | null;
  role: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
};

type StoryPointRow = {
  member_id: string;
  assigned_story_points: number | null;
  adhoc_story_points: number | null;
  completed_story_points: number | null;
};

type DashboardCompletionMember = {
  id: string;
  name: string;
  color: string;
  plannedStoryPoints: number;
  adhocStoryPoints: number;
  completedStoryPoints: number;
};

const ASSIGNEE_COLORS = [
  "#00c8ff",
  "#00e5a0",
  "#f5c842",
  "#a78bfa",
  "#ff6eb4",
  "#ff9f43",
  "#6b89ff",
  "#ff6b6b",
];

const MOCK_MEMBER_COLOR_BY_NAME = new Map(
  TEAM_MEMBERS.map((member) => [member.name, member.color]),
);

const MOCK_MEMBER_NAME_BY_TRELLO_USERNAME: Record<string, string> = {
  joshuabalansa: "John Doe",
  doerrosales1: "Sarah Kim",
  louiefranzgualingco: "Alex Rivera",
  jpangs: "Mia Chen",
  thomasandrewzaragoza1: "Leo Santos",
};

const EXCLUDED_SCOREBOARD_MEMBER_IDS = new Set([
  "c5726102-b436-4557-ad88-ac148f349558",
]);

const EXCLUDED_SCOREBOARD_MEMBER_ROLES = new Set([
  "tech_lead",
  "project_manager",
]);

function isProjectStoryPointTask(task: DashboardCompletionTaskRow): boolean {
  return task.sp_type === "planned" || task.sp_type === "adhoc";
}

function getMemberName(member: MemberRow): string {
  return (
    member.full_name ||
    [member.first_name, member.last_name].filter(Boolean).join(" ") ||
    "Unnamed member"
  );
}

function getMemberColor(member: MemberRow & { id: string }, fallbackName: string): string {
  const mockMemberName = member.trello_username
    ? MOCK_MEMBER_NAME_BY_TRELLO_USERNAME[member.trello_username]
    : undefined;
  const mockColor = mockMemberName
    ? MOCK_MEMBER_COLOR_BY_NAME.get(mockMemberName)
    : undefined;

  if (mockColor) return mockColor;

  const seed = member.id ?? fallbackName;
  const hash = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);

  return ASSIGNEE_COLORS[hash % ASSIGNEE_COLORS.length];
}

/* ─── STACKED COLUMN CHART ──────────────────── */
const SprintStackedColumnChart = () => {
    const [members, setMembers] = useState<DashboardCompletionMember[]>(
      TEAM_MEMBERS.map((member) => {
        const tasks = SPRINT_BOARD_TASKS.filter(
          (task) => task.assignee === member.initials,
        );
        const total = tasks.reduce((sum, task) => sum + task.points, 0);

        return {
          id: member.id,
          name: member.name,
          color: member.color,
          plannedStoryPoints: total,
          adhocStoryPoints: 0,
          completedStoryPoints: 0,
        };
      }).filter((member) => member.plannedStoryPoints > 0),
    );

    useEffect(() => {
      let cancelled = false;

      async function loadCompletionData(): Promise<void> {
        try {
          const [currentSprint] = await getSupabaseRows<SprintRow>("sprints", {
            select: "id",
            eq: { is_current: 1 },
            limit: 1,
          });

          if (!currentSprint) return;

          const [tasks, memberRows, storyPoints] = await Promise.all([
            getSupabaseRows<DashboardCompletionTaskRow>("tasks", {
              select: "real_story_points,sp_type,assigned_to,is_completed",
              eq: { sprint_id: currentSprint.id },
            }),
            getSupabaseRows<MemberRow>("members", {
              select: "id,trello_username,role,full_name,first_name,last_name",
            }),
            getSupabaseRows<StoryPointRow>("story_points", {
              select:
                "member_id,assigned_story_points,adhoc_story_points,completed_story_points",
              eq: { sprint_id: currentSprint.id },
            }),
          ]);

          const storyPointsByMemberId = new Map(
            storyPoints.map((storyPoint) => [storyPoint.member_id, storyPoint]),
          );
          const incompleteStoryPointsByMemberId = tasks.reduce<Map<string, number>>(
            (sum, task) => {
              if (
                task.assigned_to &&
                isProjectStoryPointTask(task) &&
                task.is_completed === "incompleted"
              ) {
                sum.set(
                  task.assigned_to,
                  (sum.get(task.assigned_to) ?? 0) +
                    (task.real_story_points ?? 0),
                );
              }

              return sum;
            },
            new Map(),
          );
          const nextMembers = memberRows
            .filter(
              (member): member is MemberRow & { id: string } =>
                Boolean(member.id) &&
                !EXCLUDED_SCOREBOARD_MEMBER_IDS.has(member.id as string) &&
                !EXCLUDED_SCOREBOARD_MEMBER_ROLES.has(
                  member.role?.trim().toLowerCase() ?? "",
                ),
            )
            .map((member) => {
              const memberName = getMemberName(member);
              const storyPoint = storyPointsByMemberId.get(member.id);

              return {
                id: member.id,
                name: memberName,
                color: getMemberColor(member, memberName),
                plannedStoryPoints: storyPoint?.assigned_story_points ?? 0,
                adhocStoryPoints: storyPoint?.adhoc_story_points ?? 0,
                completedStoryPoints: Math.max(
                  (storyPoint?.completed_story_points ?? 0) -
                    (incompleteStoryPointsByMemberId.get(member.id) ?? 0),
                  0,
                ),
              };
            })
            .filter(
              (member) =>
                member.plannedStoryPoints > 0 ||
                member.adhocStoryPoints > 0 ||
                member.completedStoryPoints > 0,
            );

          if (!cancelled) setMembers(nextMembers);
        } catch {
          // Keep mock fallback data if the dashboard cannot reach Supabase.
        }
      }

      void loadCompletionData();

      return () => {
        cancelled = true;
      };
    }, []);

    const assigneeSegments = members.map((member) => {
      const total = member.plannedStoryPoints + member.adhocStoryPoints;
      const completed = Math.min(member.completedStoryPoints, total);
      const notDone = Math.max(total - completed, 0);
      const completedPercent =
        member.plannedStoryPoints > 0
          ? Math.min(
              Math.round((completed / member.plannedStoryPoints) * 100),
              100,
            )
          : 0;

      return {
        ...member,
        completed,
        notDone,
        total,
        completedPercent,
      };
    });

    const maxTotal = Math.max(...assigneeSegments.map((member) => member.total), 4);
    const barAreaH = 280;
    const gridStep = Math.max(1, Math.ceil(maxTotal / 4));
    const gridTicks = Array.from({ length: 5 }, (_, index) =>
      Math.min(index * gridStep, maxTotal),
    ).filter((value, index, values) => values.indexOf(value) === index);
  
    const segments = assigneeSegments.map((s) => {
      const notDone = s.total - s.completed;
      return {
        ...s,
        label: s.name,
        labelColor: s.color,
        topLabel: `${s.completedPercent}%`,
        sublabel: `${s.completed}/${s.total} SP`,
        stacks: [
          {
            value: notDone,
            defaultColor: `${s.color}24`,
            highlightColor: `${s.color}38`,
            highlightBoxShadow: `0 0 16px ${s.color}22`,
            borderRadius: "5px 5px 0 0",
          },
          {
            value: s.completed,
            defaultColor: `${s.color}cc`,
            highlightColor: `linear-gradient(180deg,${s.color},${s.color}99)`,
            highlightBoxShadow: `0 0 18px ${s.color}55`,
          },
        ],
      };
    });
  
    return (
      <Card
        style={{
          padding: 11,
          borderRadius: 13,
          border: "1px solid rgba(0,229,160,0.22)",
          background:
            "linear-gradient(135deg, rgba(0,229,160,0.1), rgba(0,200,255,0.06), rgba(6,13,31,0.46))",
          boxShadow: "0 0 24px rgba(0,229,160,0.1)",
          minWidth: 0,
        }}
      >
        <SectionTitle>Assignee Completed vs Not Completed</SectionTitle>
        <div
          style={{
            margin: "8px 6px 0",
            padding: "8px 8px 6px",
            borderRadius: 11,
            background: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(100,180,255,0.08)",
          }}
        >
          <StackedColumnChart
            segments={segments}
            max={maxTotal}
            barAreaHeight={barAreaH}
            gap={10}
            gridTicks={gridTicks}
            legend={[
              { color: Chart.completed, label: "Completed portion uses assignee color" },
              { color: Chart.remaining, label: "Remaining uses muted assignee color" },
            ]}
            renderTooltip={(s) => (
                <div
                  style={{
                    position: "absolute",
                    bottom: 290,
                    background: Background.tooltip,
                    border: `1px solid ${Border.tooltip}`,
                    borderRadius: 8,
                    padding: "8px 12px",
                    zIndex: 10,
                    whiteSpace: "nowrap" as const,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: s.color,
                      fontFamily: "'DM Sans',sans-serif",
                      marginBottom: 4,
                      fontWeight: 800,
                    }}
                  >
                    {s.name}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: s.color,
                      fontFamily: "'DM Mono',monospace",
                      fontWeight: 700,
                    }}
                  >
                    Completed: {s.completed} SP
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#00e5a0",
                      fontFamily: "'DM Mono',monospace",
                      fontWeight: 800,
                    }}
                  >
                    Completion: {s.completedPercent}%
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: `${s.color}99`,
                      fontFamily: "'DM Mono',monospace",
                      fontWeight: 700,
                    }}
                  >
                    Not Completed: {s.notDone} SP
                  </div>
                </div>
              )}
          />
        </div>
      </Card>
    );
  };

export default SprintStackedColumnChart;

