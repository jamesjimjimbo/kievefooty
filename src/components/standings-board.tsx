"use client";
import { useState } from "react";import { AppShell } from "./app-shell";import { ClubCrest } from "./club-crest";
type Tab="first"|"second"|"overall";
export type StandingPlayer={id:string;name:string;initials:string;first:number;second:number;overall:number;projected:number;seasonProjection:number;me:boolean};
export function StandingsBoard({players}:{players:StandingPlayer[]}){
 const [tab,setTab]=useState<Tab>("overall");const [includeSeason,setIncludeSeason]=useState(false);const scoreKey=tab==="overall"&&includeSeason?"projected":tab;const sorted=[...players].sort((a,b)=>b[scoreKey]-a[scoreKey]);
 return <AppShell><main className="content"><div className="page-head"><div><p className="eyebrow">2026 / 27</p><h1>Standings</h1><p className="subtle">Bragging rights, updated after settlement.</p></div></div>
 <div className="segmented">{([["first","First Half"],["second","Second Half"],["overall","Full Competition"]] as [Tab,string][]).map(([key,label])=><button key={key} className={`segment ${tab===key?"active":""}`} onClick={()=>{setTab(key);if(key!=="overall")setIncludeSeason(false)}}>{label}</button>)}</div>
 <div className="card standings-summary"><div><p className="eyebrow">Prize share</p><b>{tab==="overall"?"60%":"15%"} of the pot</b></div>{tab==="overall"?<label className="projection-toggle large"><input type="checkbox" checked={includeSeason} onChange={event=>setIncludeSeason(event.target.checked)}/><span/><div><b>Include season bets</b><small>Assume current results stand</small></div></label>:<span className="pill">Weekly bets only</span>}</div>
 <section className="card table">{sorted.length?sorted.map((p,i)=><div className={`standing-row ${p.me?"me":""}`} key={p.id}><span className="rank">{i+1}</span><span className="player"><ClubCrest seed={p.id} label={p.name} size="sm"/><span>{p.name}{p.me&&<small className="you-label">You</small>}</span></span><span className="form">{includeSeason&&p.seasonProjection>0?`+${p.seasonProjection} proj.`:"—"}</span><span className="points">{p[scoreKey]>0?"+":""}{p[scoreKey]}</span></div>):<div style={{padding:24,textAlign:"center"}}><b>No players yet</b><p className="subtle">The table fills as friends create accounts.</p></div>}</section>
 <p className="subtle" style={{fontSize:12,marginTop:14}}>{includeSeason?"Projection only: official scores do not change until a season competition settles.":"Weekly +10 credits never count here. Full Competition includes settled weekly, challenge, and season results."}</p>
 </main></AppShell>
}
