"use client";
import { useState,useTransition } from "react";
import { CheckCircle2,Clock3,ShieldQuestion } from "lucide-react";
import type { Fixture,Outcome } from "@/lib/demo-data";
import { AppShell } from "@/components/app-shell";
import { ClubCrest } from "@/components/club-crest";
import { createChallenge,saveWeeklyPicks } from "@/app/picks/actions";

type ExistingPick={fixture_id:string;kind:"gotw"|"own";selected_outcome:Outcome;stake:number};
export type PicksPageData={
  week:{id:string;number:number;label:string;lockAt:string;lockLabel:string};bankroll:number;rank:number;fixtures:Fixture[];
  existing:{gotw?:ExistingPick;own?:ExistingPick;source?:string};opponents:{id:string;display_name:string}[];challengeTokens:number;locked:boolean;
  standings:{
    first:{id:string;name:string;score:number;me:boolean}[];
    second:{id:string;name:string;score:number;me:boolean}[];
    overall:{id:string;name:string;score:number;me:boolean}[];
    projected:{id:string;name:string;score:number;me:boolean;seasonProjection:number}[];
  };
  leaguePicks:{userId:string;name:string;source:"manual"|"auto";picks:{fixtureId:string;fixture:string;kind:"gotw"|"own";outcome:Outcome;stake:number;odds:number;isCorrect:boolean|null}[]}[];
  previousWeek?:{label:string;winner:{id:string;name:string;score:number};loser:{id:string;name:string;score:number}};
};

function FixtureCard({fixture,selection,onSelect,stake,setStake,label,disabled}:{fixture:Fixture;selection?:Outcome;onSelect:(o:Outcome)=>void;stake:number;setStake:(n:number)=>void;label?:string;disabled?:boolean}) {
  return <article className="card"><div className="fixture-head"><div><div className="teams">{fixture.home} <span className="subtle">vs</span> {fixture.away}</div><div className="kickoff">{fixture.kickoff}</div></div>{label&&<span className="pill">{label}</span>}</div>
    <div className="odds">{(["home","draw","away"] as Outcome[]).map(o=><button disabled={disabled} type="button" key={o} onClick={()=>onSelect(o)} className={`odd ${selection===o?"selected":""}`} aria-pressed={selection===o}><small>{o==="home"?fixture.home:o==="away"?fixture.away:"Draw"}</small>{fixture.odds[o].toFixed(2)}</button>)}</div>
    {selection&&<div className="stake-wrap"><div><b>Stake</b><div className="kickoff">Adjust your split</div></div><div className="stepper"><button disabled={disabled} type="button" onClick={()=>setStake(Math.max(1,stake-1))} aria-label="Reduce stake">−</button><span>{stake}</span><button disabled={disabled} type="button" onClick={()=>setStake(Math.min(9,stake+1))} aria-label="Increase stake">+</button></div></div>}
  </article>;
}

export function PicksFlow({data}:{data:PicksPageData|null}){
  if(!data)return <AppShell><main className="content"><div className="page-head"><div><p className="eyebrow">No active week</p><h1>Boots off for now.</h1><p className="subtle">The next Competition Week will appear here when an admin opens it.</p></div></div></main></AppShell>;
  return <LivePicks data={data}/>;
}

function LivePicks({data}:{data:PicksPageData}){
  const gotw=data.fixtures.find(f=>f.gotw)!;const others=data.fixtures.filter(f=>!f.gotw);
  const [gotwPick,setGotwPick]=useState<Outcome|undefined>(data.existing.gotw?.selected_outcome);
  const [otherId,setOtherId]=useState(data.existing.own?.fixture_id??others[0]?.id);
  const [otherPick,setOtherPick]=useState<Outcome|undefined>(data.existing.own?.selected_outcome);
  const [gotwStake,setGotwStake]=useState(Number(data.existing.gotw?.stake??5));const [otherStake,setOtherStake]=useState(Number(data.existing.own?.stake??5));
  const [message,setMessage]=useState(data.existing.source?`${data.existing.source==="auto"?"Auto-picks":"Picks"} saved`:"");
  const [opponent,setOpponent]=useState(data.opponents[0]?.id??"");const [pending,startTransition]=useTransition();
  const other=others.find(f=>f.id===otherId);const total=gotwStake+otherStake;const valid=Boolean(gotwPick&&otherPick&&other&&total===10&&!data.locked);
  const adjustGotw=(n:number)=>{setMessage("");setGotwStake(n);setOtherStake(10-n)};const adjustOther=(n:number)=>{setMessage("");setOtherStake(n);setGotwStake(10-n)};
  const submit=()=>startTransition(async()=>{if(!gotwPick||!otherPick||!other)return;const result=await saveWeeklyPicks({weekId:data.week.id,gotwFixtureId:gotw.id,gotwOutcome:gotwPick,gotwStake,ownFixtureId:other.id,ownOutcome:otherPick,ownStake:otherStake});setMessage(result.error??"Picks saved. You can edit until the deadline.")});
  const challenge=()=>startTransition(async()=>{if(!opponent)return;const result=await createChallenge({weekId:data.week.id,opponentId:opponent});setMessage(result.error??"Challenge sent. No acceptance needed.")});
  return <AppShell><main className="content content-wide picks-page">
    <div className="picks-topline"><div><span>Competition week {data.week.number}</span><b>{data.week.label}</b></div><span className={`pill ${data.locked?"":"live"}`}><Clock3 size={13}/>{data.locked?"Locked":"Open"}</span></div>
    {data.previousWeek&&<WeeklyRecap recap={data.previousWeek}/>}
    <div className="picks-layout"><div>
      <section className="card hero-card compact-hero"><div><p className="eyebrow">Weekly deadline</p><h2>Lock in by {data.week.lockLabel}</h2><p>The first eligible kickoff locks both picks.</p></div><div className="stat-row"><div className="stat"><span className="stat-label">Bankroll</span><span className="stat-value">{data.bankroll}</span></div><div className="stat"><span className="stat-label">Your rank</span><span className="stat-value">#{data.rank}</span></div></div></section>
      <div className="pick-choice-grid">
        <section className="pick-choice">
          <div className="section-label"><div><p className="eyebrow">Required</p><h2>Game of the Week</h2></div><ShieldQuestion size={21}/></div>
          <FixtureCard fixture={gotw} selection={gotwPick} onSelect={o=>{setMessage("");setGotwPick(o)}} stake={gotwStake} setStake={adjustGotw} label="GOTW" disabled={data.locked}/>
        </section>
        <section className="pick-choice">
          <div className="section-label"><div><p className="eyebrow">Your choice</p><h2>One other match</h2></div></div>
          <div className="card fixture-select"><label className="field" style={{margin:0}}>Fixture<select disabled={data.locked} value={otherId} onChange={e=>{setOtherId(e.target.value);setOtherPick(undefined);setMessage("")}}>{others.map(f=><option value={f.id} key={f.id}>{f.home} vs {f.away}</option>)}</select></label></div>
          {other&&<FixtureCard fixture={other} selection={otherPick} onSelect={o=>{setMessage("");setOtherPick(o)}} stake={otherStake} setStake={adjustOther} disabled={data.locked}/>}
        </section>
      </div>
      {message&&<div className={message.toLowerCase().includes("error")?"notice":"saved"}><CheckCircle2 size={20}/>{message}</div>}
      <div className="save-picks"><p>Your split stays balanced automatically. Edit any pick until the deadline.</p><button className="primary" disabled={!valid||pending} onClick={submit}>{pending?"Saving…":data.locked?"Picks locked":"Save picks"}</button></div>
      {data.locked&&<LockedLeaguePicks entries={data.leaguePicks}/>}
    </div><aside className="picks-sidebar">
      <StandingsSnapshot rows={data.standings}/>
      <div className="section-label"><h2>Challenge a mate</h2><span className="pill">{data.challengeTokens} left</span></div>
      <div className="card"><p><b>Put 10 points head-to-head.</b></p><p className="subtle challenge-copy">Choose an opponent before lock. No acceptance is needed. Your two normal picks are compared; the higher weekly net wins a 10-point transfer. A tie transfers nothing, but the challenge is used.</p>{data.opponents.length?<><label className="field">Opponent<select value={opponent} onChange={e=>setOpponent(e.target.value)}>{data.opponents.map(p=><option key={p.id} value={p.id}>{p.display_name}</option>)}</select></label><button className="secondary" disabled={pending||data.locked} onClick={challenge}>Issue challenge</button></>:<p className="subtle">You have challenged every available opponent once, or no other players have joined yet.</p>}</div>
    </aside></div>
  </main></AppShell>;
}

function StandingsSnapshot({rows}:{rows:PicksPageData["standings"]}){
  const [tab,setTab]=useState<"first"|"second"|"overall">("overall");
  const [project,setProject]=useState(false);
  const selected=tab==="overall"&&project?rows.projected:rows[tab];
  const top=[...selected].sort((a,b)=>b.score-a.score).slice(0,8);
  return <section className="home-standings"><div className="section-label"><div><p className="eyebrow">At a glance</p><h2>League table</h2></div><a className="text-link" href="/standings">Full table →</a></div>
    <div className="home-standing-controls"><div className="mini-segments" aria-label="Standings period">{([["first","First"],["second","Second"],["overall","Full"]] as const).map(([value,label])=><button type="button" key={value} onClick={()=>{setTab(value);if(value!=="overall")setProject(false)}} className={tab===value?"active":""}>{label}</button>)}</div>
    {tab==="overall"&&<label className="projection-toggle"><input type="checkbox" checked={project} onChange={event=>setProject(event.target.checked)}/><span/><b>Include season bets</b></label>}</div>
    {tab==="overall"&&project&&<p className="projection-note">Assumes today&apos;s league and market results are final.</p>}
    <div className="card table compact-table">{top.map((row,index)=><div className={`standing-row ${row.me?"me":""}`} key={row.id}><span className="rank">{index+1}</span><span className="player"><ClubCrest seed={row.id} label={row.name} size="sm"/><span>{row.name}{row.me&&<small className="you-label">You</small>}</span></span><span className="points">{row.score>0?"+":""}{row.score}</span></div>)}</div>
  </section>;
}

function WeeklyRecap({recap}:{recap:NonNullable<PicksPageData["previousWeek"]>}){
  return <section className="weekly-recap">
    <div className="recap-intro"><span>Glory &amp; grief</span><b>{recap.label}</b></div>
    <div className="recap-player winner"><ClubCrest seed={recap.winner.id} label={recap.winner.name}/><div><small>Last week&apos;s winner</small><b>{recap.winner.name}</b></div><strong>{recap.winner.score>0?"+":""}{recap.winner.score}</strong></div>
    <div className="recap-divider"/>
    <div className="recap-player loser"><ClubCrest seed={recap.loser.id} label={recap.loser.name}/><div><small>Form guide enthusiast</small><b>{recap.loser.name}</b></div><span>The model remains confident.</span></div>
  </section>;
}

function LockedLeaguePicks({entries}:{entries:PicksPageData["leaguePicks"]}){
  return <section className="locked-picks"><div className="section-label"><div><p className="eyebrow">Deadline passed</p><h2>Everyone&apos;s picks</h2></div></div>
    {entries.length?<div className="league-pick-grid">{entries.map(entry=><article className="card league-pick-card" key={entry.userId}><div className="league-pick-head"><b>{entry.name}</b>{entry.source==="auto"&&<span className="pill">Auto-picks</span>}</div>{entry.picks.sort((a,b)=>a.kind.localeCompare(b.kind)).map(p=>{const potential=Math.round((p.stake*p.odds-p.stake)*100)/100;const result=p.isCorrect===null?null:p.isCorrect?potential:-p.stake;return <div className="revealed-pick" key={p.kind}><div><small>{p.kind==="gotw"?"Game of the Week":"Own pick"}</small><b>{p.fixture}</b><span>{p.outcome.toUpperCase()} · {p.stake} pts @ {p.odds.toFixed(2)}</span></div><strong className={result!==null&&result<0?"negative":""}>{result===null?`Potential +${potential}`:`${result>0?"+":""}${result}`}</strong></div>})}</article>)}</div>:<div className="card"><p className="subtle" style={{margin:0}}>No submissions were recorded for this week.</p></div>}
  </section>;
}
