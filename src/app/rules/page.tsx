import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Banknote, CalendarClock, Goal, ShieldCheck, Swords, Trophy } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";

export const metadata:Metadata={title:"Rules & contests"};
export const dynamic="force-dynamic";

const sections=[
  {title:"Your weekly picks",Icon:Goal,body:"Every active Competition Week has one admin-selected Game of the Week. You also choose one other eligible fixture. Pick Home, Draw, or Away on each and split exactly 10 points between them, with at least 1 point on each."},
  {title:"The deadline",Icon:CalendarClock,body:"Both selections lock together at the kickoff of the first eligible Premier League fixture in that Competition Week. Nothing can be edited after the deadline. Missing selections are designed to become automatic 5-and-5 favorite picks."},
  {title:"Scoring",Icon:Banknote,body:"Correct pick: stake × decimal odds − stake. Incorrect pick: lose the stake. The weekly +10 bankroll credit lets everyone participate, but it never counts as competitive performance."},
  {title:"Challenges",Icon:Swords,body:"Before lock, you may challenge each opponent once per season. No acceptance is required. Only the two normal weekly bets are compared. The higher net result receives +10 and the other player −10; a tie transfers nothing but still uses the challenge."},
  {title:"Three standings",Icon:Trophy,body:"First Half and Second Half include normal weekly betting performance only. Overall includes normal weekly performance plus challenge transfers. Bankroll carries across the half-season boundary even though Second-Half performance starts at zero."},
  {title:"Fair play",Icon:ShieldCheck,body:"Other players’ selections stay private until the common deadline. After lock, everyone’s picks, stakes, odds, and potential results become visible on the Picks page."},
];

export default async function RulesPage(){
  const supabase=await createClient();
  if(!supabase)redirect("/auth/sign-in");
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/auth/sign-in");
  return <AppShell><main className="content content-wide rules-page">
    <div className="page-head"><div><p className="eyebrow">How Kieve Footy works</p><h1>Rules & contests</h1><p className="subtle">The short version of what counts, what locks, and what you can win.</p></div></div>
    <section className="rules-grid">{sections.map(({title,Icon,body})=><article className="card rule-card" key={title}><span className="icon-box"><Icon size={21}/></span><div><h2>{title}</h2><p className="subtle">{body}</p></div></article>)}</section>
    <section className="card contests-card"><div><p className="eyebrow">Current competition</p><h2>Prize split</h2><p className="subtle">Payments are handled outside the app. The percentages are informational.</p></div><div className="prize-grid"><div><b>15%</b><span>First Half</span></div><div><b>15%</b><span>Second Half</span></div><div><b>70%</b><span>Overall</span></div></div></section>
    <section className="card future-card"><p className="eyebrow">The long game</p><h2>Season competitions</h2><p className="subtle">League champion, Top Four, fifth-to-seventh, relegation and first manager exit are available from the Season page. Golden Boot, January mover and the Champions League Final open when their fields are confirmed.</p><Link className="secondary rules-competition-link" href="/competitions">Open season competitions</Link></section>
  </main></AppShell>;
}
