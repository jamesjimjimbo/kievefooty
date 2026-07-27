import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarDays, Check, Circle, Globe2, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";

export const metadata:Metadata={title:"Season"};
export const dynamic="force-dynamic";

type WeekRow={
  id:string;number:number|null;label:string;start_date:string;end_date:string;
  half:"first"|"second"|null;status:"draft"|"open"|"locked"|"settled"|"break";
  is_active_betting_week:boolean;is_casino:boolean;notes:string|null;
};

const date=(value:string)=>new Date(`${value}T12:00:00`);
const shortDate=(value:string)=>new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric"}).format(date(value));

export default async function Page(){
  const supabase=await createClient();
  if(!supabase)redirect("/auth/sign-in");
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/auth/sign-in");
  const {data}=await supabase.from("competition_weeks").select("*").order("start_date");
  const weeks=(data??[]) as WeekRow[];
  const now=new Date();
  const remaining=weeks.filter(w=>w.is_active_betting_week&&w.status!=="settled"&&date(w.end_date)>=now);
  const firstLeft=remaining.filter(w=>w.half==="first"&&!w.is_casino).length;
  const secondLeft=remaining.filter(w=>w.half==="second"&&!w.is_casino).length;
  const nextSpecial=weeks.find(w=>w.is_casino&&date(w.end_date)>=now);
  const monthGroups=new Map<string,WeekRow[]>();
  for(const week of weeks){
    const key=new Intl.DateTimeFormat("en-US",{month:"long",year:"numeric"}).format(date(week.start_date));
    monthGroups.set(key,[...(monthGroups.get(key)??[]),week]);
  }

  return <AppShell><main className="content content-wide season-page">
    <div className="page-head"><div><p className="eyebrow">The full script</p><h1>Season calendar</h1><p className="subtle">Competition Weeks follow the calendar, with breaks and special weeks marked clearly.</p></div></div>
    <section className="season-metrics">
      <div className="card metric-card"><span className="stat-label">First half picks left</span><span className="metric-value">{firstLeft}</span><small>until the half closes</small></div>
      <div className="card metric-card"><span className="stat-label">Second half picks left</span><span className="metric-value">{secondLeft}</span><small>scheduled so far</small></div>
      <div className="card metric-card"><span className="stat-label">Next special week</span><span className="metric-value metric-text">{nextSpecial?shortDate(nextSpecial.start_date):"Not scheduled"}</span><small>{nextSpecial?.label??"Casino weeks can be added later"}</small></div>
    </section>
    <div className="calendar-legend"><span><i className="legend-dot done"/>Completed</span><span><i className="legend-dot current"/>Current</span><span><i className="legend-dot upcoming"/>Upcoming</span><span><i className="legend-dot break"/>Break</span></div>
    {[...monthGroups].map(([month,items])=><section className="calendar-month" key={month}>
      <h2>{month}</h2>
      <div className="calendar-grid">{items.map(week=><WeekCard key={week.id} week={week}/>)}</div>
    </section>)}
    <div className="notice season-note"><b>Performance resets at the half; bankroll does not.</b> First- and Second-Half tables count only normal weekly results. Overall also includes challenge transfers.</div>
  </main></AppShell>;
}

function WeekCard({week}:{week:WeekRow}){
  const state=week.status==="settled"?"done":week.status==="open"||week.status==="locked"?"current":week.status==="break"?"break":"upcoming";
  const Icon=state==="done"?Check:state==="break"?Globe2:week.is_casino?Sparkles:state==="current"?CalendarDays:Circle;
  return <article className={`card calendar-card ${state}`}>
    <div className="calendar-card-top"><span className="calendar-icon"><Icon size={17}/></span><span className="calendar-dates">{shortDate(week.start_date)}{week.end_date!==week.start_date?`–${shortDate(week.end_date)}`:""}</span></div>
    <p className="eyebrow">{week.is_casino?"Special week":week.is_active_betting_week?`Competition week ${week.number}`:"No picks"}</p>
    <h3>{week.label}</h3>
    <p>{week.notes??(state==="current"?"Picks are open now":week.half?`${week.half==="first"?"First":"Second"} Half`:"Calendar break")}</p>
  </article>;
}
