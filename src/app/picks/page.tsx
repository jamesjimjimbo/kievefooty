import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PicksFlow, type PicksPageData } from "@/components/picks-flow";
import { createClient } from "@/lib/supabase/server";
import type { Fixture, Outcome } from "@/lib/demo-data";
export const metadata:Metadata={title:"Picks"};export const dynamic="force-dynamic";
type OddsRow={home:number|string;draw:number|string;away:number|string;captured_at:string};
type FixtureRow={id:string;kickoff_at:string;is_gotw:boolean;home:{name:string}|null;away:{name:string}|null;fixture_odds:OddsRow[]};
type ProfileRow={id:string;display_name:string};
type ChallengeRow={opponent_id:string};
type StandingRow={user_id:string};
function hasWeekLocked(lockAt:string){return new Date().getTime()>=Date.parse(lockAt)}

export default async function PicksPage(){
  const supabase=await createClient();if(!supabase)redirect("/auth/sign-in?error=Supabase+is+not+configured");
  const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth/sign-in");
  const {data:week}=await supabase.from("competition_weeks").select("*").eq("status","open").eq("is_active_betting_week",true).order("number").limit(1).maybeSingle();
  if(!week)return <PicksFlow data={null}/>;
  const [{data:rows},{data:submission},{data:ledger},{data:profiles},{data:challenges},{data:standings}]=await Promise.all([
    supabase.from("fixtures").select("id,kickoff_at,is_gotw,home:teams!fixtures_home_team_id_fkey(name),away:teams!fixtures_away_team_id_fkey(name),fixture_odds(home,draw,away,captured_at)").eq("competition_week_id",week.id).eq("is_eligible",true).order("kickoff_at"),
    supabase.from("weekly_submissions").select("source,picks(fixture_id,kind,selected_outcome,stake)").eq("user_id",user.id).eq("competition_week_id",week.id).maybeSingle(),
    supabase.from("points_ledger").select("amount").eq("user_id",user.id),
    supabase.from("profiles").select("id,display_name").neq("id",user.id).order("display_name"),
    supabase.from("challenges").select("opponent_id").eq("challenger_id",user.id),
    supabase.rpc("get_standings",{p_half:null}),
  ]);
  const fixtureRows=(rows??[]) as unknown as FixtureRow[];
  const fixtures:Fixture[]=fixtureRows.map(row=>{
    const latest=[...(row.fixture_odds??[])].sort((a,b)=>Date.parse(b.captured_at)-Date.parse(a.captured_at))[0];
    return {id:row.id,home:row.home?.name??"Home",away:row.away?.name??"Away",kickoff:new Intl.DateTimeFormat("en-US",{weekday:"short",hour:"numeric",minute:"2-digit",timeZone:"America/New_York"}).format(new Date(row.kickoff_at)),gotw:row.is_gotw,odds:{home:Number(latest?.home??1),draw:Number(latest?.draw??1),away:Number(latest?.away??1)}};
  });
  const existing=(submission?.picks??[]) as {fixture_id:string;kind:"gotw"|"own";selected_outcome:Outcome;stake:number}[];
  const rank=Math.max(1,((standings??[]) as StandingRow[]).findIndex(row=>row.user_id===user.id)+1);
  const used=new Set(((challenges??[]) as ChallengeRow[]).map(c=>c.opponent_id));
  const opponentRows=(profiles??[]) as ProfileRow[];
  const data:PicksPageData={
    week:{id:week.id,number:week.number,label:week.label,lockAt:week.lock_at,lockLabel:new Intl.DateTimeFormat("en-US",{weekday:"long",hour:"numeric",minute:"2-digit",timeZone:"America/New_York"}).format(new Date(week.lock_at))},
    bankroll:(ledger??[]).reduce((sum,row)=>sum+Number(row.amount),0),rank,fixtures,
    existing:{gotw:existing.find(p=>p.kind==="gotw"),own:existing.find(p=>p.kind==="own"),source:submission?.source},
    opponents:opponentRows.filter(p=>!used.has(p.id)),challengeTokens:Math.max(0,opponentRows.length-used.size),
    locked:hasWeekLocked(week.lock_at),
  };
  return <PicksFlow data={data}/>;
}
