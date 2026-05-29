import { useState, useEffect } from "react";

/* ─── TYPES ─────────────────────────────────── */
interface TeamMember { name: string; initials: string; color: string; contribution: number; }
interface SprintTask  { id: string; title: string; assignee: string; severity: "Critical"|"High"|"Medium"|"Low"; priority: "P0"|"P1"|"P2"|"P3"; status: "Done"|"In Progress"|"Review"|"Blocked"|"Todo"; points: number; }
interface MonthData   { label: string; score: number; prev?: number; }

/* ─── MOCK DATA ─────────────────────────────── */
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const CURRENT_MONTH = 4; // May (0-indexed)

const MONTH_PERF: Record<string, number[]> = {
  Jan: [62,65,60,70,58,63,67,71,66,68,72,75,70,73,69,72,75,78,74,76,80,77,79,82,78,80,83,80,82,85,82],
  Feb: [70,72,68,74,71,75,73,77,74,78,76,80,78,82,80,84,82,85,83,86,84,87,85,88,86,89,87,90,88],
  Mar: [75,78,76,80,78,82,80,84,82,86,84,87,85,88,83,86,84,87,82,85,83,80,78,76,74,72,70,68,66,64,62],
  Apr: [60,63,65,68,70,72,74,76,78,80,79,81,83,85,84,86,88,87,89,91,90,92,91,93,92,94,93,95,94,96],
  May: [88,90,87,91,89,93,91,88,92,90,94,92,89,93,91,95,93,97,95,92,96,94,91,95,93,97,95,92,96,94,97],
};

const TEAM_MEMBERS: TeamMember[] = [
  { name:"John Doe",    initials:"JD", color:"#00c8ff", contribution:27 },
  { name:"Sarah Kim",   initials:"SK", color:"#00e5a0", contribution:23 },
  { name:"Alex Rivera", initials:"AR", color:"#f5c842", contribution:20 },
  { name:"Mia Chen",    initials:"MC", color:"#ff6eb4", contribution:18 },
  { name:"Leo Santos",  initials:"LS", color:"#a78bfa", contribution:12 },
];

const SPRINT_TASKS: SprintTask[] = [
  { id:"T-101", title:"Auth service token refresh",        assignee:"JD", severity:"Critical", priority:"P0", status:"Done",        points:8 },
  { id:"T-102", title:"Dashboard line chart filter",       assignee:"SK", severity:"High",     priority:"P1", status:"In Progress", points:5 },
  { id:"T-103", title:"Fix payment gateway timeout",       assignee:"AR", severity:"Critical", priority:"P0", status:"Blocked",     points:13 },
  { id:"T-104", title:"Add unit tests for user module",    assignee:"MC", severity:"Medium",   priority:"P2", status:"Review",      points:3 },
  { id:"T-105", title:"Migrate legacy DB schema",          assignee:"JD", severity:"High",     priority:"P1", status:"In Progress", points:8 },
  { id:"T-106", title:"API rate limiter implementation",   assignee:"LS", severity:"High",     priority:"P1", status:"Done",        points:5 },
  { id:"T-107", title:"Mobile nav burger menu",            assignee:"SK", severity:"Medium",   priority:"P2", status:"Done",        points:3 },
  { id:"T-108", title:"CI/CD pipeline optimisation",       assignee:"AR", severity:"Low",      priority:"P3", status:"Todo",        points:2 },
  { id:"T-109", title:"SSO integration with Google",       assignee:"MC", severity:"High",     priority:"P1", status:"In Progress", points:8 },
  { id:"T-110", title:"Update design system tokens",       assignee:"LS", severity:"Low",      priority:"P3", status:"Todo",        points:1 },
  { id:"T-111", title:"Performance profiling report",      assignee:"JD", severity:"Medium",   priority:"P2", status:"Review",      points:3 },
  { id:"T-112", title:"E2E tests for checkout flow",       assignee:"SK", severity:"High",     priority:"P1", status:"Todo",        points:5 },
];

const SPRINT_HISTORY = [
  { sprint:"Sprint 18", velocity:38, completed:9,  total:13 },
  { sprint:"Sprint 19", velocity:42, completed:11, total:14 },
  { sprint:"Sprint 20", velocity:35, completed:8,  total:12 },
  { sprint:"Sprint 21", velocity:47, completed:12, total:14 },
  { sprint:"Sprint 22 (Current)", velocity:44, completed:7, total:12 },
];

/* ─── COLOURS / HELPERS ─────────────────────── */
const SEV_COLOR: Record<string,string> = { Critical:"#ff4757", High:"#ff9f43", Medium:"#f5c842", Low:"#00e5a0" };
const PRI_COLOR: Record<string,string> = { P0:"#ff4757", P1:"#ff9f43", P2:"#00c8ff", P3:"#a78bfa" };
const STATUS_COLOR: Record<string,string> = { Done:"#00e5a0", "In Progress":"#00c8ff", Review:"#f5c842", Blocked:"#ff4757", Todo:"rgba(120,160,210,0.5)" };
const STATUS_BG: Record<string,string>    = { Done:"rgba(0,229,160,0.1)", "In Progress":"rgba(0,200,255,0.1)", Review:"rgba(245,200,66,0.1)", Blocked:"rgba(255,71,87,0.1)", Todo:"rgba(120,160,210,0.06)" };

function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background:"rgba(255,255,255,0.035)", border:"1px solid rgba(100,180,255,0.1)",
      borderRadius:16, padding:22, transition:"border-color 0.3s",
      ...style,
    }}
      onMouseEnter={e=>(e.currentTarget.style.borderColor="rgba(0,200,255,0.2)")}
      onMouseLeave={e=>(e.currentTarget.style.borderColor="rgba(100,180,255,0.1)")}
    >{children}</div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize:10, fontFamily:"'DM Mono',monospace", fontWeight:700,
      color:"rgba(100,180,255,0.55)", textTransform:"uppercase" as const,
      letterSpacing:"0.15em", marginBottom:16,
    }}>{children}</div>
  );
}

/* ─── SCORE CARD ────────────────────────────── */
function ScoreKPI({ label, value, sub, color, delta, deltaLabel }:
  { label:string; value:string|number; sub?:string; color:string; delta?:number; deltaLabel?:string }) {
  const [show,setShow]=useState(false);
  useEffect(()=>{ const t=setTimeout(()=>setShow(true),200); return()=>clearTimeout(t); },[]);
  const up = (delta??0) >= 0;
  return (
    <Card style={{ flex:1, minWidth:140, display:"flex", flexDirection:"column", gap:8 }}>
      <div style={{ fontSize:11, color:"rgba(140,185,230,0.6)", fontFamily:"'DM Sans',sans-serif", fontWeight:600 }}>{label}</div>
      <div style={{
        fontSize:28, fontWeight:800, fontFamily:"'DM Mono',monospace", color,
        transition:"all 0.6s ease", transform:show?"scale(1)":"scale(0.8)", opacity:show?1:0,
        letterSpacing:"-0.03em", lineHeight:1,
      }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:"rgba(120,170,215,0.5)", fontFamily:"'DM Sans',sans-serif" }}>{sub}</div>}
      {delta !== undefined && (
        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
          <span style={{ fontSize:11, fontWeight:700, fontFamily:"'DM Mono',monospace",
            color: up?"#00e5a0":"#ff6b6b" }}>
            {up?"\u25b2":"\u25bc"} {Math.abs(delta)}%
          </span>
          <span style={{ fontSize:10, color:"rgba(100,150,200,0.5)", fontFamily:"'DM Sans',sans-serif" }}>
            {deltaLabel||"vs last month"}
          </span>
        </div>
      )}
    </Card>
  );
}

/* ─── TEAM PERFORMANCE LINE CHART ───────────── */
function TeamLineChart() {
  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH);
  const [animated, setAnimated] = useState(false);

  useEffect(() => { setAnimated(false); const t = setTimeout(()=>setAnimated(true),100); return()=>clearTimeout(t); }, [selectedMonth]);

  const key = MONTHS[selectedMonth];
  const data = MONTH_PERF[key] || [];
  const W=560, H=180, pL=36, pR=16, pT=16, pB=32;
  const cW=W-pL-pR, cH=H-pT-pB;
  const n=data.length, step=cW/(n-1);
  const min=50, max=100;

  const pts = data.map((v,i)=>({ x:pL+i*step, y:pT+cH-((v-min)/(max-min))*cH, v }));
  const smooth = pts.reduce((a,p,i)=>{ if(i===0)return`M${p.x},${p.y}`; const pv=pts[i-1],cpx=(pv.x+p.x)/2; return`${a} C${cpx},${pv.y} ${cpx},${p.y} ${p.x},${p.y}`; },"");
  const area = `${smooth} L${pts[pts.length-1].x},${pT+cH} L${pts[0].x},${pT+cH} Z`;
  const [hov, setHov] = useState<number|null>(null);

  // Prev month for delta
  const prevKey = selectedMonth > 0 ? MONTHS[selectedMonth-1] : null;
  const prevData = prevKey ? MONTH_PERF[prevKey] : null;
  const curAvg = Math.round(data.reduce((a,v)=>a+v,0)/(data.length||1));
  const prevAvg = prevData ? Math.round(prevData.reduce((a,v)=>a+v,0)/(prevData.length||1)) : null;
  const delta = prevAvg !== null ? curAvg - prevAvg : null;

  return (
    <Card>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10, marginBottom:12 }}>
        <div>
          <SectionTitle>Team Performance — {MONTHS[selectedMonth]}</SectionTitle>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginTop:-8 }}>
            <span style={{ fontSize:22, fontWeight:800, fontFamily:"'DM Mono',monospace", color:"#00c8ff" }}>{curAvg}<span style={{fontSize:12,color:"rgba(0,200,255,0.5)"}}>/100</span></span>
            {delta !== null && (
              <span style={{ fontSize:12, fontWeight:700, fontFamily:"'DM Mono',monospace", color:delta>=0?"#00e5a0":"#ff6b6b" }}>
                {delta>=0?"\u25b2":"\u25bc"} {Math.abs(delta)} pts vs {prevKey}
              </span>
            )}
          </div>
        </div>
        {/* Month filter */}
        <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
          {MONTHS.slice(0, CURRENT_MONTH+1).map((m,i)=>(
            <button key={m} onClick={()=>setSelectedMonth(i)} style={{
              padding:"4px 10px", borderRadius:99, border:"1px solid",
              borderColor: selectedMonth===i?"#00c8ff":"rgba(100,180,255,0.15)",
              background: selectedMonth===i?"rgba(0,200,255,0.12)":"transparent",
              color: selectedMonth===i?"#00c8ff":"rgba(120,170,215,0.6)",
              fontSize:10, fontFamily:"'DM Mono',monospace", fontWeight:700,
              cursor:"pointer", transition:"all 0.2s",
            }}>{m}</button>
          ))}
        </div>
      </div>

      <div style={{ width:"100%", overflowX:"auto" }} onMouseLeave={()=>setHov(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", minWidth:280, display:"block" }}>
          <defs>
            <linearGradient id="tlg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00c8ff" stopOpacity=".2"/>
              <stop offset="100%" stopColor="#00c8ff" stopOpacity=".01"/>
            </linearGradient>
            <filter id="tglow"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          </defs>
          {[0,25,50,75,100].map(v=>{
            const y=pT+cH-((Math.min(v+min,100)-min)/(max-min))*cH;
            if(v+min>100)return null;
            return(<g key={v}>
              <line x1={pL} y1={y} x2={W-pR} y2={y} stroke="rgba(100,180,255,0.07)" strokeWidth="1" strokeDasharray="4 3"/>
              <text x={pL-4} y={y+4} textAnchor="end" fontSize="8" fill="rgba(100,160,210,0.4)" fontFamily="'DM Mono',monospace">{v+min}</text>
            </g>);
          })}
          <path d={area} fill="url(#tlg)" style={{opacity:animated?1:0,transition:"opacity 0.8s ease"}}/>
          <path d={smooth} fill="none" stroke="#00c8ff" strokeWidth="2" strokeLinecap="round" filter="url(#tglow)"
            style={{opacity:animated?1:0,transition:"opacity 0.6s ease 0.1s"}}/>
          {pts.map((p,i)=>(
            <g key={i} style={{cursor:"pointer"}} onMouseEnter={()=>setHov(i)}>
              <circle cx={p.x} cy={p.y} r={hov===i?10:0} fill="rgba(0,200,255,0.1)" style={{transition:"r 0.2s"}}/>
              <circle cx={p.x} cy={p.y} r={hov===i?5:0} fill="#00c8ff" stroke="#0a1628" strokeWidth="1.5"
                style={{opacity:animated?1:0,transition:"r 0.2s, opacity 0.5s"}}/>
              {hov===i&&<g>
                <rect x={p.x-28} y={p.y-30} width={56} height={20} rx="4" fill="rgba(10,22,44,0.95)" stroke="rgba(0,200,255,0.4)" strokeWidth="1"/>
                <text x={p.x} y={p.y-17} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill="#00c8ff" fontFamily="'DM Mono',monospace" fontWeight="700">Day {i+1}: {p.v}</text>
              </g>}
            </g>
          ))}
          {/* X axis */}
          <line x1={pL} y1={pT+cH} x2={W-pR} y2={pT+cH} stroke="rgba(100,180,255,0.12)" strokeWidth="1"/>
          {[0,6,13,20,27].map(i=>i<pts.length&&(
            <text key={i} x={pts[i].x} y={pT+cH+14} textAnchor="middle" fontSize="8" fill="rgba(100,160,210,0.45)" fontFamily="'DM Mono',monospace">Day {i+1}</text>
          ))}
        </svg>
      </div>
    </Card>
  );
}

/* ─── SPRINT COMPARISON ─────────────────────── */
function SprintComparison() {
  const cur  = SPRINT_HISTORY[SPRINT_HISTORY.length-1];
  const prev = SPRINT_HISTORY[SPRINT_HISTORY.length-2];
  const deltaVel = cur.velocity - prev.velocity;
  const deltaPct = Math.round(((cur.completed/cur.total)-(prev.completed/prev.total))*100);

  return (
    <Card>
      <SectionTitle>Sprint vs Sprint Comparison</SectionTitle>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        {[prev, cur].map((s,i)=>(
          <div key={s.sprint} style={{
            padding:"14px", borderRadius:12,
            background: i===1?"rgba(0,200,255,0.07)":"rgba(255,255,255,0.025)",
            border:`1px solid ${i===1?"rgba(0,200,255,0.2)":"rgba(100,180,255,0.08)"}`,
          }}>
            <div style={{ fontSize:9, fontFamily:"'DM Mono',monospace", color:i===1?"#00c8ff":"rgba(100,160,210,0.5)", fontWeight:700, letterSpacing:"0.1em", marginBottom:8 }}>
              {i===1?"● CURRENT":"○ PREVIOUS"}
            </div>
            <div style={{ fontSize:11, color:"rgba(160,210,255,0.7)", fontFamily:"'DM Sans',sans-serif", marginBottom:10 }}>{s.sprint}</div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:11, color:"rgba(120,170,215,0.6)", fontFamily:"'DM Sans',sans-serif" }}>Velocity</span>
                <span style={{ fontSize:13, fontWeight:800, fontFamily:"'DM Mono',monospace", color: i===1?"#00e5a0":"rgba(160,210,255,0.7)" }}>{s.velocity} SP</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:11, color:"rgba(120,170,215,0.6)", fontFamily:"'DM Sans',sans-serif" }}>Completion</span>
                <span style={{ fontSize:13, fontWeight:800, fontFamily:"'DM Mono',monospace", color: i===1?"#00c8ff":"rgba(160,210,255,0.7)" }}>{s.completed}/{s.total}</span>
              </div>
              <div style={{ height:4, background:"rgba(255,255,255,0.06)", borderRadius:99, overflow:"hidden", marginTop:2 }}>
                <div style={{ height:"100%", width:`${(s.completed/s.total)*100}%`, background:i===1?"#00c8ff":"rgba(100,160,210,0.4)", borderRadius:99, transition:"width 1s ease" }}/>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display:"flex", gap:10, marginTop:14, flexWrap:"wrap" }}>
        <div style={{ flex:1, padding:"8px 12px", borderRadius:10, background:"rgba(0,229,160,0.07)", border:"1px solid rgba(0,229,160,0.15)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:11, color:"rgba(120,170,215,0.7)", fontFamily:"'DM Sans',sans-serif" }}>Velocity Δ</span>
          <span style={{ fontSize:13, fontWeight:800, fontFamily:"'DM Mono',monospace", color:deltaVel>=0?"#00e5a0":"#ff6b6b" }}>{deltaVel>=0?"+":""}{deltaVel} SP</span>
        </div>
        <div style={{ flex:1, padding:"8px 12px", borderRadius:10, background:"rgba(0,200,255,0.07)", border:"1px solid rgba(0,200,255,0.15)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:11, color:"rgba(120,170,215,0.7)", fontFamily:"'DM Sans',sans-serif" }}>Completion Δ</span>
          <span style={{ fontSize:13, fontWeight:800, fontFamily:"'DM Mono',monospace", color:deltaPct>=0?"#00c8ff":"#ff6b6b" }}>{deltaPct>=0?"+":""}{deltaPct}%</span>
        </div>
      </div>
    </Card>
  );
}

/* ─── TASK LIST ─────────────────────────────── */
type SortKey = "severity"|"priority"|"status"|"points";
const SEV_ORDER: Record<string,number>={Critical:0,High:1,Medium:2,Low:3};
const PRI_ORDER: Record<string,number>={P0:0,P1:1,P2:2,P3:3};

function SprintTaskList() {
  const [sortBy,setSortBy]=useState<SortKey>("priority");
  const [filter,setFilter]=useState<string>("All");

  const statuses=["All","Done","In Progress","Review","Blocked","Todo"];

  const sorted=[...SPRINT_TASKS]
    .filter(t=>filter==="All"||t.status===filter)
    .sort((a,b)=>{
      if(sortBy==="severity") return SEV_ORDER[a.severity]-SEV_ORDER[b.severity];
      if(sortBy==="priority") return PRI_ORDER[a.priority]-PRI_ORDER[b.priority];
      if(sortBy==="points")   return b.points-a.points;
      return a.status.localeCompare(b.status);
    });

  return (
    <Card>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10, marginBottom:14 }}>
        <SectionTitle>Sprint Tasks</SectionTitle>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:-12 }}>
          {(["severity","priority","status","points"] as SortKey[]).map(s=>(
            <button key={s} onClick={()=>setSortBy(s)} style={{
              padding:"3px 10px", borderRadius:99, border:"1px solid",
              borderColor:sortBy===s?"#00c8ff":"rgba(100,180,255,0.15)",
              background:sortBy===s?"rgba(0,200,255,0.1)":"transparent",
              color:sortBy===s?"#00c8ff":"rgba(120,170,215,0.5)",
              fontSize:9, fontFamily:"'DM Mono',monospace", fontWeight:700,
              cursor:"pointer", textTransform:"uppercase" as const, letterSpacing:"0.08em",
            }}>↕ {s}</button>
          ))}
        </div>
      </div>
      {/* Status filter tabs */}
      <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:14 }}>
        {statuses.map(s=>(
          <button key={s} onClick={()=>setFilter(s)} style={{
            padding:"3px 10px", borderRadius:99, border:"1px solid",
            borderColor:filter===s?(STATUS_COLOR[s]||"#00c8ff"):"rgba(100,180,255,0.1)",
            background:filter===s?(STATUS_BG[s]||"rgba(0,200,255,0.08)"):"transparent",
            color:filter===s?(STATUS_COLOR[s]||"#00c8ff"):"rgba(120,170,215,0.5)",
            fontSize:9, fontFamily:"'DM Mono',monospace", fontWeight:700,
            cursor:"pointer",
          }}>{s}</button>
        ))}
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {sorted.map(t=>(
          <div key={t.id} style={{
            display:"grid", gridTemplateColumns:"60px 1fr auto auto auto",
            alignItems:"center", gap:10,
            padding:"10px 12px", borderRadius:10,
            background:"rgba(255,255,255,0.02)", border:"1px solid rgba(100,180,255,0.07)",
            transition:"border-color 0.2s, background 0.2s",
          }}
            onMouseEnter={e=>{e.currentTarget.style.background="rgba(0,200,255,0.04)";e.currentTarget.style.borderColor="rgba(0,200,255,0.15)";}}
            onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.02)";e.currentTarget.style.borderColor="rgba(100,180,255,0.07)";}}
          >
            <span style={{ fontSize:10, fontFamily:"'DM Mono',monospace", color:"rgba(80,130,180,0.6)", fontWeight:700 }}>{t.id}</span>
            <span style={{ fontSize:12, color:"rgba(200,225,255,0.85)", fontFamily:"'DM Sans',sans-serif", fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{t.title}</span>
            <div style={{ display:"flex", gap:5, alignItems:"center" }}>
              <span style={{ fontSize:9, padding:"2px 7px", borderRadius:99, background:`${SEV_COLOR[t.severity]}18`, color:SEV_COLOR[t.severity], fontFamily:"'DM Mono',monospace", fontWeight:700, whiteSpace:"nowrap" as const }}>{t.severity}</span>
              <span style={{ fontSize:9, padding:"2px 7px", borderRadius:99, background:`${PRI_COLOR[t.priority]}18`, color:PRI_COLOR[t.priority], fontFamily:"'DM Mono',monospace", fontWeight:700 }}>{t.priority}</span>
            </div>
            <span style={{ fontSize:9, padding:"2px 8px", borderRadius:99, background:STATUS_BG[t.status], color:STATUS_COLOR[t.status], fontFamily:"'DM Mono',monospace", fontWeight:700, whiteSpace:"nowrap" as const }}>{t.status}</span>
            <span style={{ fontSize:11, fontFamily:"'DM Mono',monospace", fontWeight:700, color:"rgba(160,210,255,0.6)", textAlign:"right" as const }}>{t.points}sp</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ─── CONTRIBUTION DOUGHNUT ─────────────────── */
function ContributionDoughnut() {
  const [anim,setAnim]=useState(false);
  const [hov,setHov]=useState<number|null>(null);
  useEffect(()=>{ const t=setTimeout(()=>setAnim(true),400); return()=>clearTimeout(t); },[]);

  const cx=120,cy=120,outerR=95,innerR=54,gap=2.5;
  const total=TEAM_MEMBERS.reduce((s,m)=>s+m.contribution,0);
  let cursor=-Math.PI/2;
  const segs=TEAM_MEMBERS.map((m,i)=>{
    const frac=m.contribution/total,angle=frac*2*Math.PI-(gap*Math.PI/180),start=cursor,end=cursor+angle;
    cursor+=frac*2*Math.PI;
    const la=angle>Math.PI?1:0;
    const x1=cx+outerR*Math.cos(start),y1=cy+outerR*Math.sin(start);
    const x2=cx+outerR*Math.cos(end),  y2=cy+outerR*Math.sin(end);
    const x3=cx+innerR*Math.cos(end),  y3=cy+innerR*Math.sin(end);
    const x4=cx+innerR*Math.cos(start),y4=cy+innerR*Math.sin(start);
    const mid=(start+end)/2;
    return{ ...m, i, d:`M${x1},${y1} A${outerR},${outerR} 0 ${la} 1 ${x2},${y2} L${x3},${y3} A${innerR},${innerR} 0 ${la} 0 ${x4},${y4} Z`, frac, mid };
  });
  const hs=hov!==null?segs[hov]:null;

  return(
    <Card>
      <SectionTitle>Team Contribution</SectionTitle>
      <div style={{ display:"flex", alignItems:"center", gap:20, flexWrap:"wrap" }}>
        <svg viewBox="0 0 240 240" style={{ width:"100%",maxWidth:200,flexShrink:0 }} onMouseLeave={()=>setHov(null)}>
          <defs>{segs.map(s=><radialGradient key={s.i} id={`cg${s.i}`} cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor={s.color}/><stop offset="100%" stopColor={s.color} stopOpacity=".65"/></radialGradient>)}</defs>
          {segs.map(s=>(
            <g key={s.i} style={{cursor:"pointer"}} onMouseEnter={()=>setHov(s.i)}>
              <path d={s.d} fill={`url(#cg${s.i})`} stroke="rgba(6,13,31,0.8)" strokeWidth="2"
                style={{ transform:hov===s.i?`translate(${Math.cos(s.mid)*5}px,${Math.sin(s.mid)*5}px)`:"none", transition:"transform 0.25s ease", opacity:anim?1:0, transformOrigin:`${cx}px ${cy}px`, transitionDelay:`${s.i*0.07}s` }}/>
            </g>
          ))}
          <circle cx={cx} cy={cy} r={innerR-3} fill="rgba(6,13,31,0.9)"/>
          {hs?(
            <>
              <text x={cx} y={cy-14} textAnchor="middle" dominantBaseline="middle" fontSize="18" fill={hs.color} fontFamily="'DM Mono',monospace" fontWeight="800">{hs.contribution}%</text>
              <text x={cx} y={cy+5}  textAnchor="middle" dominantBaseline="middle" fontSize="9"  fill="rgba(160,210,255,0.7)" fontFamily="'DM Sans',sans-serif">{hs.initials}</text>
              <text x={cx} y={cy+20} textAnchor="middle" dominantBaseline="middle" fontSize="8"  fill={hs.color} fontFamily="'DM Mono',monospace">{hs.name.split(" ")[0]}</text>
            </>
          ):(
            <>
              <text x={cx} y={cy-8} textAnchor="middle" dominantBaseline="middle" fontSize="14" fill="#e8f4ff" fontFamily="'DM Mono',monospace" fontWeight="800">{TEAM_MEMBERS.length}</text>
              <text x={cx} y={cy+10} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="rgba(120,180,240,0.5)" fontFamily="'DM Sans',sans-serif">Members</text>
            </>
          )}
        </svg>
        <div style={{ flex:1, display:"flex", flexDirection:"column", gap:8, minWidth:130 }}>
          {segs.map(s=>(
            <div key={s.i} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 10px", borderRadius:8,
              background:hov===s.i?`${s.color}12`:"rgba(255,255,255,0.02)",
              border:`1px solid ${hov===s.i?s.color+"44":"rgba(100,180,255,0.07)"}`,
              cursor:"pointer", transition:"all 0.2s",
            }} onMouseEnter={()=>setHov(s.i)} onMouseLeave={()=>setHov(null)}>
              <div style={{ width:8,height:8,borderRadius:2,background:s.color,flexShrink:0 }}/>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:11, fontFamily:"'DM Sans',sans-serif", color:"rgba(180,215,255,0.85)", fontWeight:600 }}>{s.name}</div>
                <div style={{ height:3, background:"rgba(255,255,255,0.06)", borderRadius:99, overflow:"hidden", marginTop:3 }}>
                  <div style={{ height:"100%", width:`${s.contribution}%`, background:s.color, borderRadius:99, transition:"width 1s ease" }}/>
                </div>
              </div>
              <span style={{ fontSize:11, fontFamily:"'DM Mono',monospace", fontWeight:700, color:s.color }}>{s.contribution}%</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

/* ─── VELOCITY CHART ────────────────────────── */
function VelocityChart() {
  const [anim,setAnim]=useState(false);
  useEffect(()=>{ const t=setTimeout(()=>setAnim(true),300); return()=>clearTimeout(t); },[]);

  const max=55, barH=120;
  const avg=Math.round(SPRINT_HISTORY.reduce((s,h)=>s+h.velocity,0)/SPRINT_HISTORY.length);

  return(
    <Card>
      <SectionTitle>Avg Story Point Velocity</SectionTitle>
      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:16 }}>
        <span style={{ fontSize:28, fontWeight:800, fontFamily:"'DM Mono',monospace", color:"#f5c842", letterSpacing:"-0.03em" }}>{avg}</span>
        <div>
          <div style={{ fontSize:10, color:"rgba(120,170,215,0.6)", fontFamily:"'DM Sans',sans-serif" }}>avg SP / sprint</div>
          <div style={{ fontSize:10, color:"rgba(0,229,160,0.7)", fontFamily:"'DM Mono',monospace", fontWeight:700, marginTop:2 }}>↑ Trending up</div>
        </div>
      </div>
      <div style={{ display:"flex", alignItems:"flex-end", gap:8, height:barH+28 }}>
        {SPRINT_HISTORY.map((s,i)=>{
          const isCurrent=i===SPRINT_HISTORY.length-1;
          const pct=(s.velocity/max)*barH;
          const color=isCurrent?"#f5c842":"rgba(100,160,210,0.4)";
          return(
            <div key={s.sprint} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-end", height:"100%" }}>
              <span style={{ fontSize:10, fontFamily:"'DM Mono',monospace", fontWeight:700, color, marginBottom:4, opacity:anim?1:0, transition:`opacity 0.5s ease ${i*0.1}s` }}>{s.velocity}</span>
              <div style={{ width:"100%", height:`${anim?pct:0}px`, transition:`height 0.9s cubic-bezier(0.23,1,0.32,1) ${i*0.08}s`,
                borderRadius:"5px 5px 2px 2px",
                background:isCurrent?"linear-gradient(180deg,#f5c842,#f5c84266)":"rgba(100,160,210,0.2)",
                boxShadow:isCurrent?"0 0 14px #f5c84244":"none",
              }}/>
              <span style={{ fontSize:8, fontFamily:"'DM Mono',monospace", color: isCurrent?"#f5c842":"rgba(80,130,180,0.5)", marginTop:6, textAlign:"center" as const, lineHeight:1.2 }}>S{18+i}</span>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop:10, padding:"6px 10px", borderRadius:8, background:"rgba(245,200,66,0.06)", border:"1px dashed rgba(245,200,66,0.2)", fontSize:10, color:"rgba(245,200,66,0.6)", fontFamily:"'DM Mono',monospace", textAlign:"center" as const }}>
        Target: 48 SP/sprint
      </div>
    </Card>
  );
}

/* ─── STACKED COLUMN CHART ──────────────────── */
function StackedColumnChart() {
  const [anim,setAnim]=useState(false);
  const [hov,setHov]=useState<number|null>(null);
  useEffect(()=>{ const t=setTimeout(()=>setAnim(true),400); return()=>clearTimeout(t); },[]);

  const maxTotal=16;
  const barAreaH=150;

  return(
    <Card>
      <SectionTitle>Sprint Completed vs Not Completed</SectionTitle>
      <div style={{ display:"flex", alignItems:"flex-end", gap:10, height:barAreaH+60, position:"relative" }}>
        {/* Y gridlines */}
        {[0,4,8,12,16].map(v=>{
          const y=barAreaH-(v/maxTotal)*barAreaH;
          return(<div key={v} style={{ position:"absolute", left:24, right:0, top:y, borderTop:"1px dashed rgba(100,180,255,0.07)", display:"flex", alignItems:"center" }}>
            <span style={{ fontSize:8, color:"rgba(80,130,180,0.4)", fontFamily:"'DM Mono',monospace", position:"absolute", left:-20, top:-6 }}>{v}</span>
          </div>);
        })}

        <div style={{ display:"flex", alignItems:"flex-end", gap:10, width:"100%", height:barAreaH+40, paddingLeft:24, paddingBottom:40, position:"relative", zIndex:1 }}>
          {SPRINT_HISTORY.map((s,i)=>{
            const isCurrent=i===SPRINT_HISTORY.length-1;
            const notDone=s.total-s.completed;
            const doneH=anim?(s.completed/maxTotal)*barAreaH:0;
            const notDoneH=anim?(notDone/maxTotal)*barAreaH:0;
            return(
              <div key={s.sprint} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-end", height:"100%", cursor:"pointer" }}
                onMouseEnter={()=>setHov(i)} onMouseLeave={()=>setHov(null)}>
                {/* Hover tooltip */}
                {hov===i&&(
                  <div style={{ position:"absolute", bottom:barAreaH+10, background:"rgba(10,22,44,0.95)", border:"1px solid rgba(0,200,255,0.3)", borderRadius:8, padding:"8px 12px", zIndex:10, whiteSpace:"nowrap" as const }}>
                    <div style={{ fontSize:10, color:"rgba(160,210,255,0.8)", fontFamily:"'DM Sans',sans-serif", marginBottom:4 }}>{s.sprint}</div>
                    <div style={{ fontSize:11, color:"#00e5a0", fontFamily:"'DM Mono',monospace", fontWeight:700 }}>✓ Done: {s.completed}</div>
                    <div style={{ fontSize:11, color:"#ff6b6b", fontFamily:"'DM Mono',monospace", fontWeight:700 }}>✗ Remaining: {notDone}</div>
                  </div>
                )}
                {/* Not done segment */}
                <div style={{ width:"100%", height:`${notDoneH}px`, transition:`height 0.9s cubic-bezier(0.23,1,0.32,1) ${i*0.08}s`,
                  background: isCurrent?"rgba(255,107,107,0.6)":"rgba(255,107,107,0.35)",
                  borderRadius:"5px 5px 0 0",
                  boxShadow: hov===i?"0 0 12px rgba(255,107,107,0.3)":"none",
                }}/>
                {/* Done segment */}
                <div style={{ width:"100%", height:`${doneH}px`, transition:`height 0.9s cubic-bezier(0.23,1,0.32,1) ${i*0.08+0.05}s`,
                  background: isCurrent?"linear-gradient(180deg,#00e5a0,#00e5a066)":"rgba(0,229,160,0.35)",
                  boxShadow: hov===i?"0 0 12px rgba(0,229,160,0.3)":"none",
                }}/>
                {/* Label */}
                <div style={{ marginTop:8, textAlign:"center" as const }}>
                  <div style={{ fontSize:8, fontFamily:"'DM Mono',monospace", color:isCurrent?"#f5c842":"rgba(80,130,180,0.5)", fontWeight:700 }}>S{18+i}</div>
                  <div style={{ fontSize:7, fontFamily:"'DM Mono',monospace", color:"rgba(80,130,180,0.4)", marginTop:1 }}>{s.completed}/{s.total}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* Legend */}
      <div style={{ display:"flex", gap:16, marginTop:8 }}>
        {[["#00e5a0","Completed"],["#ff6b6b","Remaining"]].map(([c,l])=>(
          <div key={l} style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ width:10,height:10,borderRadius:2,background:c }}/>
            <span style={{ fontSize:10, color:"rgba(140,185,230,0.6)", fontFamily:"'DM Sans',sans-serif" }}>{l}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ─── MAIN DASHBOARD PAGE ───────────────────── */
export default function DashboardPage() {
  const [mounted,setMounted]=useState(false);
  useEffect(()=>{ setTimeout(()=>setMounted(true),80); },[]);

  const anim=(d:number):React.CSSProperties => ({
    animation: mounted?`fadeUp 0.55s ease ${d}s both`:"none",
  });

  const doneCount   = SPRINT_TASKS.filter(t=>t.status==="Done").length;
  const blockedCount= SPRINT_TASKS.filter(t=>t.status==="Blocked").length;
  const totalSP     = SPRINT_TASKS.reduce((s,t)=>s+t.points,0);
  const doneSP      = SPRINT_TASKS.filter(t=>t.status==="Done").reduce((s,t)=>s+t.points,0);

  return (
    <div style={{ padding:"20px 0 40px" }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* KPI row */}
      <div style={{ display:"flex", gap:14, flexWrap:"wrap", marginBottom:20, ...anim(0) }}>
        <ScoreKPI label="Overall Team Score"  value="8,742" color="#00c8ff" sub="All seasons · Ranked" delta={6.2}/>
        <ScoreKPI label="Tasks Done / Sprint" value={`${doneCount}/${SPRINT_TASKS.length}`} color="#00e5a0" sub="Current Sprint 22" delta={9} deltaLabel="vs Sprint 21"/>
        <ScoreKPI label="Story Points Done"   value={`${doneSP}/${totalSP}`} color="#f5c842" sub="SP delivered" delta={-4.3} deltaLabel="vs Sprint 21"/>
        <ScoreKPI label="Blocked Tasks"       value={blockedCount} color="#ff6b6b" sub="Needs attention" delta={-1} deltaLabel="vs last sprint"/>
      </div>

      {/* Line chart */}
      <div style={{ marginBottom:20, ...anim(0.05) }}>
        <TeamLineChart/>
      </div>

      {/* Sprint comparison + Velocity */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:20, ...anim(0.1) }} className="dash-2col">
        <SprintComparison/>
        <VelocityChart/>
      </div>

      {/* Contribution doughnut + Stacked column */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:20, ...anim(0.15) }} className="dash-2col">
        <ContributionDoughnut/>
        <StackedColumnChart/>
      </div>

      {/* Task list */}
      <div style={{ ...anim(0.2) }}>
        <SprintTaskList/>
      </div>

      <style>{`
        @media(max-width:700px){
          .dash-2col{ grid-template-columns:1fr!important; }
        }
      `}</style>
    </div>
  );
}
