import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarCog, ClipboardList, Coins, Gauge, Sparkles, Swords, UsersRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { setGameOfWeek, setMarketCurrentResults, syncLockToFirstKickoff, toggleFixtureEligibility } from "./actions";

export const metadata:Metadata={title:"Admin"};
export const dynamic="force-dynamic";

type FixtureRow={
  id:string;competition_week_id:string;kickoff_at:string;is_eligible:boolean;is_gotw:boolean;
  home:{name:string}|null;away:{name:string}|null;
};
type WeekRow={id:string;number:number|null;label:string;lock_at:string|null;status:string;fixtures:FixtureRow[]};
type MarketRow={id:string;title:string;max_selections:number;current_option_ids:string[];season_market_options:{id:string;label:string;sort_order:number}[]};

const formatDate=(value:string)=>new Intl.DateTimeFormat("en-US",{weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZone:"America/New_York"}).format(new Date(value));

export default async function Page(){
  const supabase=await createClient();
  if(!supabase)redirect("/auth/sign-in");
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/auth/sign-in");
  const {data:profile}=await supabase.from("profiles").select("is_admin").eq("id",user.id).single();
  if(!profile?.is_admin)redirect("/picks");

  const [{data:weekData},{count:ledger},{count:challenges},{count:players},{count:submitted},{data:marketData}]=await Promise.all([
    supabase.from("competition_weeks").select("id,number,label,lock_at,status,fixtures(id,competition_week_id,kickoff_at,is_eligible,is_gotw,home:teams!fixtures_home_team_id_fkey(name),away:teams!fixtures_away_team_id_fkey(name))").in("status",["draft","open","locked"]).order("start_date"),
    supabase.from("points_ledger").select("*",{count:"exact",head:true}),
    supabase.from("challenges").select("*",{count:"exact",head:true}),
    supabase.from("profiles").select("*",{count:"exact",head:true}),
    supabase.from("weekly_submissions").select("*",{count:"exact",head:true}),
    supabase.from("season_markets").select("id,title,max_selections,current_option_ids,season_market_options(id,label,sort_order)").in("status",["open","locked"]).order("display_order"),
  ]);
  const weeks=(weekData??[]) as unknown as WeekRow[];
  const markets=(marketData??[]) as unknown as MarketRow[];
  const summaries=[
    {label:"Players",value:players??0,Icon:UsersRound},
    {label:"Submissions",value:submitted??0,Icon:ClipboardList},
    {label:"Ledger entries",value:ledger??0,Icon:Coins},
    {label:"Challenges",value:challenges??0,Icon:Swords},
  ];

  return <AppShell><main className="content content-wide admin-page">
    <div className="page-head"><div><p className="eyebrow">Restricted</p><h1>Admin desk</h1><p className="subtle">Choose the weekly slate, Game of the Week, and common deadline.</p></div><span className="pill live">Admin</span></div>
    <section className="admin-summary">{summaries.map(({label,value,Icon})=><div className="card admin-stat" key={label}><Icon size={19}/><span>{label}</span><b>{value}</b></div>)}</section>
    <section className="admin-instructions card"><span className="icon-box"><CalendarCog size={21}/></span><div><h2>How weekly game selection works</h2><p className="subtle">Mark the matches players may choose from, select exactly one Game of the Week, then set the common lock to the first eligible kickoff. Complete this before opening the week to players.</p></div></section>
    <section className="admin-weeks">{weeks.length?weeks.map(week=><article className="card admin-week" key={week.id}>
      <header><div><p className="eyebrow">{week.number?`Competition week ${week.number}`:"Calendar item"} · {week.status}</p><h2>{week.label}</h2><p className="subtle">Current lock: {week.lock_at?formatDate(week.lock_at):"Not set"}</p></div><form action={syncLockToFirstKickoff}><input type="hidden" name="weekId" value={week.id}/><button className="secondary" type="submit"><Gauge size={16}/> Use first kickoff as lock</button></form></header>
      <div className="admin-fixtures">{[...week.fixtures].sort((a,b)=>Date.parse(a.kickoff_at)-Date.parse(b.kickoff_at)).map(fixture=><div className={`admin-fixture ${fixture.is_eligible?"eligible":""}`} key={fixture.id}>
        <div><b>{fixture.home?.name??"Home"} vs {fixture.away?.name??"Away"}</b><span>{formatDate(fixture.kickoff_at)}</span></div>
        <div className="fixture-admin-actions">
          <form action={toggleFixtureEligibility}><input type="hidden" name="fixtureId" value={fixture.id}/><input type="hidden" name="next" value={String(!fixture.is_eligible)}/><button className={`mini-button ${fixture.is_eligible?"active":""}`} type="submit">{fixture.is_eligible?"Eligible":"Excluded"}</button></form>
          <form action={setGameOfWeek}><input type="hidden" name="weekId" value={week.id}/><input type="hidden" name="fixtureId" value={fixture.id}/><button className={`mini-button gotw-button ${fixture.is_gotw?"active":""}`} type="submit">{fixture.is_gotw?"Game of the Week":"Make GOTW"}</button></form>
        </div>
      </div>)}</div>
    </article>):<div className="card"><h2>No configurable weeks</h2><p className="subtle">Create the next Competition Week and fixtures in Supabase, then return here to choose the weekly slate.</p></div>}</section>
    {markets.length>0&&<section className="admin-markets"><div className="section-label"><div><p className="eyebrow">Projection controls</p><h2>Current season results</h2></div></div><div className="notice admin-market-note"><Sparkles size={18}/><span>Choose the teams currently occupying each result. This powers the optional “assume current results stand” table; it does not settle points.</span></div>{markets.map(market=><form action={setMarketCurrentResults} className="card admin-market" key={market.id}><input type="hidden" name="marketId" value={market.id}/><header><div><h3>{market.title}</h3><p>Select up to {market.max_selections} current result{market.max_selections===1?"":"s"}.</p></div><button className="secondary" type="submit">Update projection</button></header><div className="admin-market-options">{[...market.season_market_options].sort((a,b)=>a.sort_order-b.sort_order).map(option=><label key={option.id}><input type="checkbox" name="optionId" value={option.id} defaultChecked={(market.current_option_ids??[]).includes(option.id)}/><span>{option.label}</span></label>)}</div></form>)}</section>}
  </main></AppShell>;
}
