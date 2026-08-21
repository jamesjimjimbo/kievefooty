"use client";
import { useEffect,useRef,useState,useTransition } from "react";
import Link from "next/link";
import { CheckCircle2,Clock3,LoaderCircle,LockKeyhole,MessageCircle,RefreshCw,ShieldQuestion,Swords } from "lucide-react";
import type { Fixture,Outcome } from "@/lib/demo-data";
import { AppShell } from "@/components/app-shell";
import { ClubCrest } from "@/components/club-crest";
import { WeeklyConversations } from "@/components/weekly-conversations";
import { createChallenge,saveWeeklyComment,saveWeeklyPicks } from "@/app/picks/actions";
import type { WeeklyConversation } from "@/lib/weekly-conversations";

type ExistingPick={fixture_id:string;kind:"gotw"|"own";selected_outcome:Outcome;stake:number};
export type PicksPageData={
  week:{id:string;number:number;label:string;lockAt:string;lockLabel:string;competition:string;oddsLabel?:string};bankroll:number;rank:number;fixtures:Fixture[];
  existing:{gotw?:ExistingPick;own?:ExistingPick;source?:string;commentary?:string};opponents:{id:string;display_name:string}[];challengeTokens:number;locked:boolean;
  currentUserId:string;conversations:WeeklyConversation[];
  standings:{
    first:{id:string;name:string;crestUrl:string|null;score:number;me:boolean}[];
    second:{id:string;name:string;crestUrl:string|null;score:number;me:boolean}[];
    overall:{id:string;name:string;crestUrl:string|null;score:number;me:boolean}[];
    projected:{id:string;name:string;crestUrl:string|null;score:number;me:boolean;seasonProjection:number}[];
  };
  leaguePicks:{userId:string;name:string;crestUrl:string|null;source:"manual"|"auto";picks:{fixtureId:string;fixture:string;kind:"gotw"|"own";outcome:Outcome;stake:number;odds:number;isCorrect:boolean|null}[]}[];
  weekChallenges:{id:string;challenger:string;opponent:string;challengerNet:number|null;opponentNet:number|null}[];
  previousWeek?:{label:string;winner:{id:string;name:string;crestUrl:string|null;score:number};loser:{id:string;name:string;crestUrl:string|null;score:number}};
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
  const [message,setMessage]=useState("");
  const [saveStatus,setSaveStatus]=useState<"idle"|"waiting"|"saving"|"saved"|"error">(data.existing.source?"saved":"idle");
  const [saveError,setSaveError]=useState("");
  const [retryNonce,setRetryNonce]=useState(0);
  const [opponent,setOpponent]=useState(data.opponents[0]?.id??"");const [pending,startTransition]=useTransition();
  const [comment,setComment]=useState(data.existing.commentary??"");const [commentMessage,setCommentMessage]=useState("");const [commentPending,startCommentTransition]=useTransition();
  const other=others.find(f=>f.id===otherId);const total=gotwStake+otherStake;
  const signature=gotwPick&&otherPick&&other&&total===10
    ?`${gotw.id}:${gotwPick}:${gotwStake}|${other.id}:${otherPick}:${otherStake}`
    :"";
  const initialSignature=data.existing.gotw&&data.existing.own
    ?`${gotw.id}:${data.existing.gotw.selected_outcome}:${Number(data.existing.gotw.stake)}|${data.existing.own.fixture_id}:${data.existing.own.selected_outcome}:${Number(data.existing.own.stake)}`
    :"";
  const lastSaved=useRef(initialSignature);
  const adjustGotw=(n:number)=>{setMessage("");setGotwStake(n);setOtherStake(10-n)};const adjustOther=(n:number)=>{setMessage("");setOtherStake(n);setGotwStake(10-n)};
  const challenge=()=>startTransition(async()=>{if(!opponent)return;const result=await createChallenge({weekId:data.week.id,opponentId:opponent});setMessage(result.error??"Challenge sent. No acceptance needed.")});
  const saveComment=()=>startCommentTransition(async()=>{setCommentMessage("");const result=await saveWeeklyComment({weekId:data.week.id,comment});setCommentMessage(result.error??(comment.trim()?"Statement saved. It stays hidden until lock.":"Statement removed."))});
  useEffect(()=>{
    if(data.locked||!signature||signature===lastSaved.current)return;
    setSaveStatus("waiting");setSaveError("");
    const timer=window.setTimeout(()=>{
      if(!gotwPick||!otherPick||!other)return;
      setSaveStatus("saving");
      void saveWeeklyPicks({
        weekId:data.week.id,gotwFixtureId:gotw.id,gotwOutcome:gotwPick,gotwStake,
        ownFixtureId:other.id,ownOutcome:otherPick,ownStake:otherStake,
      }).then(result=>{
        if(result.error){setSaveStatus("error");setSaveError(result.error);return}
        lastSaved.current=signature;setSaveStatus("saved");setSaveError("");
      });
    },650);
    return ()=>window.clearTimeout(timer);
  },[data.locked,data.week.id,gotw.id,gotwPick,gotwStake,other,otherPick,otherStake,retryNonce,signature]);
  return <AppShell><main className="content content-wide picks-page">
    <div className="picks-topline"><div><span>{data.week.competition} · Week {data.week.number}</span><b>{data.week.label}</b></div><span className={`pill ${data.locked?"":"live"}`}><Clock3 size={13}/>{data.locked?"Locked":"Open"}</span></div>
    {data.previousWeek&&<WeeklyRecap recap={data.previousWeek}/>}
    <div className="picks-layout"><div>
      {!data.locked&&<section className="card hero-card compact-hero"><div><p className="eyebrow">Weekly deadline</p><h2>Lock in by {data.week.lockLabel}</h2><p>The first eligible kickoff locks both picks.{data.week.oddsLabel&&<span className="odds-as-of"> Odds captured {data.week.oddsLabel}; your saved price is locked with your pick.</span>}</p></div><div className="stat-row"><div className="stat"><span className="stat-label">Bankroll</span><span className="stat-value">{data.bankroll}</span></div><div className="stat"><span className="stat-label">Your rank</span><span className="stat-value">#{data.rank}</span></div></div></section>}
      {data.locked?<LockedPickReceipt gotw={gotw} gotwPick={gotwPick} gotwStake={gotwStake} other={other} otherPick={otherPick} otherStake={otherStake} source={data.existing.source}/>:<><div className="pick-choice-grid">
        <section className="pick-choice">
          <div className="section-label"><div><p className="eyebrow">Required</p><h2>Game of the Week</h2></div><ShieldQuestion size={21}/></div>
          <div className="card fixture-select fixed-fixture-select"><div><span>Game of the Week</span><b>{gotw.home} vs {gotw.away}</b></div><span className="pill">Fixed</span></div>
          <FixtureCard fixture={gotw} selection={gotwPick} onSelect={o=>{setMessage("");setGotwPick(o)}} stake={gotwStake} setStake={adjustGotw} label="GOTW" disabled={data.locked}/>
        </section>
        <section className="pick-choice">
          <div className="section-label"><div><p className="eyebrow">Your choice</p><h2>One other match</h2></div></div>
          <div className="card fixture-select"><label className="field" style={{margin:0}}>Other match · You choose<select disabled={data.locked} value={otherId} onChange={e=>{setOtherId(e.target.value);setOtherPick(undefined);setMessage("")}}>{others.map(f=><option value={f.id} key={f.id}>{f.home} vs {f.away}</option>)}</select></label></div>
          {other&&<FixtureCard fixture={other} selection={otherPick} onSelect={o=>{setMessage("");setOtherPick(o)}} stake={otherStake} setStake={adjustOther} disabled={data.locked}/>}
        </section>
      </div>
      {message&&<div className={message.toLowerCase().includes("error")?"notice":"saved"}><CheckCircle2 size={20}/>{message}</div>}
      <div className={`autosave-bar ${saveStatus}`}>
        {!signature?<><Clock3 size={18}/><div><b>Finish both picks</b><span>They&apos;ll save automatically as soon as both outcomes are selected.</span></div></>
        :saveStatus==="error"?<><RefreshCw size={18}/><div><b>Couldn&apos;t save</b><span>{saveError}</span></div><button type="button" onClick={()=>setRetryNonce(value=>value+1)}>Retry</button></>
        :saveStatus==="saving"||saveStatus==="waiting"?<><LoaderCircle className="spin" size={18}/><div><b>{saveStatus==="waiting"?"Changes queued":"Saving changes"}</b><span>You can keep editing.</span></div></>
        :<><CheckCircle2 size={18}/><div><b>All changes saved</b><span>No Save button needed.</span></div></>}
      </div></>}
      {!data.locked&&<section className="card weekly-comment-editor"><div className="weekly-comment-head"><div><p className="eyebrow"><MessageCircle size={14}/> Optional</p><h2>Explain your picks—or talk some shit</h2></div><span className="pill"><LockKeyhole size={13}/> Hidden until lock</span></div><textarea value={comment} onChange={event=>{setComment(event.target.value);setCommentMessage("")}} maxLength={180} rows={3} placeholder="180 characters. Confidence encouraged; evidence optional."/><div className="comment-editor-foot"><span className="character-count">{comment.length}/180</span><button type="button" className="secondary" onClick={saveComment} disabled={commentPending||saveStatus!=="saved"}>{commentPending?"Saving…":"Save statement"}</button></div>{saveStatus!=="saved"&&<p className="microcopy">Finish your two picks first, then add your statement.</p>}{commentMessage&&<p className={commentMessage.toLowerCase().includes("saved")||commentMessage.toLowerCase().includes("removed")?"form-success":"form-error"}>{commentMessage}</p>}</section>}
      {data.locked&&<section className="locked-conversations"><div className="section-label"><div><p className="eyebrow">Embargo lifted</p><h2>Pre-match statements</h2><p className="subtle">React or reply now that everyone&apos;s picks are locked.</p></div></div><WeeklyConversations threads={data.conversations} currentUserId={data.currentUserId} compact/></section>}
      {data.locked&&<LockedLeaguePicks entries={data.leaguePicks} fixtures={data.fixtures} challenges={data.weekChallenges}/>}
    </div><aside className="picks-sidebar">
      <StandingsSnapshot rows={data.standings}/>
      <div className="section-label"><h2>Challenge a mate</h2><span className="pill">{data.challengeTokens} left</span></div>
      <div className="card"><p><b>Put 10 points head-to-head.</b></p><p className="subtle challenge-copy">Choose an opponent before lock. No acceptance is needed. Your two normal picks are compared; the higher weekly net wins a 10-point transfer. A tie transfers nothing, but the challenge is used.</p>{data.opponents.length?<><label className="field">Opponent<select value={opponent} onChange={e=>setOpponent(e.target.value)}>{data.opponents.map(p=><option key={p.id} value={p.id}>{p.display_name}</option>)}</select></label><button className="secondary" disabled={pending||data.locked} onClick={challenge}>Issue challenge</button></>:<p className="subtle">You have challenged every available opponent once, or no other players have joined yet.</p>}</div>
    </aside></div>
  </main></AppShell>;
}

function LockedPickReceipt({gotw,gotwPick,gotwStake,other,otherPick,otherStake,source}:{
  gotw:Fixture;gotwPick?:Outcome;gotwStake:number;other?:Fixture;otherPick?:Outcome;otherStake:number;source?:string;
}){
  const picks=[
    gotwPick?{fixture:gotw,outcome:gotwPick,stake:gotwStake,label:"Game of the Week"}:null,
    other&&otherPick?{fixture:other,outcome:otherPick,stake:otherStake,label:"Your other match"}:null,
  ].filter((pick):pick is {fixture:Fixture;outcome:Outcome;stake:number;label:string}=>Boolean(pick));
  return <section className="locked-pick-receipt">
    <div className="locked-receipt-head"><div><p className="eyebrow">Your final card</p><h2>Your locked picks</h2><p>No controls, no ambiguity—this is what you&apos;re backing.</p></div><span><LockKeyhole size={14}/> Locked</span></div>
    {picks.length?<div className="locked-receipt-grid">{picks.map(pick=>{
      const selection=pick.outcome==="home"?pick.fixture.home:pick.outcome==="away"?pick.fixture.away:"Draw";
      const odds=pick.fixture.odds[pick.outcome];
      const potential=Math.round((pick.stake*odds-pick.stake)*100)/100;
      return <article className="card locked-receipt-pick" key={pick.label}>
        <div className="locked-receipt-meta"><span>{pick.label}</span>{source==="auto"&&<i>Auto-picked</i>}</div>
        <div className="locked-receipt-fixture"><span>{pick.fixture.home}</span><small>vs</small><span>{pick.fixture.away}</span></div>
        <div className="locked-receipt-selection"><div><small>Your pick</small><strong>{selection}</strong></div><div><small>Stake</small><strong>{pick.stake} pts</strong></div><div><small>Locked odds</small><strong>{odds.toFixed(2)}</strong></div><div><small>Potential</small><strong className="positive">+{potential.toFixed(2)}</strong></div></div>
      </article>;
    })}</div>:<div className="card locked-receipt-empty">No weekly picks were recorded.</div>}
  </section>;
}

function StandingsSnapshot({rows}:{rows:PicksPageData["standings"]}){
  const [tab,setTab]=useState<"first"|"second"|"overall">("overall");
  const [project,setProject]=useState(false);
  const selected=tab==="overall"&&project?rows.projected:rows[tab];
  const sorted=[...selected].sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name));
  return <section className="home-standings"><div className="section-label"><div><p className="eyebrow">At a glance</p><h2>League table</h2></div><a className="text-link" href="/standings">Full table →</a></div>
    <div className="home-standing-controls"><div className="mini-segments" aria-label="Standings period">{([["first","First"],["second","Second"],["overall","Full"]] as const).map(([value,label])=><button type="button" key={value} onClick={()=>{setTab(value);if(value!=="overall")setProject(false)}} className={tab===value?"active":""}>{label}</button>)}</div>
    {tab==="overall"&&<label className="projection-toggle"><input type="checkbox" checked={project} onChange={event=>setProject(event.target.checked)}/><span/><b>Include season bets</b></label>}</div>
    {tab==="overall"&&project&&<p className="projection-note">Assumes today&apos;s league and market results are final.</p>}
    <div className="card table compact-table">{sorted.map((row,index)=><div className={`standing-row ${row.me?"me":""}`} key={row.id}><span className="rank">{index+1}</span><Link className="player player-link" href={`/players/${row.id}`}><ClubCrest seed={row.id} label={row.name} imageUrl={row.crestUrl} size="sm"/><span>{row.name}{row.me&&<small className="you-label">You</small>}</span></Link><span className="points">{row.score>0?"+":""}{row.score}</span></div>)}</div>
  </section>;
}

function WeeklyRecap({recap}:{recap:NonNullable<PicksPageData["previousWeek"]>}){
  return <section className="weekly-recap">
    <div className="recap-intro"><span>Glory &amp; grief</span><b>{recap.label}</b></div>
    <Link className="recap-player winner" href={`/players/${recap.winner.id}`}><ClubCrest seed={recap.winner.id} label={recap.winner.name} imageUrl={recap.winner.crestUrl}/><div><small>Last week&apos;s winner</small><b>{recap.winner.name}</b></div><strong>{recap.winner.score>0?"+":""}{recap.winner.score}</strong></Link>
    <div className="recap-divider"/>
    <Link className="recap-player loser" href={`/players/${recap.loser.id}`}><ClubCrest seed={recap.loser.id} label={recap.loser.name} imageUrl={recap.loser.crestUrl}/><div><small>Form guide enthusiast</small><b>{recap.loser.name}</b></div><span>The model remains confident.</span></Link>
  </section>;
}

function LockedLeaguePicks({entries,fixtures,challenges}:{entries:PicksPageData["leaguePicks"];fixtures:Fixture[];challenges:PicksPageData["weekChallenges"]}){
  return <section className="locked-picks">
    <div className="section-label"><div><p className="eyebrow">Deadline passed</p><h2>Weekend watchboard</h2><p className="subtle watchboard-intro">See every backer grouped by match, with live scores and settled returns when available.</p></div></div>
    {challenges.length>0&&<div className="challenge-strip">{challenges.map(challenge=><div className="challenge-matchup" key={challenge.id}><Swords size={17}/><b>{challenge.challenger}</b><span>{challenge.challengerNet===null?"—":challenge.challengerNet}</span><small>vs</small><span>{challenge.opponentNet===null?"—":challenge.opponentNet}</span><b>{challenge.opponent}</b></div>)}</div>}
    {entries.length?<div className="watchboard-grid">{fixtures.map(fixture=>{
      const picks=entries.flatMap(entry=>entry.picks.filter(pick=>pick.fixtureId===fixture.id).map(pick=>({...pick,userId:entry.userId,name:entry.name,crestUrl:entry.crestUrl,source:entry.source})));
      if(!picks.length)return null;
      const status=fixture.status?.toLowerCase();
      const final=status==="finished";
      const live=status==="live"||status==="in_play"||status==="paused";
      return <article className="card watch-fixture" key={fixture.id}>
        <div className="fixture-head"><div><div className="teams">{fixture.home} <span className="subtle">vs</span> {fixture.away}</div><div className="kickoff">{fixture.kickoff}</div></div><span className={`match-state ${final?"final":live?"live":"scheduled"}`}>{fixture.homeScore!==null&&fixture.homeScore!==undefined?`${fixture.homeScore}–${fixture.awayScore}`:final?"Final":live?"Live":"Upcoming"}</span></div>
        <div className="outcome-lanes">{(["home","draw","away"] as Outcome[]).map(outcome=>{
          const backers=picks.filter(pick=>pick.outcome===outcome);
          const label=outcome==="home"?fixture.home:outcome==="away"?fixture.away:"Draw";
          return <div className="outcome-lane" key={outcome}><div className="outcome-lane-head"><b>{label}</b><span>{backers.length}</span></div>{backers.length?backers.map(pick=>{const potential=Math.round((pick.stake*pick.odds-pick.stake)*100)/100;const result=pick.isCorrect===null?null:pick.isCorrect?potential:-pick.stake;return <div className="watch-pick" key={`${pick.userId}-${pick.kind}`}><Link href={`/players/${pick.userId}`}><ClubCrest seed={pick.userId} label={pick.name} imageUrl={pick.crestUrl} size="sm"/></Link><div><Link className="player-name-link" href={`/players/${pick.userId}`}>{pick.name}</Link><small>{pick.stake} pts · {pick.kind==="gotw"?"GOTW":"Own"}{pick.source==="auto"?" · Auto":""}</small></div><strong className={result!==null&&result<0?"negative":""}>{result===null?`+${potential}`:`${result>0?"+":""}${result}`}</strong></div>}):<p className="no-backs">No backers</p>}</div>
        })}</div>
      </article>;
    })}</div>:<div className="card"><p className="subtle" style={{margin:0}}>No submissions were recorded for this week.</p></div>}
  </section>;
}
