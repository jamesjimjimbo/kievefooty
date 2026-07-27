import type {Metadata} from "next";
import Link from "next/link";
import {redirect} from "next/navigation";
import {CalendarDays,Check,ChevronRight,Circle,Globe2,Sparkles,Trophy} from "lucide-react";
import {AppShell} from "@/components/app-shell";
import {createClient} from "@/lib/supabase/server";

export const metadata:Metadata={title:"Season"};
export const dynamic="force-dynamic";

type WeekRow={
  id:string;number:number|null;label:string;start_date:string;end_date:string;lock_at:string|null;
  half:"first"|"second"|null;status:"draft"|"open"|"locked"|"settled"|"break";
  is_active_betting_week:boolean;is_casino:boolean;notes:string|null;
};

const date=(value:string)=>new Date(`${value}T12:00:00`);
const shortDate=(value:string)=>new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric"}).format(date(value));
const fullDate=(value:string)=>new Intl.DateTimeFormat("en-US",{weekday:"short",month:"short",day:"numeric"}).format(date(value));
const lockLabel=(value:string)=>new Intl.DateTimeFormat("en-US",{weekday:"long",month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZone:"America/New_York"}).format(new Date(value));

export default async function Page(){
  const supabase=await createClient();
  if(!supabase)redirect("/auth/sign-in");
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/auth/sign-in");
  const {data}=await supabase.from("competition_weeks").select("*").order("start_date");
  const weeks=(data??[]) as WeekRow[];
  const currentIndex=weeks.findIndex(week=>week.status==="open"||week.status==="locked");
  const current=currentIndex>=0?weeks[currentIndex]:undefined;
  const next=weeks.slice(Math.max(0,currentIndex+1)).find(week=>week.is_active_betting_week&&week.status!=="settled");
  const nextBreak=weeks.slice(Math.max(0,currentIndex+1)).find(week=>week.status==="break");
  const active=weeks.filter(week=>week.is_active_betting_week&&!week.is_casino);
  const completed=active.filter(week=>week.status==="settled").length;
  const firstRemaining=active.filter(week=>week.half==="first"&&week.status!=="settled").length;
  const monthGroups=new Map<string,WeekRow[]>();
  for(const week of weeks){
    const key=new Intl.DateTimeFormat("en-US",{month:"long",year:"numeric"}).format(date(week.start_date));
    monthGroups.set(key,[...(monthGroups.get(key)??[]),week]);
  }
  return <AppShell><main className="content content-wide season-page">
    <div className="page-head"><div><p className="eyebrow">2026 / 27 roadmap</p><h1>Season</h1><p className="subtle">See what needs a pick now, what comes next, and when the competition pauses.</p></div></div>

    <section className="season-now">
      <div className="season-now-main"><p className="eyebrow">Now</p>{current?<><span className="season-week-number">Competition week {current.number}</span><h2>{current.label}</h2><p>{current.lock_at?`Picks lock ${lockLabel(current.lock_at)}`:"Picks are locked"}</p><Link href="/picks" className="season-action">Go to picks <ChevronRight size={16}/></Link></>:<><h2>No week is open</h2><p>The next Competition Week will appear here when it opens.</p></>}</div>
      <div className="season-next"><p className="eyebrow">Next</p>{next?<><b>{next.label}</b><span>{fullDate(next.start_date)}</span><small>Competition week {next.number}</small></>:<><b>Season complete</b><span>No later week is scheduled.</span></>}{nextBreak&&<div className="break-callout"><Globe2 size={15}/><span>Break begins {shortDate(nextBreak.start_date)}</span></div>}</div>
    </section>

    <section className="season-overview">
      <div><span>Season progress</span><b>{completed} of {active.length} weeks complete</b><div className="season-progress"><i style={{width:`${active.length?completed/active.length*100:0}%`}}/></div></div>
      <div><span>First Half</span><b>{firstRemaining} pick weeks left</b></div>
      <Link href="/competitions"><span>Season-long bets</span><b>Make your predictions</b><ChevronRight size={17}/></Link>
    </section>

    <div className="calendar-heading"><div><p className="eyebrow">Full schedule</p><h2>Competition calendar</h2></div><div className="calendar-key"><span><i className="done"/>Done</span><span><i className="current"/>Now</span><span><i/>Later</span><span><i className="break"/>Break</span></div></div>
    <section className="calendar-list card">{[...monthGroups].map(([month,items])=><div className="calendar-month-row" key={month}><h3>{month}</h3><div>{items.map(week=><CalendarRow key={week.id} week={week}/>)}</div></div>)}</section>

    <Link href="/competitions" className="card competitions-link"><span className="icon-box"><Trophy size={20}/></span><div><p className="eyebrow">The long game</p><h2>Season competitions</h2><p>Champion, Top Four, relegation, manager exit and more.</p></div><ChevronRight size={20}/></Link>
  </main></AppShell>;
}

function CalendarRow({week}:{week:WeekRow}){
  const state=week.status==="settled"?"done":week.status==="open"||week.status==="locked"?"current":week.status==="break"?"break":"upcoming";
  const Icon=state==="done"?Check:state==="break"?Globe2:week.is_casino?Sparkles:state==="current"?CalendarDays:Circle;
  return <article className={`calendar-row ${state}`}>
    <span className="calendar-icon"><Icon size={15}/></span>
    <div className="calendar-row-title"><b>{week.label}</b><small>{week.notes??(week.is_active_betting_week?"Normal picks week":"No picks")}</small></div>
    <span className="calendar-half">{week.half?`${week.half==="first"?"First":"Second"} Half`:week.is_casino?"Special":"Break"}</span>
    <time>{shortDate(week.start_date)}{week.end_date!==week.start_date?` – ${shortDate(week.end_date)}`:""}</time>
  </article>;
}
