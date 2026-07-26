"use client";
import { useState } from "react";import { AppShell } from "./app-shell";
type Tab="first"|"second"|"overall";
export type StandingPlayer={id:string;name:string;initials:string;first:number;second:number;overall:number;me:boolean};
export function StandingsBoard({players}:{players:StandingPlayer[]}){
 const [tab,setTab]=useState<Tab>("overall");const sorted=[...players].sort((a,b)=>b[tab]-a[tab]);
 return <AppShell><main className="content"><div className="page-head"><div><p className="eyebrow">2026 / 27</p><h1>Standings</h1><p className="subtle">Bragging rights, updated after settlement.</p></div></div>
 <div className="segmented">{([["first","First Half"],["second","Second Half"],["overall","Overall"]] as [Tab,string][]).map(([key,label])=><button key={key} className={`segment ${tab===key?"active":""}`} onClick={()=>setTab(key)}>{label}</button>)}</div>
 <div className="card" style={{marginBottom:14}}><div style={{display:"flex",justifyContent:"space-between",gap:12}}><div><p className="eyebrow">Prize share</p><b>{tab==="overall"?"70%":"15%"} of the pot</b></div><span className="pill">{tab==="overall"?"Full season":"Weekly bets only"}</span></div></div>
 <section className="card table">{sorted.length?sorted.map((p,i)=><div className={`standing-row ${p.me?"me":""}`} key={p.id}><span className="rank">{i+1}</span><span className="player"><i className="mini-avatar">{p.initials}</i>{p.name}{p.me&&<small className="pill" style={{padding:"3px 6px"}}>You</small>}</span><span className="form">—</span><span className="points">{p[tab]>0?"+":""}{p[tab]}</span></div>):<div style={{padding:24,textAlign:"center"}}><b>No players yet</b><p className="subtle">The table fills as friends create accounts.</p></div>}</section>
 <p className="subtle" style={{fontSize:12,marginTop:14}}>Weekly +10 credits never count here. Overall includes weekly betting results and challenge transfers.</p>
 </main></AppShell>
}
