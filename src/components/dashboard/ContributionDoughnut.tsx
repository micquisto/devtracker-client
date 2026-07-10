import { useEffect, useState } from "react";
import { TEAM_MEMBERS } from "@/data/Mock.data";
import { SPRINT_BOARD_TASKS } from "@/data/SprintBoard.data";
import { Background, Border, Text, chartLegendStyle, chartLabelSvgProps } from "@/lib/theme";
import { Card } from "@/components/shared/Containers";
import { SectionTitle } from "@/components/shared/Sections";
import { DoughnutChart } from "@/components/shared/Charts";
import { getSupabaseRows } from "@/lib/supabase";
import {
  buildScoreboardIncludedMemberIdSet,
  filterTasksForScoreboardMembers,
  isScoreboardIncludedMember,
} from "@/lib/utils";

type SprintRow = {
  id: string;
};

type ContributionTaskRow = {
  assigned_to: string | null;
  story_points: number | null;
  sp_type: string | null;
};

type MemberRow = {
  id: string | null;
  trello_username: string | null;
  role: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
};

type ContributionRow = {
  id: string;
  name: string;
  initials: string;
  color: string;
  storyPoints: number;
  contribution: number;
  value: number;
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

function isContributionTask(task: ContributionTaskRow): boolean {
  return task.sp_type === "planned" || task.sp_type === "adhoc";
}

function getMemberName(member: MemberRow): string {
  return (
    member.full_name ||
    [member.first_name, member.last_name].filter(Boolean).join(" ") ||
    "Unnamed member"
  );
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
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

function getFallbackContributionRows(): ContributionRow[] {
  const storyPointsByMember = TEAM_MEMBERS.map((member) => ({
    ...member,
    storyPoints: SPRINT_BOARD_TASKS.filter(
      (task) => task.assignee === member.initials,
    ).reduce((sum, task) => sum + task.points, 0),
  }));
  const totalStoryPoints = storyPointsByMember.reduce(
    (sum, member) => sum + member.storyPoints,
    0,
  );

  return storyPointsByMember.map((member) => ({
    id: member.initials,
    name: member.name,
    initials: member.initials,
    color: member.color,
    storyPoints: member.storyPoints,
    contribution:
      totalStoryPoints > 0
        ? Math.round((member.storyPoints / totalStoryPoints) * 100)
        : 0,
    value: member.storyPoints,
  }));
}

/* ─── CONTRIBUTION DOUGHNUT ─────────────────── */
const ContributionDoughnut = () => {
    const [contributionRows, setContributionRows] = useState<ContributionRow[]>(
      getFallbackContributionRows,
    );
    const totalStoryPoints = contributionRows.reduce(
      (sum, member) => sum + member.storyPoints,
      0,
    );
    const segments = contributionRows.filter(
      (member) => member.storyPoints > 0,
    );

    useEffect(() => {
      let cancelled = false;

      async function loadContributionRows(): Promise<void> {
        try {
          const [currentSprint] = await getSupabaseRows<SprintRow>("sprints", {
            select: "id",
            eq: { is_current: 1 },
            limit: 1,
          });

          if (!currentSprint) return;

          const [tasks, members] = await Promise.all([
            getSupabaseRows<ContributionTaskRow>("tasks", {
              select: "assigned_to,story_points,sp_type",
              eq: { sprint_id: currentSprint.id },
            }),
            getSupabaseRows<MemberRow>("members", {
              select: "id,trello_username,role,full_name,first_name,last_name",
            }),
          ]);
          const includedMemberIds = buildScoreboardIncludedMemberIdSet(members);
          const scoreboardTasks = filterTasksForScoreboardMembers(
            tasks,
            includedMemberIds,
          );
          const storyPointsByMemberId = scoreboardTasks.reduce<Map<string, number>>(
            (sum, task) => {
              if (task.assigned_to && isContributionTask(task)) {
                sum.set(
                  task.assigned_to,
                  (sum.get(task.assigned_to) ?? 0) + (task.story_points ?? 0),
                );
              }

              return sum;
            },
            new Map(),
          );
          const filteredMembers = members.filter(
            (member): member is MemberRow & { id: string } =>
              isScoreboardIncludedMember(member),
          );
          const nextTotal = filteredMembers.reduce(
            (sum, member) => sum + (storyPointsByMemberId.get(member.id) ?? 0),
            0,
          );
          const nextRows = filteredMembers.map((member) => {
            const memberName = getMemberName(member);
            const storyPoints = storyPointsByMemberId.get(member.id) ?? 0;

            return {
              id: member.id,
              name: memberName,
              initials: getInitials(memberName),
              color: getMemberColor(member, memberName),
              storyPoints,
              contribution:
                nextTotal > 0 ? Math.round((storyPoints / nextTotal) * 100) : 0,
              value: storyPoints,
            };
          });

          if (!cancelled) setContributionRows(nextRows);
        } catch {
          // Keep mock fallback data if the dashboard cannot reach Supabase.
        }
      }

      void loadContributionRows();

      return () => {
        cancelled = true;
      };
    }, []);
  
    return (
      <Card>
        <SectionTitle>Team Contribution</SectionTitle>
        <DoughnutChart
          segments={segments}
          gradientIdPrefix="cg"
          renderCenter={({ hovered, cx, cy }) =>
            hovered ? (
              <>
                <text
                  x={cx}
                  y={cy - 14}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="18"
                  fill={hovered.color}
                  fontFamily="'DM Mono',monospace"
                  fontWeight="800"
                >
                  {hovered.contribution}%
                </text>
                <text
                  x={cx}
                  y={cy + 5}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={Text.label}
                  {...chartLabelSvgProps}
                >
                  {hovered.initials}
                </text>
                <text
                  x={cx}
                  y={cy + 20}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={hovered.color}
                  {...chartLabelSvgProps}
                >
                  {hovered.storyPoints} SP
                </text>
              </>
            ) : (
              <>
                <text
                  x={cx}
                  y={cy - 8}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="14"
                  fill={Text.primary}
                  fontFamily="'DM Mono',monospace"
                  fontWeight="800"
                >
                  {totalStoryPoints}
                </text>
                <text
                  x={cx}
                  y={cy + 10}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={Text.faint}
                  {...chartLabelSvgProps}
                >
                  Total SP
                </text>
              </>
            )
          }
          renderLegend={({ segments: segs, hov, setHov }) => (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                minWidth: 130,
              }}
            >
              {contributionRows.map((member) => {
                const segment = segs.find((s) => s.initials === member.initials);
                const isActive = segment ? hov === segment.i : false;

                return (
                  <div
                    key={member.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 10px",
                      borderRadius: 8,
                      background: isActive ? `${member.color}12` : Background.row,
                      border: `1px solid ${isActive ? member.color + "44" : Border.faint}`,
                      cursor: segment ? "pointer" : "default",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={() => setHov(segment?.i ?? null)}
                    onMouseLeave={() => setHov(null)}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 2,
                        background: member.color,
                        flexShrink: 0,
                        opacity: member.storyPoints > 0 ? 1 : 0.45,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          ...chartLegendStyle,
                          color: Text.body,
                        }}
                      >
                        {member.name}
                      </div>
                      <div
                        style={{
                          height: 3,
                          background: Background.track,
                          borderRadius: 99,
                          overflow: "hidden",
                          marginTop: 3,
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${member.contribution}%`,
                            background: member.color,
                            borderRadius: 99,
                            transition: "width 1s ease",
                          }}
                        />
                      </div>
                    </div>
                    <span
                      style={{
                        ...chartLegendStyle,
                        color: member.color,
                      }}
                    >
                      {member.storyPoints} SP · {member.contribution}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        />
      </Card>
    );
  }

  export default ContributionDoughnut;