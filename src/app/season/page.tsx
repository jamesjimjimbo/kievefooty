import type {Metadata} from "next";
import Link from "next/link";
import {redirect} from "next/navigation";
import {ChevronRight,Globe2,Trophy} from "lucide-react";
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

type CalendarKind="regular"|"break"|"casino"|"finale";
type CalendarEvent={kind:CalendarKind;label:string;detail:string};

const roundDates=[
  "2026-08-21","2026-08-28","2026-09-04","2026-09-12","2026-09-18",
  "2026-10-10","2026-10-17","2026-10-24","2026-10-31",
  "2026-11-07","2026-11-21","2026-11-28",
  "2026-12-02","2026-12-05","2026-12-12","2026-12-19","2026-12-26","2026-12-30",
  "2027-01-02","2027-01-06","2027-01-16","2027-01-23","2027-01-30",
  "2027-02-06","2027-02-10","2027-02-20","2027-02-27",
  "2027-03-03","2027-03-13","2027-03-20",
  "2027-04-10","2027-04-17","2027-04-24",
  "2027-05-01","2027-05-08","2027-05-15","2027-05-23","2027-05-30",
];
const calendarEvents=new Map<string,CalendarEvent>(
  roundDates.map((day,index)=>[day,{kind:"regular",label:`Competition week ${index+1}`,detail:"Regular picks"}]),
);
for(const day of ["2026-12-26","2026-12-30","2027-01-02","2027-01-06"]){
  calendarEvents.set(day,{kind:"casino",label:"Holiday Casino",detail:"Winter slate"});
}
for(const day of ["2027-05-01","2027-05-08","2027-05-15","2027-05-23"]){
  calendarEvents.set(day,{kind:"casino",label:"Final Stretch Casino",detail:"Variable-stake picks"});
}
calendarEvents.set("2027-05-30",{kind:"finale",label:"Premier League Final Day",detail:"All matches kick off together"});
calendarEvents.set("2027-06-05",{kind:"finale",label:"Champions League Final",detail:"Madrid"});

function addDateRange(start:string,end:string,label:string){
  const cursor=new Date(`${start}T12:00:00Z`);
  const final=new Date(`${end}T12:00:00Z`);
  while(cursor<=final){
    const key=cursor.toISOString().slice(0,10);
    calendarEvents.set(key,{kind:"break",label,detail:"No regular picks"});
    cursor.setUTCDate(cursor.getUTCDate()+1);
  }
}
addDateRange("2026-09-24","2026-10-06","International break");
addDateRange("2026-11-12","2026-11-17","International break");
addDateRange("2027-03-25","2027-03-30","International break");

const calendarMonths=Array.from({length:11},(_,index)=>{
  const monthIndex=7+index;
  return {year:2026+Math.floor(monthIndex/12),month:monthIndex%12};
});
const dateKey=(year:number,month:number,day:number)=>`${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;

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

    <div className="calendar-heading"><div><p className="eyebrow">August to June</p><h2>Competition calendar</h2><p>Regular rounds, pauses, Casino windows, and the two season finales at a glance.</p></div></div>
    <div className="calendar-key" aria-label="Calendar legend"><span><i className="regular"/>Regular picks</span><span><i className="break"/>International break</span><span><i className="casino"/>Casino</span><span><i className="finale"/>Finale</span></div>
    <section className="month-calendar-grid">{calendarMonths.map(({year,month})=><CalendarMonth key={`${year}-${month}`} year={year} month={month}/>)}</section>
    <p className="calendar-source-note">Premier League match-round dates are shown as originally scheduled and may move for broadcast or cup commitments.</p>

    <Link href="/competitions" className="card competitions-link"><span className="icon-box"><Trophy size={20}/></span><div><p className="eyebrow">The long game</p><h2>Season competitions</h2><p>Champion, Top Four, relegation, manager exit and more.</p></div><ChevronRight size={20}/></Link>
  </main></AppShell>;
}

function CalendarMonth({year,month}:{year:number;month:number}){
  const firstDay=new Date(Date.UTC(year,month,1)).getUTCDay();
  const daysInMonth=new Date(Date.UTC(year,month+1,0)).getUTCDate();
  const monthName=new Intl.DateTimeFormat("en-US",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(Date.UTC(year,month,1)));
  const cells=Array.from({length:42},(_,index)=>{
    const day=index-firstDay+1;
    if(day<1||day>daysInMonth)return <span className="calendar-day outside" aria-hidden="true" key={index}/>;
    const event=calendarEvents.get(dateKey(year,month,day));
    return <span className={`calendar-day ${event?.kind??""}`} title={event?`${event.label} — ${event.detail}`:undefined} aria-label={event?`${monthName} ${day}: ${event.label}, ${event.detail}`:`${monthName} ${day}`} key={index}>
      <b>{day}</b>{event&&<i/>}
    </span>;
  });
  const monthEvents=Array.from({length:daysInMonth},(_,index)=>calendarEvents.get(dateKey(year,month,index+1))).filter(Boolean) as CalendarEvent[];
  const regularCount=monthEvents.filter(event=>event.kind==="regular").length;
  const specialEvents=Array.from(new Map(monthEvents.filter(event=>event.kind!=="regular").map(event=>[event.label,event])).values());
  return <article className="month-calendar card">
    <header><h3>{monthName}</h3>{regularCount>0&&<span>{regularCount} regular week{regularCount===1?"":"s"}</span>}</header>
    <div className="weekday-row" aria-hidden="true">{["S","M","T","W","T","F","S"].map((day,index)=><span key={`${day}-${index}`}>{day}</span>)}</div>
    <div className="calendar-days">{cells}</div>
    <footer>{specialEvents.length?specialEvents.map(event=><div className="month-special" key={event.label}><i className={event.kind}/><span><b>{event.label}</b><small>{event.detail}</small></span></div>):<span className="calendar-quiet">Regular competition month</span>}</footer>
  </article>;
}
