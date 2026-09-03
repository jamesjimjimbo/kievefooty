"use client";
import {useState} from "react";
import Link from "next/link";
import {Swords} from "lucide-react";
import {AppShell} from "./app-shell";
import {ClubCrest} from "./club-crest";

export type StandingPlayer={
  id:string;name:string;crestUrl:string|null;initials:string;first:number;second:number;overall:number;
  projected:number;seasonProjection:number;accuracyCorrect:number;accuracyTotal:number;me:boolean;
};
export type StandingHistoryRow={
  week_number:number;week_label:string;week_end:string;user_id:string;display_name:string;
  first_score:number;second_score:number;full_score:number;accuracy_rate:number;
};
export type ChallengeHistory={
  id:string;weekNumber:number;weekLabel:string;challengerId:string;challenger:string;challengerCrestUrl:string|null;
  opponentId:string;opponent:string;opponentCrestUrl:string|null;challengerNet:number|null;opponentNet:number|null;settled:boolean;
};

export function StandingsBoard({players,history,challenges}:{players:StandingPlayer[];history:StandingHistoryRow[];challenges:ChallengeHistory[]}){
  return <AppShell><main className="content content-wide">
    <div className="page-head"><div><p className="eyebrow">2026 / 27</p><h1>Standings</h1><p className="subtle">Every competition, all in one place.</p></div></div>
    <section className="standings-grid">
      <ScoreCompetition title="First Half" prize="15%" description="Normal weekly results in the first half." players={players} scoreKey="first"/>
      <ScoreCompetition title="Second Half" prize="15%" description="Normal weekly results in the second half." players={players} scoreKey="second"/>
      <FullCompetition players={players}/>
      <AccuracyCompetition players={players}/>
    </section>
    <ChallengeLedger rows={challenges}/>
    <StandingsHistory rows={history}/>
    <p className="standings-footnote">Weekly 10-point credits never count here. Projected Full Competition scores are informational and do not alter official points.</p>
  </main></AppShell>;
}

function ChallengeLedger({rows}:{rows:ChallengeHistory[]}){
  if(!rows.length)return null;
  const weeks=Array.from(new Map(rows.map(row=>[row.weekNumber,{number:row.weekNumber,label:row.weekLabel}])).values()).sort((a,b)=>b.number-a.number);
  return <section className="card challenge-ledger"><header><div><p className="eyebrow">Head to head</p><h2>Weekly challenges</h2><p>Every locked matchup, visible to the whole league.</p></div><Swords size={22}/></header><div className="challenge-ledger-weeks">{weeks.map(week=><section key={week.number}><div className="challenge-week-label"><b>Week {week.number}</b><span>{week.label}</span></div>{rows.filter(row=>row.weekNumber===week.number).map(row=>{const decided=row.settled&&row.challengerNet!==null&&row.opponentNet!==null;const challengerWon=decided&&row.challengerNet!>row.opponentNet!;const opponentWon=decided&&row.opponentNet!>row.challengerNet!;return <div className="challenge-ledger-row" key={row.id}><Link className={challengerWon?"winner":""} href={`/players/${row.challengerId}`}><ClubCrest seed={row.challengerId} label={row.challenger} imageUrl={row.challengerCrestUrl} size="sm"/><b>{row.challenger}</b></Link><strong>{decided?row.challengerNet:"—"}</strong><small>vs</small><strong>{decided?row.opponentNet:"—"}</strong><Link className={opponentWon?"winner":""} href={`/players/${row.opponentId}`}><b>{row.opponent}</b><ClubCrest seed={row.opponentId} label={row.opponent} imageUrl={row.opponentCrestUrl} size="sm"/></Link>{!decided&&<span className="challenge-pending">Awaiting results</span>}</div>})}</section>)}</div></section>;
}

function CompetitionHeader({title,prize,description}:{title:string;prize:string;description:string}){
  return <header className="standing-card-head"><p className="eyebrow">{prize} of the pot</p><h2>{title}</h2><p>{description}</p></header>;
}

function PlayerCell({player}:{player:StandingPlayer}){
  return <Link className="player player-link" href={`/players/${player.id}`}><ClubCrest seed={player.id} label={player.name} imageUrl={player.crestUrl} size="sm"/><span>{player.name}{player.me&&<small className="you-label">You</small>}</span></Link>;
}

function ScoreCompetition({title,prize,description,players,scoreKey}:{title:string;prize:string;description:string;players:StandingPlayer[];scoreKey:"first"|"second"}){
  const sorted=[...players].sort((a,b)=>b[scoreKey]-a[scoreKey]||a.name.localeCompare(b.name));
  return <article className="card standings-card"><CompetitionHeader title={title} prize={prize} description={description}/><div className="table competition-table">{sorted.map((player,index)=><div className={`standing-row ${player.me?"me":""}`} key={player.id}><span className="rank">{index+1}</span><PlayerCell player={player}/><span className="points">{player[scoreKey]}</span></div>)}</div></article>;
}

function FullCompetition({players}:{players:StandingPlayer[]}){
  const sorted=[...players].sort((a,b)=>b.overall-a.overall||a.name.localeCompare(b.name));
  return <article className="card standings-card"><CompetitionHeader title="Full Competition" prize="60%" description="Official score beside the current-results forecast."/><div className="standing-column-labels"><span>Official</span><span>If held</span></div><div className="table competition-table">{sorted.map((player,index)=><div className={`standing-row full-standing-row ${player.me?"me":""}`} key={player.id}><span className="rank">{index+1}</span><PlayerCell player={player}/><span className="official-score">{player.overall}</span><span className="points projected-score">{player.projected}</span></div>)}</div></article>;
}

function AccuracyCompetition({players}:{players:StandingPlayer[]}){
  const accuracyRate=(player:StandingPlayer)=>player.accuracyTotal?player.accuracyCorrect/player.accuracyTotal:0;
  const sorted=[...players].sort((a,b)=>accuracyRate(b)-accuracyRate(a)||b.accuracyCorrect-a.accuracyCorrect||a.name.localeCompare(b.name));
  return <article className="card standings-card"><CompetitionHeader title="Most Accurate Picker" prize="10%" description="Highest correct-pick percentage, including FA Cup and both Casino periods."/><div className="table competition-table">{sorted.map((player,index)=>{const rate=accuracyRate(player);return <div className={`standing-row accuracy-row ${player.me?"me":""}`} key={player.id}><span className="rank">{index+1}</span><PlayerCell player={player}/><span className="accuracy-score"><b>{player.accuracyTotal?`${(rate*100).toFixed(1)}%`:"—"}</b><small>{player.accuracyCorrect} of {player.accuracyTotal}</small></span></div>})}</div></article>;
}

const historyColors=["#4f3bd8","#ff6678","#0f9eb7","#ff9a3c","#7c3ff0","#0a8f78","#c14d87","#53657d"];

function StandingsHistory({rows}:{rows:StandingHistoryRow[]}){
  const [view,setView]=useState<"full_score"|"first_score"|"second_score"|"accuracy_rate">("full_score");
  const [selectedPlayer,setSelectedPlayer]=useState<string|null>(null);
  const [hoveredPoint,setHoveredPoint]=useState<{playerId:string;weekNumber:number|null}|null>(null);
  const modes=[
    {key:"full_score" as const,label:"Full",title:"Full Competition",unit:"points"},
    {key:"first_score" as const,label:"First",title:"First Half",unit:"points"},
    {key:"second_score" as const,label:"Second",title:"Second Half",unit:"points"},
    {key:"accuracy_rate" as const,label:"Accuracy",title:"Most Accurate Picker",unit:"accuracy"},
  ];
  const mode=modes.find(item=>item.key===view)!;
  const weeks=Array.from(new Map(rows.map(row=>[row.week_number,{number:row.week_number,label:row.week_label,end:row.week_end}])).values()).sort((a,b)=>a.number-b.number);
  const players=Array.from(new Map(rows.map(row=>[row.user_id,{id:row.user_id,name:row.display_name}])).values()).sort((a,b)=>a.name.localeCompare(b.name));
  const scoreMap=new Map(rows.map(row=>[`${row.user_id}:${row.week_number}`,row[view]]));
  if(!weeks.length||!players.length)return <section className="standings-history card"><header><div><p className="eyebrow">Week by week</p><h2>Standings race</h2></div></header><p className="history-empty">The race chart will appear after the first Competition Week has results.</p></section>;

  const width=760,height=300,left=48,right=18,top=22,bottom=42;
  const scores=rows.map(row=>row[view]);const rawMin=Math.min(0,...scores),rawMax=Math.max(0,...scores);
  const padding=Math.max(5,(rawMax-rawMin)*.12);const min=view==="accuracy_rate"?0:rawMin-padding,max=view==="accuracy_rate"?100:rawMax+padding;
  const x=(index:number)=>left+(weeks.length===1?0:(index/(weeks.length-1))*(width-left-right));
  const y=(score:number)=>top+((max-score)/(max-min))*(height-top-bottom);
  const ticks=Array.from({length:5},(_,index)=>max-(index/4)*(max-min));
  const highlightedPlayer=selectedPlayer??hoveredPoint?.playerId??null;
  const detailPlayer=players.find(player=>player.id===highlightedPlayer);
  const detailWeek=hoveredPoint?.weekNumber===null||hoveredPoint?.weekNumber===undefined?weeks.at(-1):weeks.find(week=>week.number===hoveredPoint.weekNumber);
  const detailScore=detailPlayer&&detailWeek?scoreMap.get(`${detailPlayer.id}:${detailWeek.number}`)??0:null;
  return <section className="standings-history card">
    <header><div><p className="eyebrow">Week by week</p><h2>{mode.title} race</h2><p>Hover to identify a player. Click a name or line to isolate it; click again to reset.</p></div></header>
    <div className="history-modes" aria-label="Chart competition">{modes.map(item=><button type="button" className={view===item.key?"active":""} onClick={()=>{setView(item.key);setHoveredPoint(null)}} key={item.key}>{item.label}</button>)}</div>
    <div className="history-legend">{players.map((player,index)=><button type="button" className={`${selectedPlayer===player.id?"selected":""} ${highlightedPlayer&&highlightedPlayer!==player.id?"dimmed":""}`} onClick={()=>setSelectedPlayer(current=>current===player.id?null:player.id)} onMouseEnter={()=>setHoveredPoint({playerId:player.id,weekNumber:null})} onMouseLeave={()=>setHoveredPoint(null)} onFocus={()=>setHoveredPoint({playerId:player.id,weekNumber:null})} onBlur={()=>setHoveredPoint(null)} aria-pressed={selectedPlayer===player.id} key={player.id}><i style={{background:historyColors[index%historyColors.length]}}/>{player.name}</button>)}</div>
    <div className={`history-chart-readout ${detailPlayer?"visible":""}`} aria-live="polite">{detailPlayer&&detailWeek&&detailScore!==null?<><i style={{background:historyColors[players.findIndex(player=>player.id===detailPlayer.id)%historyColors.length]}}/><b>{detailPlayer.name}</b><span>Week {detailWeek.number} · {view==="accuracy_rate"?`${detailScore}% correct`:`${detailScore} ${mode.unit}`}</span>{selectedPlayer===detailPlayer.id&&<small>Locked on</small>}</>:<span>Hover over a line or player name</span>}</div>
    <div className="history-chart-scroll">
      <svg className="history-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${mode.title} by Competition Week`}>
        {ticks.map((tick,index)=>{const tickY=y(tick);return <g key={index}><line x1={left} x2={width-right} y1={tickY} y2={tickY}/><text x={left-8} y={tickY+3} textAnchor="end">{Math.round(tick)}{view==="accuracy_rate"?"%":""}</text></g>})}
        {weeks.map((week,index)=>weeks.length<=10||index===0||index===weeks.length-1||index%Math.ceil(weeks.length/8)===0?<text className="history-x-label" x={x(index)} y={height-14} textAnchor="middle" key={week.number}>W{week.number}</text>:null)}
        {players.map((player,playerIndex)=>{
          const points=weeks.map((week,index)=>({week,index,score:scoreMap.get(`${player.id}:${week.number}`)??0}));
          const path=points.map((point,index)=>`${index?"L":"M"} ${x(point.index)} ${y(point.score)}`).join(" ");
          const color=historyColors[playerIndex%historyColors.length];
          const isDimmed=Boolean(highlightedPlayer&&highlightedPlayer!==player.id);const isActive=highlightedPlayer===player.id;
          const activate=(weekNumber:number|null)=>setHoveredPoint({playerId:player.id,weekNumber});
          return <g className={`history-series ${isActive?"active":""} ${isDimmed?"dimmed":""}`} key={player.id}><path className="history-line" d={path} style={{stroke:color}}/><path className="history-hit-line" d={path} onMouseEnter={()=>activate(null)} onMouseLeave={()=>setHoveredPoint(null)} onClick={()=>setSelectedPlayer(current=>current===player.id?null:player.id)}/>{points.map(point=><circle cx={x(point.index)} cy={y(point.score)} r="5" style={{fill:color}} tabIndex={0} onMouseEnter={()=>activate(point.week.number)} onMouseLeave={()=>setHoveredPoint(null)} onFocus={()=>activate(point.week.number)} onBlur={()=>setHoveredPoint(null)} onClick={()=>setSelectedPlayer(current=>current===player.id?null:player.id)} key={point.week.number}><title>{player.name} - {point.week.label}: {view==="accuracy_rate"?`${point.score}% correct`:`${point.score} ${mode.unit}`}</title></circle>)}</g>;
        })}
      </svg>
    </div>
  </section>;
}
