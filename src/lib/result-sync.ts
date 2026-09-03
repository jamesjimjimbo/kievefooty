import type {SupabaseClient} from "@supabase/supabase-js";
import {fetchCompetitionMatches,findProviderMatch,providerFixtureState,type LocalFixtureMatch} from "@/lib/football-data";

type ResultFixture=LocalFixtureMatch&{status:string;home_score:number|null;away_score:number|null};
type ResultWeek={
  id:string;label:string;start_date:string;end_date:string;competition_code:string;status:string;
  fixtures:ResultFixture[];
};

export type ResultSyncSummary={
  matchedFixtures:number;finalFixtures:number;settledWeeks:number;autoSubmissions:number;
  weeks:{id:string;label:string;matched:number;remaining:number;settled:boolean;autoSubmitted:number}[];
};

export async function syncWeeklyResults(supabase:SupabaseClient,apiKey:string):Promise<ResultSyncSummary>{
  const {data:run,error:runError}=await supabase.from("result_sync_runs").insert({status:"running"}).select("id").single();
  if(runError)throw new Error(`Could not start result sync: ${runError.message}`);
  try{
    const revisitFrom=new Date();
    revisitFrom.setUTCDate(revisitFrom.getUTCDate()-14);
    const {data,error}=await supabase
      .from("competition_weeks")
      .select("id,label,start_date,end_date,competition_code,status,fixtures(id,provider_match_id,kickoff_at,status,home_score,away_score,home:teams!fixtures_home_team_id_fkey(name),away:teams!fixtures_away_team_id_fkey(name))")
      .in("status",["open","locked","settled"])
      .eq("is_active_betting_week",true)
      .lte("lock_at",new Date().toISOString())
      .gte("end_date",revisitFrom.toISOString().slice(0,10))
      .order("start_date");
    if(error)throw new Error(error.message);
    const weeks=(data??[]) as unknown as ResultWeek[];
    const summary:ResultSyncSummary={matchedFixtures:0,finalFixtures:0,settledWeeks:0,autoSubmissions:0,weeks:[]};

    for(const week of weeks){
      let autoSubmitted=0;
      if(week.status!=="settled"){
        const {data:autoPickResult,error:autoPickError}=await supabase.rpc("auto_submit_missing_weekly_picks",{p_week_id:week.id});
        if(autoPickError)throw new Error(`Could not create auto-picks for ${week.label}: ${autoPickError.message}`);
        autoSubmitted=Number((autoPickResult as {created?:number}|null)?.created??0);
        summary.autoSubmissions+=autoSubmitted;
      }
      const providerMatches=await fetchCompetitionMatches({
        competition:week.competition_code,dateFrom:week.start_date,dateTo:week.end_date,apiKey,
      });
      let matched=0;
      for(const fixture of week.fixtures){
        const providerMatch=findProviderMatch(fixture,providerMatches);
        if(!providerMatch)continue;
        matched+=1;summary.matchedFixtures+=1;
        const state=providerFixtureState(providerMatch);
        if(state.status==="final")summary.finalFixtures+=1;
        const update:Record<string,unknown>={
          provider_match_id:providerMatch.id,
          status:state.status,
          result_source:"football-data.org",
          result_updated_at:new Date().toISOString(),
        };
        if(state.homeScore!==null)update.home_score=state.homeScore;
        if(state.awayScore!==null)update.away_score=state.awayScore;
        const {error:updateError}=await supabase.from("fixtures").update(update).eq("id",fixture.id);
        if(updateError)throw new Error(`Could not update ${week.label}: ${updateError.message}`);
      }
      const {data:settlement,error:settlementError}=await supabase.rpc("settle_competition_week",{p_week_id:week.id});
      if(settlementError)throw new Error(`Could not settle ${week.label}: ${settlementError.message}`);
      const result=(settlement??{}) as {settled?:boolean;remaining?:number};
      if(result.settled)summary.settledWeeks+=1;
      summary.weeks.push({id:week.id,label:week.label,matched,remaining:Number(result.remaining??0),settled:Boolean(result.settled),autoSubmitted});
    }

    const {error:finishError}=await supabase.from("result_sync_runs").update({
      finished_at:new Date().toISOString(),status:"success",
      matched_fixtures:summary.matchedFixtures,final_fixtures:summary.finalFixtures,
      settled_weeks:summary.settledWeeks,details:{weeks:summary.weeks},
    }).eq("id",run.id);
    if(finishError)throw new Error(finishError.message);
    return summary;
  }catch(error){
    const message=error instanceof Error?error.message:"Unknown result sync error";
    await supabase.from("result_sync_runs").update({finished_at:new Date().toISOString(),status:"error",error_message:message}).eq("id",run.id);
    throw error;
  }
}
