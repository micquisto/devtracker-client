import { TEAM_MEMBERS } from "@/data/Mock.data";

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

const UNASSIGNED_COLOR = "#8a96a8";

export type MemberColorRow = {
  id: string | null;
  trello_username?: string | null;
};

export function getMemberInitials(name: string): string {
  if (name === "Unassigned") return "UA";

  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

export function getMemberColor(
  member: MemberColorRow | undefined,
  fallbackName: string,
): string {
  if (!member || fallbackName === "Unassigned") return UNASSIGNED_COLOR;

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
