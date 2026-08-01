import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PicksFlow, type PicksPageData } from "@/components/picks-flow";
import { createClient } from "@/lib/supabase/server";
import type { Fixture, Outcome } from "@/lib/demo-data";
export const metadata:Metadata={title:"Picks"};export const dynamic="force-dynamic";
type OddsRow={home:number|string;draw:number|string;away:number|string;captured_at:string};
type FixtureRow={id:string;kickoff_at:string;is_gotw:boolean;status:string;home_score:number|null;away_score:number|null;home:{name:string}|null;away:{name:string}|null;fixture_odds:OddsRow[]};
type ProfileRow={id:string;display_name:string};
type ChallengeRow={opponent_id:string};
type WeekChallengeRow={
  id:string;challenger_weekly_net:number|string|null;opponent_weekly_net:number|string|null;
  challenger:{display_name:string}|null;opponent:{display_name:string}|null;
};
type StandingRow={user_id:string;display_name:string;score:number|string};
type ProjectedStandingRow=StandingRow&{season_projection:number|string};
type LeagueSubmissionRow={
  user_id:string;source:"manual"|"auto";profiles:{display_name:string}|null;
  picks:{fixture_id:string;kind:"gotw"|"own";selected_outcome:Outcome;stake:number|string;odds:number|string;is_correct:boolean|null}[];
};
type PreviousSubmissionRow={
  user_id:string;profiles:{display_name:string}|null;
  picks:{stake:number|string;odds:number|string;is_correct:boolean|null}[];
};
function hasWeekLocked(lockAt:string){return new Date().getTime()>=Date.parse(lockAt)}

export default async function PicksPage(){
  const supabase=await createClient();if(!supabase)redirect("/auth/sign-in?error=Supabase+is+not+configured");
  const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth/sign-in");
  const {data:week}=await supabase.from("competition_weeks").select("*").eq("status","open").eq("is_active_betting_week",true).order("number").limit(1).maybeSingle();
  if(!week)return <PicksFlow data={null}/>;
  const locked=hasWeekLocked(week.lock_at);
  const {data:previousWeek}=await supabase.from("competition_weeks").select("id,label").eq("status","settled").eq("is_active_betting_week",true).lt("start_date",week.start_date).order("start_date",{ascending:false}).limit(1).maybeSingle();
  const [{data:rows},{data:submission},{data:ledger},{data:profiles},{data:challenges},{data:firstStandings},{data:secondStandings},{data:overallStandings},{data:projectedStandings},{data:leagueSubmissions},{data:previousSubmissions},{data:weekChallenges}]=await Promise.all([
    supabase.from("fixtures").select("id,kickoff_at,is_gotw,status,home_score,away_score,home:teams!fixtures_home_team_id_fkey(name),away:teams!fixtures_away_team_id_fkey(name),fixture_odds(home,draw,away,captured_at)").eq("competition_week_id",week.id).eq("is_eligible",true).order("kickoff_at"),
    supabase.from("weekly_submissions").select("source,picks(fixture_id,kind,selected_outcome,stake)").eq("user_id",user.id).eq("competition_week_id",week.id).maybeSingle(),
    supabase.from("points_ledger").select("amount").eq("user_id",user.id),
    supabase.from("profiles").select("id,display_name").neq("id",user.id).order("display_name"),
    supabase.from("challenges").select("opponent_id").eq("challenger_id",user.id),
    supabase.rpc("get_standings",{p_half:"first"}),
    supabase.rpc("get_standings",{p_half:"second"}),
    supabase.rpc("get_standings",{p_half:null}),
    supabase.rpc("get_projected_standings"),
    locked
      ? supabase.from("weekly_submissions").select("user_id,source,profiles(display_name),picks(fixture_id,kind,selected_outcome,stake,odds,is_correct)").eq("competition_week_id",week.id)
      : Promise.resolve({data:[]}),
    previousWeek
      ? supabase.from("weekly_submissions").select("user_id,profiles(display_name),picks(stake,odds,is_correct)").eq("competition_week_id",previousWeek.id)
      : Promise.resolve({data:[]}),
    locked
      ? supabase.from("challenges").select("id,challenger_weekly_net,opponent_weekly_net,challenger:profiles!challenges_challenger_id_fkey(display_name),opponent:profiles!challenges_opponent_id_fkey(display_name)").eq("competition_week_id",week.id)
      : Promise.resolve({data:[]}),
  ]);
  const fixtureRows=(rows??[]) as unknown as FixtureRow[];
  const oddsMultiplier=week.is_casino?1+Number(week.casino_odds_boost??0.05):1;
  const fixtures:Fixture[]=fixtureRows.map(row=>{
    const latest=[...(row.fixture_odds??[])].sort((a,b)=>Date.parse(b.captured_at)-Date.parse(a.captured_at))[0];
    return {id:row.id,home:row.home?.name??"Home",away:row.away?.name??"Away",kickoff:new Intl.DateTimeFormat("en-US",{weekday:"short",hour:"numeric",minute:"2-digit",timeZone:"America/New_York"}).format(new Date(row.kickoff_at)),gotw:row.is_gotw,status:row.status,homeScore:row.home_score,awayScore:row.away_score,odds:{home:oddsMultiplier*Number(latest?.home??1),draw:oddsMultiplier*Number(latest?.draw??1),away:oddsMultiplier*Number(latest?.away??1)}};
  });
  const existing=(submission?.picks??[]) as {fixture_id:string;kind:"gotw"|"own";selected_outcome:Outcome;stake:number}[];
  const standingRows=(overallStandings??[]) as StandingRow[];
  const rank=Math.max(1,standingRows.findIndex(row=>row.user_id===user.id)+1);
  const used=new Set(((challenges??[]) as ChallengeRow[]).map(c=>c.opponent_id));
  const opponentRows=(profiles??[]) as ProfileRow[];
  const fixtureNames=new Map(fixtures.map(f=>[f.id,`${f.home} vs ${f.away}`]));
  const previousResults=((previousSubmissions??[]) as unknown as PreviousSubmissionRow[])
    .map(row=>({
      id:row.user_id,
      name:row.profiles?.display_name??"Player",
      score:Math.round(row.picks.reduce((sum,pick)=>{
        if(pick.is_correct===null)return sum;
        const stake=Number(pick.stake);
        return sum+(pick.is_correct?stake*Number(pick.odds)-stake:-stake);
      },0)*100)/100,
    }))
    .sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name));
  const data:PicksPageData={
    week:{id:week.id,number:week.number,label:week.label,lockAt:week.lock_at,lockLabel:new Intl.DateTimeFormat("en-US",{weekday:"long",hour:"numeric",minute:"2-digit",timeZone:"America/New_York"}).format(new Date(week.lock_at)),competition:week.is_casino?"Casino":week.competition_code==="FAC"?"FA Cup":"Premier League"},
    bankroll:(ledger??[]).reduce((sum,row)=>sum+Number(row.amount),0),rank,fixtures,
    existing:{gotw:existing.find(p=>p.kind==="gotw"),own:existing.find(p=>p.kind==="own"),source:submission?.source},
    opponents:opponentRows.filter(p=>!used.has(p.id)),challengeTokens:Math.max(0,opponentRows.length-used.size),
    locked,
    standings:{
      first:((firstStandings??[]) as StandingRow[]).map(row=>({id:row.user_id,name:row.display_name,score:Number(row.score),me:row.user_id===user.id})),
      second:((secondStandings??[]) as StandingRow[]).map(row=>({id:row.user_id,name:row.display_name,score:Number(row.score),me:row.user_id===user.id})),
      overall:standingRows.map(row=>({id:row.user_id,name:row.display_name,score:Number(row.score),me:row.user_id===user.id})),
      projected:((projectedStandings??overallStandings??[]) as ProjectedStandingRow[]).map(row=>({id:row.user_id,name:row.display_name,score:Number(row.score),me:row.user_id===user.id,seasonProjection:Number(row.season_projection??0)})),
    },
    leaguePicks:((leagueSubmissions??[]) as unknown as LeagueSubmissionRow[]).map(row=>({
      userId:row.user_id,name:row.profiles?.display_name??"Player",source:row.source,
      picks:row.picks.map(p=>({
        fixtureId:p.fixture_id,fixture:fixtureNames.get(p.fixture_id)??"Fixture",kind:p.kind,
        outcome:p.selected_outcome,stake:Number(p.stake),odds:Number(p.odds),isCorrect:p.is_correct,
      })),
    })),
    weekChallenges:((weekChallenges??[]) as unknown as WeekChallengeRow[]).map(challenge=>({
      id:challenge.id,
      challenger:challenge.challenger?.display_name??"Player",
      opponent:challenge.opponent?.display_name??"Player",
      challengerNet:challenge.challenger_weekly_net===null?null:Number(challenge.challenger_weekly_net),
      opponentNet:challenge.opponent_weekly_net===null?null:Number(challenge.opponent_weekly_net),
    })),
    previousWeek:previousWeek&&previousResults.length>1?{
      label:previousWeek.label,
      winner:previousResults[0],
      loser:previousResults[previousResults.length-1],
    }:undefined,
  };
  return <PicksFlow data={data}/>;
}
