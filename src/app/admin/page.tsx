import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { CalendarCog, ClipboardList, Coins, Gauge, Swords, WandSparkles } from "lucide-react";
export const metadata:Metadata={title:"Admin"};
const tools=[
  {name:"Competition weeks",text:"Edit dates, statuses and break weeks.",Icon:CalendarCog},
  {name:"Fixtures & odds",text:"Seed fixtures, choose GOTW and set odds.",Icon:ClipboardList},
  {name:"Auto-picks",text:"Create picks for missing players after lock.",Icon:WandSparkles},
  {name:"Settlement",text:"Enter results and settle each pick once.",Icon:Gauge},
  {name:"Ledger",text:"Audit movements and add adjustments.",Icon:Coins},
  {name:"Challenges",text:"Review directional matchups and transfers.",Icon:Swords},
];
export default function Page(){return <AppShell><main className="content content-wide"><div className="page-head"><div><p className="eyebrow">Restricted</p><h1>Admin desk</h1><p className="subtle">Run the competition without touching the database.</p></div><span className="pill live">Admin</span></div>
<div className="notice" style={{marginBottom:18}}><b>Week 4 is open.</b> 4 of 6 players have submitted. Missing-player auto-picks become available after Saturday at 10:00 AM.</div>
<section className="admin-grid">{tools.map(({name,text,Icon})=><article className="card admin-card" key={name}><div><span className="icon-box"><Icon size={21}/></span><h3>{name}</h3><p>{text}</p></div><button className="secondary" style={{marginTop:16}}>Open</button></article>)}</section>
<section className="card" style={{marginTop:18}}><div className="fixture-head"><div><p className="eyebrow">Quick action</p><h2 style={{margin:0}}>Run missing-player auto-picks</h2></div><span className="pill">0 eligible</span></div><p className="subtle">Creates 5 points on the GOTW favorite and 5 on the strongest favorite elsewhere. This action is idempotent.</p><button className="secondary" disabled>Run auto-picks</button></section>
</main></AppShell>}
