"use client";
import { useState } from "react";
import { CheckCircle2, Clock3, ShieldQuestion } from "lucide-react";
import { currentWeek, fixtures, type Fixture, type Outcome } from "@/lib/demo-data";
import { AppShell } from "@/components/app-shell";

function FixtureCard({fixture,selection,onSelect,stake,setStake,label}:{fixture:Fixture;selection?:Outcome;onSelect:(o:Outcome)=>void;stake:number;setStake:(n:number)=>void;label?:string}) {
  return <article className="card">
    <div className="fixture-head"><div><div className="teams">{fixture.home} <span className="subtle">vs</span> {fixture.away}</div><div className="kickoff">{fixture.kickoff}</div></div>
      {label&&<span className="pill">{label}</span>}</div>
    <div className="odds">{(["home","draw","away"] as Outcome[]).map(o=><button type="button" key={o} onClick={()=>onSelect(o)} className={`odd ${selection===o?"selected":""}`} aria-pressed={selection===o}>
      <small>{o==="home"?fixture.home:o==="away"?fixture.away:"Draw"}</small>{fixture.odds[o].toFixed(2)}
    </button>)}</div>
    {selection&&<div className="stake-wrap"><div><b>Stake</b><div className="kickoff">From this week&apos;s 10</div></div><div className="stepper">
      <button type="button" onClick={()=>setStake(Math.max(1,stake-1))} aria-label="Decrease stake">−</button><span>{stake}</span><button type="button" onClick={()=>setStake(Math.min(9,stake+1))} aria-label="Increase stake">+</button>
    </div></div>}
  </article>;
}

export function PicksFlow(){
  const gotw=fixtures.find(f=>f.gotw)!; const others=fixtures.filter(f=>!f.gotw);
  const [gotwPick,setGotwPick]=useState<Outcome>(); const [otherId,setOtherId]=useState(others[0].id);
  const [otherPick,setOtherPick]=useState<Outcome>(); const [gotwStake,setGotwStake]=useState(5); const [otherStake,setOtherStake]=useState(5); const [saved,setSaved]=useState(false);
  const other=others.find(f=>f.id===otherId)!; const total=gotwStake+otherStake; const valid=Boolean(gotwPick&&otherPick&&total===10&&gotwStake>=1&&otherStake>=1);
  const adjustGotw=(n:number)=>{setSaved(false);setGotwStake(n);setOtherStake(10-n)}; const adjustOther=(n:number)=>{setSaved(false);setOtherStake(n);setGotwStake(10-n)};
  return <AppShell><main className="content">
    <div className="page-head"><div><p className="eyebrow">Competition week {currentWeek.number}</p><h1>Your picks</h1><p className="subtle">{currentWeek.label}</p></div><span className="pill live"><Clock3 size={13}/>Open</span></div>
    <section className="card hero-card"><p className="eyebrow" style={{color:"#cde6dc"}}>What you need to know</p><h2 style={{marginBottom:6}}>Lock in by {currentWeek.lock}</h2><p style={{opacity:.72,marginBottom:0}}>Both picks lock together. You can edit freely until then.</p>
      <div className="stat-row"><div className="stat"><span className="stat-label">Bankroll</span><span className="stat-value">{currentWeek.bankroll}</span></div><div className="stat"><span className="stat-label">This week</span><span className="stat-value">10</span></div><div className="stat"><span className="stat-label">Your rank</span><span className="stat-value">1st</span></div></div>
    </section>
    <div className="section-label"><div><p className="eyebrow">Required</p><h2>Game of the Week</h2></div><ShieldQuestion size={21}/></div>
    <FixtureCard fixture={gotw} selection={gotwPick} onSelect={o=>{setSaved(false);setGotwPick(o)}} stake={gotwStake} setStake={adjustGotw} label="GOTW"/>
    <div className="section-label"><div><p className="eyebrow">Your choice</p><h2>Choose one other match</h2></div></div>
    <div className="card" style={{marginBottom:14}}><label className="field" style={{margin:0}}>Fixture<select value={otherId} onChange={e=>{setOtherId(e.target.value);setOtherPick(undefined);setSaved(false)}} style={{minHeight:48,border:"1px solid var(--line)",borderRadius:13,padding:"0 12px",background:"white"}}>
      {others.map(f=><option value={f.id} key={f.id}>{f.home} vs {f.away}</option>)}</select></label></div>
    <FixtureCard fixture={other} selection={otherPick} onSelect={o=>{setSaved(false);setOtherPick(o)}} stake={otherStake} setStake={adjustOther}/>
    {saved&&<div className="saved"><CheckCircle2 size={20}/>Picks saved. You can edit until the deadline.</div>}
    <div className="allocation"><div className="allocation-row"><b>Allocated: {gotwStake} + {otherStake} = {total}</b><span>{Math.max(0,10-total)} remaining</span></div><div className="progress"><div style={{width:`${Math.min(100,total*10)}%`}}/></div>
      <button className="primary" disabled={!valid} onClick={()=>setSaved(true)}>{saved?"Saved":"Save weekly picks"}</button></div>
    <div className="section-label"><h2>Challenge a mate</h2><span className="pill">7 left</span></div>
    <div className="card"><p className="subtle">Back yourself against an opponent this week. Higher normal-bet result wins the 10-point transfer.</p><button className="secondary">Choose opponent</button></div>
  </main></AppShell>
}
