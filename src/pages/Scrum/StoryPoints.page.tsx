import { Card } from "@/components/shared/Containers";
import { SectionTitle } from "@/components/shared/Sections";
import { SPRINT_DATES } from "@/data/Sprints.data";
import { formatAverage } from "@/lib/helper";
import { Background, Border, Palette, Text } from "@/lib/theme";
import {
  assigneeRows,
  spBreakdownRows,
  sprintTotals,
  totalAverage,
} from "@/lib/utils";
import "@/assets/styles/StoryPoints.page.css";

export default function StoryPointsPage() {
  return (
    <div className="story-points-page" style={{ padding: "20px 0 40px" }}>
      <Card className="story-points-card">
        <div
          className="story-points-header"
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 14,
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          <div>
            <SectionTitle>Story Points</SectionTitle>
            <div
              style={{
                color: Text.faint,
                fontFamily: "'DM Mono',monospace",
                fontSize: 10,
                fontWeight: 800,
                marginTop: -8,
              }}
            >
              Assignee averages and sprint totals
            </div>
          </div>
          <div
            style={{
              padding: "7px 11px",
              borderRadius: 10,
              border: `1px solid ${Palette.cyan}33`,
              background: `${Palette.cyan}10`,
              color: Palette.cyan,
              fontFamily: "'DM Mono',monospace",
              fontSize: 11,
              fontWeight: 900,
            }}
          >
            {SPRINT_DATES.length} sprints
          </div>
        </div>

        <div className="story-points-scroll">
          <table className="story-points-table">
            <thead>
              <tr>
                <th
                  className="story-points-sticky story-points-assignee"
                  style={{
                    width: 190,
                    padding: "8px 12px",
                    textAlign: "left",
                    borderRadius: "10px 0 0 10px",
                    background: "rgba(9,18,38,0.98)",
                    color: Text.section,
                    fontFamily: "'DM Mono',monospace",
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  Assignee
                </th>
                <th
                  className="story-points-sticky story-points-average"
                  style={{
                    width: 92,
                    padding: "8px 12px",
                    textAlign: "right",
                    background: "rgba(9,18,38,0.98)",
                    color: Palette.gold,
                    fontFamily: "'DM Mono',monospace",
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  Average
                </th>
                {SPRINT_DATES.map((date, index) => (
                  <th
                    key={date}
                    style={{
                      width: 62,
                      padding: "8px 10px",
                      textAlign: "right",
                      borderRadius: index === SPRINT_DATES.length - 1 ? "0 10px 10px 0" : 0,
                      background: Background.selectActive,
                      color: Text.label,
                      fontFamily: "'DM Mono',monospace",
                      fontSize: 10,
                      fontWeight: 900,
                    }}
                  >
                    {date}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assigneeRows.map((assignee, rowIndex) => (
                <tr
                  className="story-points-animated-row"
                  key={assignee.initials}
                  style={{ animationDelay: `${0.06 + rowIndex * 0.045}s` }}
                >
                  <td
                    className="story-points-sticky story-points-assignee"
                    style={{
                      padding: "10px 12px",
                      borderRadius: "10px 0 0 10px",
                      background: "rgba(9,18,38,0.98)",
                      border: `1px solid ${assignee.color}24`,
                      borderRight: "none",
                    }}
                  >
                    <div
                      style={{
                        color: Text.primary,
                        fontFamily: "'DM Sans',sans-serif",
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                    >
                      {assignee.name}
                    </div>
                    <div
                      style={{
                        color: assignee.color,
                        fontFamily: "'DM Mono',monospace",
                        fontSize: 9,
                        fontWeight: 900,
                      }}
                    >
                      {assignee.initials}
                    </div>
                  </td>
                  <td
                    className="story-points-sticky story-points-average"
                    style={{
                      padding: "10px 12px",
                      textAlign: "right",
                      background: "rgba(9,18,38,0.98)",
                      borderTop: `1px solid ${Palette.gold}24`,
                      borderBottom: `1px solid ${Palette.gold}24`,
                      color: Palette.gold,
                      fontFamily: "'DM Mono',monospace",
                      fontSize: 13,
                      fontWeight: 900,
                    }}
                  >
                    {formatAverage(assignee.average)}
                  </td>
                  {assignee.values.map((value, index) => (
                    <td
                      key={`${assignee.initials}-${SPRINT_DATES[index]}`}
                      style={{
                        padding: "10px",
                        textAlign: "right",
                        borderRadius: index === SPRINT_DATES.length - 1 ? "0 10px 10px 0" : 0,
                        background: index === 0 ? `${assignee.color}14` : Background.row,
                        borderTop: `1px solid ${Border.faint}`,
                        borderBottom: `1px solid ${Border.faint}`,
                        color: index === 0 ? assignee.color : Text.body,
                        fontFamily: "'DM Mono',monospace",
                        fontSize: 12,
                        fontWeight: index === 0 ? 900 : 700,
                      }}
                    >
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
              <tr
                className="story-points-animated-row"
                style={{ animationDelay: `${0.06 + assigneeRows.length * 0.045}s` }}
              >
                <td
                  className="story-points-sticky story-points-assignee"
                  style={{
                    padding: "11px 12px",
                    borderRadius: "10px 0 0 10px",
                    background: "#08243b",
                    color: Text.primary,
                    fontFamily: "'DM Sans',sans-serif",
                    fontSize: 12,
                    fontWeight: 900,
                    textTransform: "uppercase",
                  }}
                >
                  Total
                </td>
                <td
                  className="story-points-sticky story-points-average"
                  style={{
                    padding: "11px 12px",
                    textAlign: "right",
                    background: "#342c17",
                    color: Palette.gold,
                    fontFamily: "'DM Mono',monospace",
                    fontSize: 14,
                    fontWeight: 900,
                  }}
                >
                  {formatAverage(totalAverage)}
                </td>
                {sprintTotals.map((value, index) => (
                  <td
                    key={`total-${SPRINT_DATES[index]}`}
                    style={{
                      padding: "11px 10px",
                      textAlign: "right",
                      borderRadius: index === SPRINT_DATES.length - 1 ? "0 10px 10px 0" : 0,
                      background: index === 0 ? "rgba(0,229,160,0.16)" : "rgba(0,200,255,0.08)",
                      color: index === 0 ? Palette.green : Palette.cyan,
                      fontFamily: "'DM Mono',monospace",
                      fontSize: 13,
                      fontWeight: 900,
                    }}
                  >
                    {value}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
      <Card className="story-points-card" style={{ marginTop: 18 }}>
        <div
          className="story-points-header"
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 14,
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          <div>
            <SectionTitle>SP Breakdown</SectionTitle>
            <div
              style={{
                color: Text.faint,
                fontFamily: "'DM Mono',monospace",
                fontSize: 10,
                fontWeight: 800,
                marginTop: -8,
              }}
            >
              Category totals reconcile with the assignee table above
            </div>
          </div>
          <div
            style={{
              padding: "7px 11px",
              borderRadius: 10,
              border: `1px solid ${Palette.green}33`,
              background: `${Palette.green}10`,
              color: Palette.green,
              fontFamily: "'DM Mono',monospace",
              fontSize: 11,
              fontWeight: 900,
            }}
          >
            SP Total = {sprintTotals[0]}
          </div>
        </div>

        <div className="story-points-scroll">
          <table className="story-points-table">
            <thead>
              <tr>
                <th
                  className="story-points-sticky story-points-assignee"
                  style={{
                    width: 190,
                    padding: "8px 12px",
                    textAlign: "left",
                    borderRadius: "10px 0 0 10px",
                    background: "rgba(9,18,38,0.98)",
                    color: Text.section,
                    fontFamily: "'DM Mono',monospace",
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  SP Breakdown
                </th>
                <th
                  className="story-points-sticky story-points-average"
                  style={{
                    width: 92,
                    padding: "8px 12px",
                    textAlign: "right",
                    background: "rgba(9,18,38,0.98)",
                    color: Palette.gold,
                    fontFamily: "'DM Mono',monospace",
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  Average
                </th>
                {SPRINT_DATES.map((date, index) => (
                  <th
                    key={`breakdown-header-${date}`}
                    style={{
                      width: 62,
                      padding: "8px 10px",
                      textAlign: "right",
                      borderRadius: index === SPRINT_DATES.length - 1 ? "0 10px 10px 0" : 0,
                      background: Background.selectActive,
                      color: Text.label,
                      fontFamily: "'DM Mono',monospace",
                      fontSize: 10,
                      fontWeight: 900,
                    }}
                  >
                    {date}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {spBreakdownRows.map((row, rowIndex) => {
                const rowColor = row.isTotal
                  ? Palette.green
                  : row.highlighted
                    ? Palette.gold
                    : Text.body;
                const rowBackground = row.isTotal
                  ? "#12351f"
                  : row.highlighted
                    ? "#342c17"
                    : "rgba(9,18,38,0.98)";

                return (
                  <tr
                    className="story-points-animated-row"
                    key={row.label}
                    style={{ animationDelay: `${0.12 + rowIndex * 0.045}s` }}
                  >
                    <td
                      className="story-points-sticky story-points-assignee"
                      style={{
                        padding: "10px 12px",
                        borderRadius: "10px 0 0 10px",
                        background: rowBackground,
                        color: rowColor,
                        border: `1px solid ${row.highlighted ? rowColor + "55" : Border.faint}`,
                        borderRight: "none",
                        fontFamily: "'DM Sans',sans-serif",
                        fontSize: 12,
                        fontWeight: row.highlighted ? 900 : 800,
                        lineHeight: 1.2,
                      }}
                    >
                      {row.label}
                    </td>
                    <td
                      className="story-points-sticky story-points-average"
                      style={{
                        padding: "10px 12px",
                        textAlign: "right",
                        background: row.highlighted ? rowBackground : "rgba(9,18,38,0.98)",
                        borderTop: `1px solid ${row.highlighted ? rowColor + "44" : Palette.gold + "24"}`,
                        borderBottom: `1px solid ${row.highlighted ? rowColor + "44" : Palette.gold + "24"}`,
                        color: row.highlighted ? rowColor : Palette.gold,
                        fontFamily: "'DM Mono',monospace",
                        fontSize: row.highlighted ? 14 : 13,
                        fontWeight: 900,
                      }}
                    >
                      {formatAverage(row.average)}
                    </td>
                    {row.values.map((value, index) => (
                      <td
                        key={`${row.label}-${SPRINT_DATES[index]}`}
                        style={{
                          padding: "10px",
                          textAlign: "right",
                          borderRadius: index === SPRINT_DATES.length - 1 ? "0 10px 10px 0" : 0,
                          background: row.isTotal
                            ? "rgba(0,229,160,0.16)"
                            : row.highlighted
                              ? "rgba(245,200,66,0.12)"
                              : Background.row,
                          borderTop: `1px solid ${row.highlighted ? rowColor + "33" : Border.faint}`,
                          borderBottom: `1px solid ${row.highlighted ? rowColor + "33" : Border.faint}`,
                          color: row.highlighted ? rowColor : Text.body,
                          fontFamily: "'DM Mono',monospace",
                          fontSize: row.highlighted ? 13 : 12,
                          fontWeight: row.highlighted ? 900 : 700,
                        }}
                      >
                        {value}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
