"use client";
import { useEffect,useMemo,useRef,useState,useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2,Clock3,Hammer,LoaderCircle,LockKeyhole,MessageCircle,RefreshCw,ShieldQuestion,Swords } from "lucide-react";
import type { Fixture,Outcome } from "@/lib/demo-data";
import { AppShell } from "@/components/app-shell";
import { ClubCrest } from "@/components/club-crest";
import { WeeklyConversations } from "@/components/weekly-conversations";
import { createChallenge,saveWeeklyComment,saveWeeklyPicks } from "@/app/picks/actions";
import type { WeeklyConversation } from "@/lib/weekly-conversations";

type ExistingPick={fixture_id:string;kind:"gotw"|"own"|"special";selected_outcome:Outcome;stake:number};
export type PicksPageData={
  week:{id:string;number:number;label:string;lockAt:string;lockLabel:string;competition:string;featuredLabel:string;featuredShortLabel:string;oddsLabel?:string};bankroll:number;rank:number;fixtures:Fixture[];
  existing:{gotw?:ExistingPick;own?:ExistingPick;specials:ExistingPick[];source?:string;commentary?:string};opponents:{id:string;display_name:string}[];challengeTokens:number;locked:boolean;
  personalChallenges:{id:string;direction:"incoming"|"outgoing";otherId:string;otherName:string;otherCrestUrl:string|null}[];
  currentUserId:string;conversations:WeeklyConversation[];
  standings:{
    first:{id:string;name:string;crestUrl:string|null;score:number;featuredStreak:number;me:boolean}[];
    second:{id:string;name:string;crestUrl:string|null;score:number;featuredStreak:number;me:boolean}[];
    overall:{id:string;name:string;crestUrl:string|null;score:number;featuredStreak:number;me:boolean}[];
    projected:{id:string;name:string;crestUrl:string|null;score:number;featuredStreak:number;me:boolean;seasonProjection:number}[];
  };
  leaguePicks:{userId:string;name:string;crestUrl:string|null;source:"manual"|"auto";picks:{fixtureId:string;fixture:string;kind:"gotw"|"own"|"special";outcome:Outcome;stake:number;odds:number;isCorrect:boolean|null}[]}[];
  weekChallenges:{id:string;challengerId:string;opponentId:string;challenger:string;challengerCrestUrl:string|null;opponent:string;opponentCrestUrl:string|null;challengerNet:number|null;opponentNet:number|null}[];
  previousWeek?:{label:string;winner:{id:string;name:string;crestUrl:string|null;score:number};loser:{id:string;name:string;crestUrl:string|null;score:number}};
};

function FixtureCard({fixture,selection,onSelect,stake,setStake,label,disabled,fixedStake=false,allowedOutcomes=["home","draw","away"]}:{fixture:Fixture;selection?:Outcome;onSelect:(o:Outcome)=>void;stake:number;setStake?:(n:number)=>void;label?:string;disabled?:boolean;fixedStake?:boolean;allowedOutcomes?:Outcome[]}) {
  return <article className="card"><div className="fixture-head"><div><div className="teams">{fixture.home} <span className="subtle">vs</span> {fixture.away}</div><div className="kickoff">{fixture.kickoff}</div></div>{label&&<span className="pill">{label}</span>}</div>
    <div className="odds">{allowedOutcomes.map(o=><button disabled={disabled} type="button" key={o} onClick={()=>onSelect(o)} className={`odd ${selection===o?"selected":""}`} aria-pressed={selection===o}><small>{o==="home"?fixture.home:o==="away"?fixture.away:"Draw"}</small>{fixture.odds[o].toFixed(2)}</button>)}</div>
    {selection&&<div className={`stake-wrap ${fixedStake?"fixed-stake":""}`}><div><b>{fixedStake?"Bonus stake":"Stake"}</b><div className="kickoff">{fixedStake?"Fixed—no adjusting":"Adjust your split"}</div></div>{fixedStake?<span className="pill">{stake} points</span>:<div className="stepper"><button disabled={disabled} type="button" onClick={()=>setStake?.(Math.max(1,stake-1))} aria-label="Reduce stake">−</button><span>{stake}</span><button disabled={disabled} type="button" onClick={()=>setStake?.(Math.min(9,stake+1))} aria-label="Increase stake">+</button></div>}</div>}
  </article>;
}

function DockersDerbyIdentity(){
  return <div className="dockers-derby" aria-label="Millwall versus West Ham United: the Dockers Derby">
    <div className="derby-clubs">
      <div className="derby-club millwall">
        <span className="derby-badge" aria-hidden="true">🦁</span>
        <span><b>Millwall</b><small>The Lions</small></span>
      </div>
      <span className="derby-vs">VS</span>
      <div className="derby-club west-ham">
        <span className="derby-badge derby-hammers" aria-hidden="true"><Hammer/><Hammer/></span>
        <span><b>West Ham</b><small>The Hammers</small></span>
      </div>
    </div>
    <p><b>Dockside grudge, back on the clock.</b> Two longshoremen clubs, rival yards and the old 1926 “scabs” tale—working-waterfront folklore with a century-long hangover.</p>
  </div>;
}

function isElClasico(fixture?:Fixture){
  return Boolean(fixture&&fixture.home==="Barcelona"&&fixture.away==="Real Madrid");
}

function isMarathonSpecial(fixture?:Fixture){
  return Boolean(fixture&&fixture.home==="Under 3:55"&&fixture.away==="Over 3:55");
}

function isBatesColby(fixture?:Fixture){
  return Boolean(fixture&&fixture.home==="Colby"&&fixture.away==="Bates");
}

function specialStakeFor(fixture?:Fixture){
  return isMarathonSpecial(fixture)?10:5;
}

function hasFixtureLocked(fixture:Fixture){
  return Boolean(fixture.kickoffAt&&Date.now()>=Date.parse(fixture.kickoffAt));
}

export function PicksFlow({data}:{data:PicksPageData|null}){
  if(!data)return <AppShell><main className="content"><div className="page-head"><div><p className="eyebrow">No active week</p><h1>Boots off for now.</h1><p className="subtle">The next Competition Week will appear here when an admin opens it.</p></div></div></main></AppShell>;
  return <LivePicks data={data}/>;
}

function LivePicks({data}:{data:PicksPageData}){
  const router=useRouter();
  const gotw=data.fixtures.find(f=>f.gotw)!;const specials=useMemo(()=>data.fixtures.filter(f=>f.special),[data.fixtures]);const others=useMemo(()=>data.fixtures.filter(f=>!f.gotw&&!f.special),[data.fixtures]);
  const [gotwPick,setGotwPick]=useState<Outcome|undefined>(data.existing.gotw?.selected_outcome);
  const [otherId,setOtherId]=useState(data.existing.own?.fixture_id??others[0]?.id);
  const [otherPick,setOtherPick]=useState<Outcome|undefined>(data.existing.own?.selected_outcome);
  const [specialPicks,setSpecialPicks]=useState<Record<string,Outcome|undefined>>(()=>Object.fromEntries(data.existing.specials.map(p=>[p.fixture_id,p.selected_outcome])));
  const [gotwStake,setGotwStake]=useState(Number(data.existing.gotw?.stake??5));const [otherStake,setOtherStake]=useState(Number(data.existing.own?.stake??5));
  const [message,setMessage]=useState("");
  const [saveStatus,setSaveStatus]=useState<"idle"|"waiting"|"saving"|"saved"|"error">(data.existing.source?"saved":"idle");
  const [saveError,setSaveError]=useState("");
  const [retryNonce,setRetryNonce]=useState(0);
  const [opponent,setOpponent]=useState(data.opponents[0]?.id??"");const [pending,startTransition]=useTransition();
  const [comment,setComment]=useState(data.existing.commentary??"");const [commentMessage,setCommentMessage]=useState("");const [commentPending,startCommentTransition]=useTransition();
  const other=others.find(f=>f.id===otherId);const total=gotwStake+otherStake;
  const specialComplete=specials.every(special=>hasFixtureLocked(special)||Boolean(specialPicks[special.id]));
  const specialSignature=specials.map(special=>`${special.id}:${specialPicks[special.id]??""}:${specialStakeFor(special)}`).join("|");
  const signature=gotwPick&&otherPick&&other&&total===10&&specialComplete
    ?`${gotw.id}:${gotwPick}:${gotwStake}|${other.id}:${otherPick}:${otherStake}${specialSignature?`|${specialSignature}`:""}`
    :"";
  const initialSpecialSignature=specials.map(special=>{const pick=data.existing.specials.find(item=>item.fixture_id===special.id);return pick?`${special.id}:${pick.selected_outcome}:${Number(pick.stake)}`:""}).filter(Boolean).join("|");
  const initialSignature=data.existing.gotw&&data.existing.own&&data.existing.specials.length===specials.length
    ?`${gotw.id}:${data.existing.gotw.selected_outcome}:${Number(data.existing.gotw.stake)}|${data.existing.own.fixture_id}:${data.existing.own.selected_outcome}:${Number(data.existing.own.stake)}${initialSpecialSignature?`|${initialSpecialSignature}`:""}`
    :"";
  const lastSaved=useRef(initialSignature);
  const adjustGotw=(n:number)=>{setMessage("");setGotwStake(n);setOtherStake(10-n)};const adjustOther=(n:number)=>{setMessage("");setOtherStake(n);setGotwStake(10-n)};
  const challenge=()=>startTransition(async()=>{if(!opponent)return;const result=await createChallenge({weekId:data.week.id,opponentId:opponent});setMessage(result.error??"Challenge sent. No acceptance needed.");if(!result.error)router.refresh()});
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
        specialPicks:specials.filter(special=>Boolean(specialPicks[special.id])).map(special=>({fixtureId:special.id,outcome:specialPicks[special.id]!})),
      }).then(result=>{
        if(result.error){setSaveStatus("error");setSaveError(result.error);return}
        lastSaved.current=signature;setSaveStatus("saved");setSaveError("");
      });
    },650);
    return ()=>window.clearTimeout(timer);
  },[data.locked,data.week.id,gotw.id,gotwPick,gotwStake,other,otherPick,otherStake,specials,specialPicks,retryNonce,signature]);
  useEffect(()=>{
    if(!data.opponents.some(player=>player.id===opponent))setOpponent(data.opponents[0]?.id??"");
  },[data.opponents,opponent]);
  return <AppShell><main className="content content-wide picks-page">
    <div className="picks-topline"><div><span>{data.week.competition} · Week {data.week.number}</span><b>{data.week.label}</b></div><span className={`pill ${data.locked?"":"live"}`}><Clock3 size={13}/>{data.locked?"Locked":`Locks ${data.week.lockLabel}`}</span></div>
    {data.previousWeek&&<WeeklyRecap recap={data.previousWeek}/>}
    {data.locked&&<ThisWeekStandings entries={data.leaguePicks} challenges={data.weekChallenges} week={data.week} currentUserId={data.currentUserId}/>}
    <div className="picks-layout"><div>
      {data.locked?<LockedPickReceipt gotw={gotw} gotwPick={gotwPick} gotwStake={gotwStake} other={other} otherPick={otherPick} otherStake={otherStake} specials={specials} specialPicks={specialPicks} source={data.existing.source} featuredLabel={data.week.featuredLabel}/>:<><div className="pick-choice-grid">
        <section className="pick-choice">
          <div className="section-label"><div><p className="eyebrow">Required</p><h2>{data.week.featuredLabel}</h2></div><ShieldQuestion size={21}/></div>
          <div className="card fixture-select fixed-fixture-select"><div><span>{data.week.featuredLabel}</span><b>{gotw.home} vs {gotw.away}</b></div><span className="pill">Fixed</span></div>
          <FixtureCard fixture={gotw} selection={gotwPick} onSelect={o=>{setMessage("");setGotwPick(o)}} stake={gotwStake} setStake={adjustGotw} label={data.week.featuredShortLabel} disabled={data.locked}/>
        </section>
        <section className="pick-choice">
          <div className="section-label"><div><p className="eyebrow">Your choice</p><h2>One other match</h2></div></div>
          <div className="card fixture-select"><label className="field" style={{margin:0}}>Other match · You choose<select disabled={data.locked} value={otherId} onChange={e=>{setOtherId(e.target.value);setOtherPick(undefined);setMessage("")}}>{others.map(f=><option value={f.id} key={f.id}>{f.home} vs {f.away}</option>)}</select></label></div>
          {other&&<FixtureCard fixture={other} selection={otherPick} onSelect={o=>{setMessage("");setOtherPick(o)}} stake={otherStake} setStake={adjustOther} disabled={data.locked}/>}
        </section>
      </div>
      {specials.map(special=>{const specialStake=specialStakeFor(special);const fixtureLocked=data.locked||hasFixtureLocked(special);return <section className="manager-special" key={special.id}><div className="section-label"><div><p className="eyebrow">{isMarathonSpecial(special)?"Ten points from the bank":"Five points from the bank"}</p><h2>{isMarathonSpecial(special)?"Marathon over/under":isElClasico(special)?"El Clásico bonus bet":isBatesColby(special)?"Maine rivalry bonus bet":"Manager’s Special of the Week"}</h2><p className="subtle">{isMarathonSpecial(special)?"Under 3:55 or Over 3:55. This fixed 10-point bonus is separate from your normal 10; exactly 3:55 is a push.":isElClasico(special)?"Barcelona vs Real Madrid. Pick the result; this mandatory 5-point stake is separate from your normal 10.":isBatesColby(special)?"Bates visits Colby on Tuesday. Pick the 90-minute result; this fixed 5-point bet locks at kickoff.":"Pick the result; the stake is fixed at 5."}</p></div><span className="pill">{fixtureLocked?"Locked":`${specialStake} bonus pts`}</span></div>{!isElClasico(special)&&!isMarathonSpecial(special)&&!isBatesColby(special)&&<DockersDerbyIdentity/>}<FixtureCard fixture={special} selection={specialPicks[special.id]} onSelect={o=>{setMessage("");setSpecialPicks(current=>({...current,[special.id]:o}))}} stake={specialStake} label={isMarathonSpecial(special)?"MARATHON":isElClasico(special)?"EL CLÁSICO":isBatesColby(special)?"BATES–COLBY":"SPECIAL"} disabled={fixtureLocked} fixedStake allowedOutcomes={isMarathonSpecial(special)?["home","away"]:undefined}/></section>})}
      {message&&<div className={message.toLowerCase().includes("error")?"notice":"saved"}><CheckCircle2 size={20}/>{message}</div>}
      <div className={`autosave-bar ${saveStatus}`}>
        {!signature?<><Clock3 size={18}/><div><b>Finish your card</b><span>It will save automatically as soon as every required outcome is selected.</span></div></>
        :saveStatus==="error"?<><RefreshCw size={18}/><div><b>Couldn&apos;t save</b><span>{saveError}</span></div><button type="button" onClick={()=>setRetryNonce(value=>value+1)}>Retry</button></>
        :saveStatus==="saving"||saveStatus==="waiting"?<><LoaderCircle className="spin" size={18}/><div><b>{saveStatus==="waiting"?"Changes queued":"Saving changes"}</b><span>You can keep editing.</span></div></>
        :<><CheckCircle2 size={18}/><div><b>All changes saved</b><span>No Save button needed.</span></div></>}
      </div></>}
      {!data.locked&&<section className="card weekly-comment-editor"><div className="weekly-comment-head"><div><p className="eyebrow"><MessageCircle size={14}/> Optional</p><h2>Explain your picks—or talk some shit</h2></div><span className="pill"><LockKeyhole size={13}/> Hidden until lock</span></div><textarea value={comment} onChange={event=>{setComment(event.target.value);setCommentMessage("")}} maxLength={180} rows={3} placeholder="180 characters. Confidence encouraged; evidence optional."/><div className="comment-editor-foot"><span className="character-count">{comment.length}/180</span><button type="button" className="secondary" onClick={saveComment} disabled={commentPending||saveStatus!=="saved"}>{commentPending?"Saving…":"Save statement"}</button></div>{saveStatus!=="saved"&&<p className="microcopy">Finish your two picks first, then add your statement.</p>}{commentMessage&&<p className={commentMessage.toLowerCase().includes("saved")||commentMessage.toLowerCase().includes("removed")?"form-success":"form-error"}>{commentMessage}</p>}</section>}
      {!data.locked&&<section className="weekly-challenge"><div className="section-label"><div><p className="eyebrow">Head to head</p><h2>Challenge a mate</h2></div><span className="pill">{data.challengeTokens} left</span></div>
        {data.personalChallenges.length>0&&<div className="personal-challenge-list">{data.personalChallenges.map(item=><Link className={`personal-challenge-card ${item.direction}`} href={`/players/${item.otherId}`} key={item.id}><ClubCrest seed={item.otherId} label={item.otherName} imageUrl={item.otherCrestUrl} size="md"/><div><span>{item.direction==="incoming"?"You’ve been challenged":"Challenge sent"}</span><b>{item.direction==="incoming"?`${item.otherName} wants your 10 points`:`You’re facing ${item.otherName}`}</b><small>Your full weekly card decides it. No acceptance needed.</small></div><Swords size={22}/></Link>)}</div>}
        <div className="card"><p><b>Put 10 points head-to-head.</b></p><p className="subtle challenge-copy">Choose an opponent before lock. No acceptance is needed. Your full weekly cards are compared; the higher weekly return wins a 10-point transfer. A tie transfers nothing, but the challenge is used.</p>{data.opponents.length?<><label className="field">Opponent<select value={opponent} onChange={e=>setOpponent(e.target.value)}>{data.opponents.map(p=><option key={p.id} value={p.id}>{p.display_name}</option>)}</select></label><button className="secondary" disabled={pending} onClick={challenge}>Issue challenge</button></>:<p className="subtle">You have challenged every available opponent once, or no other players have joined yet.</p>}</div>
      </section>}
      {data.locked&&<section className="locked-conversations"><div className="section-label"><div><p className="eyebrow">Embargo lifted</p><h2>Pre-match statements</h2><p className="subtle">React or reply now that everyone&apos;s picks are locked.</p></div></div><WeeklyConversations threads={data.conversations} currentUserId={data.currentUserId} compact/></section>}
      {data.locked&&<LockedLeaguePicks entries={data.leaguePicks} fixtures={data.fixtures} challenges={data.weekChallenges}/>}
    </div><aside className="picks-sidebar">
      <StandingsSnapshot rows={data.standings}/>
    </aside></div>
  </main></AppShell>;
}

const formatWeeklyPoints=(value:number)=>Number.isInteger(value)?String(value):value.toFixed(2).replace(/0+$/,"").replace(/\.$/,"");

function ThisWeekStandings({entries,challenges,week,currentUserId}:{entries:PicksPageData["leaguePicks"];challenges:PicksPageData["weekChallenges"];week:PicksPageData["week"];currentUserId:string}){
  const challengePoints=new Map<string,number>();
  for(const challenge of challenges){
    if(challenge.challengerNet===null||challenge.opponentNet===null)continue;
    const challengerResult=challenge.challengerNet===challenge.opponentNet?0:challenge.challengerNet>challenge.opponentNet?10:-10;
    challengePoints.set(challenge.challengerId,(challengePoints.get(challenge.challengerId)??0)+challengerResult);
    challengePoints.set(challenge.opponentId,(challengePoints.get(challenge.opponentId)??0)-challengerResult);
  }
  const rows=entries.map(entry=>({
    ...entry,
    score:entry.picks.reduce((sum,pick)=>sum+(pick.isCorrect===true?pick.stake*pick.odds:0),0),
    challengeScore:challengePoints.get(entry.userId)??0,
    gamesLeft:entry.picks.filter(pick=>pick.isCorrect===null).length,
  })).sort((a,b)=>b.score-a.score||a.gamesLeft-b.gamesLeft||a.name.localeCompare(b.name));
  return <section className="card this-week-standings home-week-standings"><header><div><p className="eyebrow">Week {week.number} · Live</p><h2>This week</h2><p>{week.label}. Pick returns and settled head-to-head transfers are shown separately.</p></div><span className="live-dot">Live</span></header><div className="this-week-table"><div className="this-week-columns" aria-hidden="true"><span>Pick returns</span><span>H2H</span></div>{rows.map((player,index)=><div className={`standing-row ${player.userId===currentUserId?"me":""}`} key={player.userId}><span className="rank">{index+1}</span><Link className="player player-link" href={`/players/${player.userId}`}><ClubCrest seed={player.userId} label={player.name} imageUrl={player.crestUrl} size="sm"/><span>{player.name}{player.userId===currentUserId&&<small className="you-label">You</small>}</span></Link><span className={`games-left ${player.gamesLeft>0?"pending":"complete"}`}>{player.gamesLeft>0?`${player.gamesLeft} ${player.gamesLeft===1?"game":"games"} left`:"All finished"}</span><span className="week-points">{formatWeeklyPoints(player.score)}</span><span className={`week-challenge-points ${player.challengeScore>0?"positive":player.challengeScore<0?"negative":""}`}>{player.challengeScore>0?"+":""}{formatWeeklyPoints(player.challengeScore)}</span></div>)}</div></section>;
}

function LockedPickReceipt({gotw,gotwPick,gotwStake,other,otherPick,otherStake,specials,specialPicks,source,featuredLabel}:{
  gotw:Fixture;gotwPick?:Outcome;gotwStake:number;other?:Fixture;otherPick?:Outcome;otherStake:number;specials:Fixture[];specialPicks:Record<string,Outcome|undefined>;source?:string;featuredLabel:string;
}){
  const picks=[
    gotwPick?{fixture:gotw,outcome:gotwPick,stake:gotwStake,label:featuredLabel}:null,
    other&&otherPick?{fixture:other,outcome:otherPick,stake:otherStake,label:"Your other match"}:null,
    ...specials.map(special=>specialPicks[special.id]?{fixture:special,outcome:specialPicks[special.id]!,stake:specialStakeFor(special),label:isMarathonSpecial(special)?"Marathon over/under":isElClasico(special)?"El Clásico bonus":isBatesColby(special)?"Bates–Colby bonus":"Manager's Special"}:null),
  ].filter((pick):pick is {fixture:Fixture;outcome:Outcome;stake:number;label:string}=>Boolean(pick));
  return <section className="locked-pick-receipt">
    <div className="locked-receipt-head"><div><p className="eyebrow">Your final card</p><h2>Your locked picks</h2><p>No controls, no ambiguity—this is what you&apos;re backing.</p></div><span><LockKeyhole size={14}/> Locked</span></div>
    {picks.length?<div className="locked-receipt-grid">{picks.map(pick=>{
      const selection=pick.outcome==="home"?pick.fixture.home:pick.outcome==="away"?pick.fixture.away:"Draw";
      const odds=pick.fixture.odds[pick.outcome];
      const potential=Math.round(pick.stake*odds*100)/100;
      return <article className="card locked-receipt-pick" key={pick.label}>
        <div className="locked-receipt-meta"><span>{pick.label}</span>{source==="auto"&&<i>Auto-picked</i>}</div>
        <div className="locked-receipt-fixture"><span>{pick.fixture.home}</span><small>vs</small><span>{pick.fixture.away}</span></div>
        <div className="locked-receipt-selection"><div><small>Your pick</small><strong>{selection}</strong></div><div><small>Stake</small><strong>{pick.stake} pts</strong></div><div><small>Locked odds</small><strong>{odds.toFixed(2)}</strong></div><div><small>Potential return</small><strong className="positive">+{potential.toFixed(2)}</strong></div></div>
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
    <div className="card table compact-table">{sorted.map((row,index)=><div className={`standing-row ${row.me?"me":""}`} key={row.id}><span className="rank">{index+1}</span><Link className="player player-link" href={`/players/${row.id}`}><ClubCrest seed={row.id} label={row.name} imageUrl={row.crestUrl} size="sm"/><span>{row.name}{row.featuredStreak>=2&&<i className="streak-alert" title={row.featuredStreak>=3?`${row.featuredStreak} straight — another win earns +10`:"Two straight — the next featured-game win earns +10"} aria-label="Featured-game streak bonus on the line">🔥</i>}{row.me&&<small className="you-label">You</small>}</span></Link><span className="points">{row.score}</span></div>)}</div>
  </section>;
}

function WeeklyRecap({recap}:{recap:NonNullable<PicksPageData["previousWeek"]>}){
  return <section className="weekly-recap">
    <div className="recap-intro"><span>Glory &amp; grief</span><b>{recap.label}</b></div>
    <Link className="recap-player winner" href={`/players/${recap.winner.id}`}><ClubCrest seed={recap.winner.id} label={recap.winner.name} imageUrl={recap.winner.crestUrl}/><div><small>Last week&apos;s winner</small><b>{recap.winner.name}</b></div><strong>{recap.winner.score}</strong></Link>
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
      const final=status==="finished"||status==="final";
      const live=status==="live"||status==="in_play"||status==="paused";
      return <article className="card watch-fixture" key={fixture.id}>
        <div className="fixture-head"><div><div className="teams">{fixture.home} <span className="subtle">vs</span> {fixture.away}</div><div className="kickoff">{fixture.kickoff}</div></div><span className={`match-state ${final?"final":live?"live":"scheduled"}`}>{fixture.homeScore!==null&&fixture.homeScore!==undefined?`${fixture.homeScore}–${fixture.awayScore}`:final?"Final":live?"Live":"Upcoming"}</span></div>
        <div className="outcome-lanes">{(["home","draw","away"] as Outcome[]).map(outcome=>{
          const backers=picks.filter(pick=>pick.outcome===outcome);
          const label=outcome==="home"?fixture.home:outcome==="away"?fixture.away:"Draw";
          return <div className="outcome-lane" key={outcome}><div className="outcome-lane-head"><b>{label}</b><span>{backers.length}</span></div>{backers.length?backers.map(pick=>{const potential=Math.round(pick.stake*pick.odds*100)/100;const result=pick.isCorrect===null?null:pick.isCorrect?potential:0;const kindLabel=pick.kind==="gotw"?"GOTW":pick.kind==="special"?"Bonus bet":"Own";return <div className="watch-pick" key={`${pick.userId}-${pick.kind}`}><Link href={`/players/${pick.userId}`}><ClubCrest seed={pick.userId} label={pick.name} imageUrl={pick.crestUrl} size="sm"/></Link><div><Link className="player-name-link" href={`/players/${pick.userId}`}>{pick.name}</Link><small>{pick.stake} pts · {kindLabel}{pick.source==="auto"?" · Auto":""}</small></div><strong>{result===null?`+${potential}`:`${result>0?"+":""}${result}`}</strong></div>}):<p className="no-backs">No backers</p>}</div>
        })}</div>
      </article>;
    })}</div>:<div className="card"><p className="subtle" style={{margin:0}}>No submissions were recorded for this week.</p></div>}
  </section>;
}
