"use client";
import {AppShell} from "./app-shell";
import {ClubCrest} from "./club-crest";

export type StandingPlayer={
  id:string;name:string;initials:string;first:number;second:number;overall:number;
  projected:number;seasonProjection:number;accuracyCorrect:number;accuracyTotal:number;me:boolean;
};

export function StandingsBoard({players}:{players:StandingPlayer[]}){
  return <AppShell><main className="content content-wide">
    <div className="page-head"><div><p className="eyebrow">2026 / 27</p><h1>Standings</h1><p className="subtle">Every competition, all in one place.</p></div></div>
    <section className="standings-grid">
      <ScoreCompetition title="First Half" prize="15%" description="Normal weekly results in the first half." players={players} scoreKey="first"/>
      <ScoreCompetition title="Second Half" prize="15%" description="Normal weekly results in the second half." players={players} scoreKey="second"/>
      <FullCompetition players={players}/>
      <AccuracyCompetition players={players}/>
    </section>
    <p className="standings-footnote">Weekly 10-point credits never count here. Projected Full Competition scores are informational and do not alter official points.</p>
  </main></AppShell>;
}

function CompetitionHeader({title,prize,description}:{title:string;prize:string;description:string}){
  return <header className="standing-card-head"><p className="eyebrow">{prize} of the pot</p><h2>{title}</h2><p>{description}</p></header>;
}

function PlayerCell({player}:{player:StandingPlayer}){
  return <span className="player"><ClubCrest seed={player.id} label={player.name} size="sm"/><span>{player.name}{player.me&&<small className="you-label">You</small>}</span></span>;
}

function ScoreCompetition({title,prize,description,players,scoreKey}:{title:string;prize:string;description:string;players:StandingPlayer[];scoreKey:"first"|"second"}){
  const sorted=[...players].sort((a,b)=>b[scoreKey]-a[scoreKey]||a.name.localeCompare(b.name));
  return <article className="card standings-card"><CompetitionHeader title={title} prize={prize} description={description}/><div className="table competition-table">{sorted.map((player,index)=><div className={`standing-row ${player.me?"me":""}`} key={player.id}><span className="rank">{index+1}</span><PlayerCell player={player}/><span className="points">{player[scoreKey]>0?"+":""}{player[scoreKey]}</span></div>)}</div></article>;
}

function FullCompetition({players}:{players:StandingPlayer[]}){
  const sorted=[...players].sort((a,b)=>b.overall-a.overall||a.name.localeCompare(b.name));
  return <article className="card standings-card"><CompetitionHeader title="Full Competition" prize="60%" description="Official score beside the current-results forecast."/><div className="standing-column-labels"><span>Official</span><span>If held</span></div><div className="table competition-table">{sorted.map((player,index)=><div className={`standing-row full-standing-row ${player.me?"me":""}`} key={player.id}><span className="rank">{index+1}</span><PlayerCell player={player}/><span className="official-score">{player.overall>0?"+":""}{player.overall}</span><span className="points projected-score">{player.projected>0?"+":""}{player.projected}</span></div>)}</div></article>;
}

function AccuracyCompetition({players}:{players:StandingPlayer[]}){
  const accuracyRate=(player:StandingPlayer)=>player.accuracyTotal?player.accuracyCorrect/player.accuracyTotal:0;
  const sorted=[...players].sort((a,b)=>b.accuracyCorrect-a.accuracyCorrect||accuracyRate(b)-accuracyRate(a)||a.name.localeCompare(b.name));
  return <article className="card standings-card"><CompetitionHeader title="Most Accurate Picker" prize="10%" description="Most correct picks in normal Competition Weeks."/><div className="table competition-table">{sorted.map((player,index)=><div className={`standing-row accuracy-row ${player.me?"me":""}`} key={player.id}><span className="rank">{index+1}</span><PlayerCell player={player}/><span className="accuracy-score"><b>{player.accuracyCorrect}</b><small>of {player.accuracyTotal}</small></span></div>)}</div></article>;
}
