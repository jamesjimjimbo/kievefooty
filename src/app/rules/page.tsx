import type {Metadata} from "next";
import Link from "next/link";
import {redirect} from "next/navigation";
import {ChevronRight} from "lucide-react";
import {AppShell} from "@/components/app-shell";
import {createClient} from "@/lib/supabase/server";

export const metadata:Metadata={title:"Rules"};
export const dynamic="force-dynamic";

const coreRules=[
  {
    title:"Weekly picks",
    summary:"10 new points each active Friday",
    body:"Before games begin each active Friday, everyone receives 10 new points to wager. Pick Home, Draw, or Away for the Game of the Week and one other eligible fixture, then split all 10 points across them with at least 1 point on each. International-break Fridays receive no credit; Casino weeks do.",
  },
  {
    title:"Lock and visibility",
    summary:"Both picks lock together",
    body:"Both selections lock at the first eligible Premier League kickoff of the Competition Week. Before lock, only you and the admin can see your picks. After lock, the league can see every pick, stake, odds, and potential result.",
  },
  {
    title:"Weekly scoring",
    summary:"Wins earn net profit; misses lose the stake",
    body:"A correct pick scores stake × decimal odds − stake. An incorrect pick loses the stake. Each 10-point Friday credit funds participation but never counts toward competitive standings.",
  },
  {
    title:"Challenges",
    summary:"One head-to-head against each opponent",
    body:"Challenge each opponent once per season before a weekly lock. The higher normal weekly betting result receives +10 and the other player −10. A tie transfers nothing but still uses the challenge.",
  },
  {
    title:"Standings and bonuses",
    summary:"First Half, Second Half, and Full Competition",
    body:"Half tables count normal weekly results only. Full Competition also counts challenges, season-long results, Casinos, and bonuses. The separate 10% accuracy prize goes to the player with the most correct picks, including Casino picks. Three correct Games of the Week in a row earns +10; the streak then resets.",
  },
  {
    title:"Casino periods",
    summary:"Variable-stake windows later in the season",
    body:"The Holiday Casino allows bets across the winter slate. The Final Stretch Casino allows variable stakes on the two weekly selections. Casino wagers cannot exceed the available balance, and details will be posted before each window.",
  },
];

const seasonScoring=[
  ["League champion","100 if correct"],
  ["Other Top Four clubs","50 each · 150 available"],
  ["Fifth to seventh","25 each · 75 available"],
  ["Relegated clubs","50 each · 150 available"],
  ["Manager sack market","+10 sacked · −5 survives"],
  ["Golden Boot","20-point bet at preseason odds"],
  ["Second-half mover","±5 per table place"],
  ["Champions League Final","Single-match bet · details later"],
];

export default async function RulesPage(){
  const supabase=await createClient();
  if(!supabase)redirect("/auth/sign-in");
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/auth/sign-in");
  return <AppShell><main className="content content-wide rules-page">
    <div className="page-head compact-page-head"><div><p className="eyebrow">The useful version</p><h1>Rules</h1><p className="subtle">Everything that changes your score, without the legal-document energy.</p></div></div>

    <section className="payout-strip">
      <div><b>15%</b><span>First Half</span><small>Most points from Aug 21-Jan 2</small></div>
      <div><b>15%</b><span>Second Half</span><small>Most points from Jan 6-May 30</small></div>
      <div><b>60%</b><span>Full Competition</span><small>Total points after the June 5 UCL final</small></div>
      <div><b>10%</b><span>Most accurate picker</span><small>Most correct picks, including Casinos</small></div>
    </section>

    <section className="weekly-credit-callout">
      <div><b>330 points to wager</b><span>33 active Fridays × 10 points</span></div>
      <p>That total includes six Casino Fridays and excludes the three international windows. Credits fund bets; they do not inflate the standings.</p>
    </section>

    <div className="rules-layout">
      <section className="rules-accordion card">
        <div className="rules-section-head"><div><p className="eyebrow">Game rules</p><h2>How it works</h2></div><span>Tap a row for detail</span></div>
        {coreRules.map((rule,index)=><details key={rule.title} open={index===0}><summary><div><b>{rule.title}</b><span>{rule.summary}</span></div><ChevronRight size={17}/></summary><p>{rule.body}</p></details>)}
      </section>

      <aside className="season-rule-card card">
        <div className="rules-section-head"><div><p className="eyebrow">475 points available</p><h2>Season scoring</h2></div></div>
        <div className="season-score-list">{seasonScoring.map(([label,value])=><div key={label}><span>{label}</span><b>{value}</b></div>)}</div>
        <p className="rules-note">For the league-position markets, exact order within Top Four, fifth-to-seventh, and relegation does not matter.</p>
        <Link className="primary rules-competition-link" href="/competitions">Make season picks</Link>
      </aside>
    </div>
  </main></AppShell>;
}
