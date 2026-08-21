import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarCog, CheckCircle2, ClipboardList, CloudDownload, Coins, Gauge, RefreshCw, Sparkles, Swords, UsersRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { overrideFixtureResult,refreshLeagueTable,setGameOfWeek,syncLockToFirstKickoff,syncMatchResults,toggleFixtureEligibility } from "./actions";

export const metadata:Metadata={title:"Admin"};
export const dynamic="force-dynamic";

type FixtureRow={
  id:string;competition_week_id:string;kickoff_at:string;is_eligible:boolean;is_gotw:boolean;
  status:string;home_score:number|null;away_score:number|null;result_source:string|null;result_updated_at:string|null;
  home:{name:string}|null;away:{name:string}|null;
};
type WeekRow={id:string;number:number|null;label:string;lock_at:string|null;status:string;competition_code:"PL"|"FAC";fixtures:FixtureRow[]};
type SyncRun={started_at:string;finished_at:string|null;status:string;matched_fixtures:number;final_fixtures:number;settled_weeks:number;error_message:string|null};

const formatDate=(value:string)=>new Intl.DateTimeFormat("en-US",{weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZone:"America/New_York"}).format(new Date(value));

export default async function Page(){
  const supabase=await createClient();
  if(!supabase)redirect("/auth/sign-in");
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/auth/sign-in");
  const {data:profile}=await supabase.from("profiles").select("is_admin").eq("id",user.id).single();
  if(!profile?.is_admin)redirect("/picks");

  const [{data:weekData},{count:ledger},{count:challenges},{count:players},{count:submitted},{data:latestTable},{data:latestResultData}]=await Promise.all([
    supabase.from("competition_weeks").select("id,number,label,lock_at,status,competition_code,fixtures(id,competition_week_id,kickoff_at,is_eligible,is_gotw,status,home_score,away_score,result_source,result_updated_at,home:teams!fixtures_home_team_id_fkey(name),away:teams!fixtures_away_team_id_fkey(name))").in("status",["draft","open","locked","settled"]).order("start_date"),
    supabase.from("points_ledger").select("*",{count:"exact",head:true}),
    supabase.from("challenges").select("*",{count:"exact",head:true}),
    supabase.from("profiles").select("*",{count:"exact",head:true}),
    supabase.from("weekly_submissions").select("*",{count:"exact",head:true}),
    supabase.from("league_table_snapshots").select("captured_at,provider").order("captured_at",{ascending:false}).limit(1).maybeSingle(),
    supabase.from("result_sync_runs").select("started_at,finished_at,status,matched_fixtures,final_fixtures,settled_weeks,error_message").order("started_at",{ascending:false}).limit(1).maybeSingle(),
  ]);
  const weeks=(weekData??[]) as unknown as WeekRow[];
  const latestResult=latestResultData as SyncRun|null;
  const tableFeedConfigured=Boolean(process.env.FOOTBALL_DATA_API_KEY);
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
    <section className="card result-automation"><span className="icon-box"><CloudDownload size={20}/></span><div><p className="eyebrow">Automatic results</p><h2>{latestResult?latestResult.status==="success"?`Last checked ${formatDate(latestResult.finished_at??latestResult.started_at)}`:"Last check needs attention":"Ready for first result check"}</h2><p className="subtle">Scores are checked automatically each evening. A week settles only after every eligible match is final, and repeat checks never duplicate points.</p>{latestResult?.status==="success"&&<small>{latestResult.final_fixtures} final fixtures · {latestResult.settled_weeks} settled weeks</small>}{latestResult?.error_message&&<small className="result-error">{latestResult.error_message}</small>}</div><form action={syncMatchResults}><button className="secondary" type="submit" disabled={!tableFeedConfigured}><RefreshCw size={15}/>Check now</button></form></section>
    <section className="admin-weeks">{weeks.length?weeks.map(week=><article className="card admin-week" key={week.id}>
      <header><div><p className="eyebrow">{week.competition_code==="FAC"?"FA Cup":"Premier League"} · {week.number?`Week ${week.number}`:"Calendar item"} · {week.status}</p><h2>{week.label}</h2><p className="subtle">Current lock: {week.lock_at?formatDate(week.lock_at):"Not set"}</p></div><form action={syncLockToFirstKickoff}><input type="hidden" name="weekId" value={week.id}/><button className="secondary" type="submit"><Gauge size={16}/> Use first kickoff as lock</button></form></header>
      <div className="admin-fixtures">{[...week.fixtures].sort((a,b)=>Date.parse(a.kickoff_at)-Date.parse(b.kickoff_at)).map(fixture=><div className={`admin-fixture ${fixture.is_eligible?"eligible":""}`} key={fixture.id}>
        <div><b>{fixture.home?.name??"Home"} vs {fixture.away?.name??"Away"}</b><span>{formatDate(fixture.kickoff_at)} · {fixture.status}{fixture.status==="final"?` · ${fixture.home_score}–${fixture.away_score}`:""}</span></div>
        <div className="fixture-admin-actions">
          <form action={toggleFixtureEligibility}><input type="hidden" name="fixtureId" value={fixture.id}/><input type="hidden" name="next" value={String(!fixture.is_eligible)}/><button className={`mini-button ${fixture.is_eligible?"active":""}`} type="submit">{fixture.is_eligible?"Eligible":"Excluded"}</button></form>
          <form action={setGameOfWeek}><input type="hidden" name="weekId" value={week.id}/><input type="hidden" name="fixtureId" value={fixture.id}/><button className={`mini-button gotw-button ${fixture.is_gotw?"active":""}`} type="submit">{fixture.is_gotw?"Game of the Week":"Make GOTW"}</button></form>
        </div>
        <form className="result-override" action={overrideFixtureResult}><input type="hidden" name="weekId" value={week.id}/><input type="hidden" name="fixtureId" value={fixture.id}/><label><span>{fixture.home?.name??"Home"}</span><input name="homeScore" type="number" min="0" inputMode="numeric" defaultValue={fixture.home_score??""} required/></label><b>–</b><label><span>{fixture.away?.name??"Away"}</span><input name="awayScore" type="number" min="0" inputMode="numeric" defaultValue={fixture.away_score??""} required/></label><button className="mini-button" type="submit"><CheckCircle2 size={13}/>Save final</button></form>
      </div>)}</div>
    </article>):<div className="card"><h2>No configurable weeks</h2><p className="subtle">Create the next Competition Week and fixtures in Supabase, then return here to choose the weekly slate.</p></div>}</section>
    <section className="admin-markets"><div className="section-label"><div><p className="eyebrow">Forecast</p><h2>Current league table</h2></div></div><div className="card forecast-sync"><span className="icon-box"><Sparkles size={19}/></span><div><b>{latestTable?`Updated ${formatDate(latestTable.captured_at)}`:tableFeedConfigured?"Ready for first refresh":"Table feed not connected"}</b><p>The projected Full Competition table assumes today&apos;s Premier League positions become final. Refreshing makes one provider request and saves the result for everyone.</p></div><form action={refreshLeagueTable}><button className="secondary" type="submit" disabled={!tableFeedConfigured}><RefreshCw size={15}/> {tableFeedConfigured?"Refresh table":"API key needed"}</button></form></div></section>
  </main></AppShell>;
}
