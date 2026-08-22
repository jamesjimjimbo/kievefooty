import type {Metadata} from "next";
import Link from "next/link";
import {redirect} from "next/navigation";
import {CalendarDays,ChevronRight,LockKeyhole,Repeat2,Sparkles,Target,Trophy} from "lucide-react";
import {AppShell} from "@/components/app-shell";
import {createClient} from "@/lib/supabase/server";

export const metadata:Metadata={title:"Rules"};
export const dynamic="force-dynamic";

const seasonPhases=[
  {date:"Before Aug 21",title:"Season picks",body:"Champion, league positions, managers and Golden Boot.",tone:"season"},
  {date:"Aug 21-Dec 20",title:"First Half",body:"The normal weekly rhythm begins.",tone:"weekly"},
  {date:"Dec 21-Jan 2",title:"Holiday Casino",body:"Unlimited festive-fixture bets with boosted odds.",tone:"casino"},
  {date:"Jan 6-Apr 30",title:"Second Half",body:"Weekly picks resume for the run-in.",tone:"weekly"},
  {date:"May 1-May 30",title:"Final Casino",body:"Variable stakes through the last Premier League game.",tone:"casino"},
  {date:"June 5",title:"UCL Final",body:"One last match, then the Full Competition is final.",tone:"final"},
];

const seasonScoring=[
  ["League champion","100"],
  ["Other Top Four clubs","50 each"],
  ["Fifth to seventh","25 each"],
  ["Relegated clubs","50 each"],
  ["Manager sack market","+10 / −5"],
  ["Golden Boot top three","20 each"],
  ["Second-half mover","±5 / place"],
  ["Champions League Final","Final bet"],
];

const standings=[
  {prize:"15%",title:"First Half",dates:"Aug 21-Jan 2",counts:"Normal weekly results only"},
  {prize:"15%",title:"Second Half",dates:"Jan 6-May 30",counts:"Normal weekly results only"},
  {prize:"60%",title:"Full Competition",dates:"Through June 5",counts:"Every scored part of the game"},
  {prize:"10%",title:"Most Accurate",dates:"Whole season",counts:"Best correct-pick percentage"},
];

export default async function RulesPage(){
  const supabase=await createClient();
  if(!supabase)redirect("/auth/sign-in");
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/auth/sign-in");
  return <AppShell><main className="content content-wide rules-page">
    <div className="page-head rules-page-head"><div><p className="eyebrow">The whole game, on one page</p><h1>How the season works</h1><p className="subtle">Two games run side by side: weekly betting and season-long predictions. Everything meets in the Full Competition.</p></div></div>

    <section className="card rules-season-map" aria-labelledby="season-map-title">
      <header className="rules-map-head">
        <div><p className="eyebrow">August to June</p><h2 id="season-map-title">The road to the final whistle</h2></div>
        <span><CalendarDays size={15}/>2026 / 27</span>
      </header>
      <div className="rules-timeline">
        {seasonPhases.map((phase,index)=><article className={`rules-phase ${phase.tone}`} key={phase.title}>
          <i>{index+1}</i><small>{phase.date}</small><b>{phase.title}</b><p>{phase.body}</p>
        </article>)}
      </div>
      <div className="rules-map-key"><span><i className="weekly"/>Normal weeks</span><span><i className="casino"/>Casino periods</span><span><i className="season"/>Season milestones</span></div>
    </section>

    <div className="rules-game-lanes">
      <section className="card rules-lane weekly-lane">
        <header><span className="rules-lane-icon"><Repeat2 size={19}/></span><div><p className="eyebrow">Game one · repeats</p><h2>Week to week</h2></div></header>
        <div className="weekly-loop">
          <div><i>1</i><b>Get 10 points</b><p>Every active Friday. The credit funds your bets but never counts in the standings.</p></div>
          <ChevronRight aria-hidden="true"/>
          <div><i>2</i><b>Make two picks</b><p>Choose the Game of the Week and one other match. Split all 10, at least 1 on each.</p></div>
          <ChevronRight aria-hidden="true"/>
          <div><i>3</i><b>Everything locks</b><p>Both picks lock at the first eligible kickoff. Everyone&apos;s choices then become visible.</p></div>
          <ChevronRight aria-hidden="true"/>
          <div><i>4</i><b>Collect the full return</b><p>Win: stake × decimal odds, including your stake back. Lose: 0 points returned.</p></div>
        </div>
        <div className="rules-bonus-row">
          <span><Target size={15}/><b>3 straight GOTW wins</b><small>+10 streak bonus, then reset</small></span>
          <span><Sparkles size={15}/><b>Head-to-head challenge</b><small>Winner +10 · loser −10 · ties 0</small></span>
        </div>
      </section>

      <section className="card rules-lane season-lane">
        <header><span className="rules-lane-icon"><Trophy size={19}/></span><div><p className="eyebrow">Game two · make once</p><h2>Season long</h2></div><Link href="/competitions">Make picks<ChevronRight size={14}/></Link></header>
        <p className="rules-lane-intro">Call the big outcomes before their markets lock. Correct answers add directly to the Full Competition.</p>
        <div className="season-score-grid">{seasonScoring.map(([label,value])=><div key={label}><span>{label}</span><b>{value}</b></div>)}</div>
        <p className="rules-fine-print">Exact order does not matter inside the Top Four, fifth-to-seventh, relegation or Golden Boot top three.</p>
      </section>
    </div>

    <section className="rules-casino-band">
      <div className="casino-band-title"><Sparkles size={18}/><div><p className="eyebrow">Two special windows</p><h2>Casino changes the weekly rhythm</h2></div></div>
      <div className="casino-window"><small>Dec 21-Jan 2</small><b>Holiday Casino</b><p>Bet across the festive fixture slate. No artificial limit on the number of bets.</p></div>
      <div className="casino-window"><small>May 1-May 30</small><b>Final Stretch Casino</b><p>Variable stakes run through the final Premier League game.</p></div>
      <div className="casino-boost"><b>+5%</b><span>odds boost on every Casino bet</span><small>Total stakes cannot exceed your available balance.</small></div>
    </section>

    <section className="card rules-full-formula">
      <div><p className="eyebrow">The main prize</p><h2>What builds the Full Competition score?</h2></div>
      <p><span>Weekly net results</span><b>+</b><span>Casino results</span><b>+</b><span>Season picks</span><b>+</b><span>Challenges &amp; streaks</span><b>+</b><span>UCL Final</span></p>
    </section>

    <section className="rules-standings-section">
      <div className="rules-section-title"><div><p className="eyebrow">Four winners</p><h2>Where your points go</h2></div><LockKeyhole size={18}/></div>
      <div className="rules-standings-grid">{standings.map(standing=><article className="card" key={standing.title}>
        <b>{standing.prize}</b><div><h3>{standing.title}</h3><small>{standing.dates}</small><p>{standing.counts}</p></div>
      </article>)}</div>
      <p className="rules-accuracy-note"><b>Accuracy is separate:</b> it is correct settled picks ÷ all settled picks, including FA Cup and Casino bets.</p>
    </section>
  </main></AppShell>;
}
