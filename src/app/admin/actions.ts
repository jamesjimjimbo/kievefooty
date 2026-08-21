"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { syncWeeklyResults as runResultSync } from "@/lib/result-sync";

async function adminClient(){
  const supabase=await createClient();
  if(!supabase)throw new Error("Supabase is not configured");
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)throw new Error("Authentication required");
  const {data:profile}=await supabase.from("profiles").select("is_admin").eq("id",user.id).single();
  if(!profile?.is_admin)throw new Error("Admin access required");
  return supabase;
}

export async function setGameOfWeek(formData:FormData){
  const weekId=String(formData.get("weekId")??"");
  const fixtureId=String(formData.get("fixtureId")??"");
  const supabase=await adminClient();
  const {error:clearError}=await supabase.from("fixtures").update({is_gotw:false}).eq("competition_week_id",weekId);
  if(clearError)throw new Error(clearError.message);
  const {error}=await supabase.from("fixtures").update({is_gotw:true,is_eligible:true}).eq("id",fixtureId).eq("competition_week_id",weekId);
  if(error)throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/picks");
}

export async function toggleFixtureEligibility(formData:FormData){
  const fixtureId=String(formData.get("fixtureId")??"");
  const next=String(formData.get("next"))==="true";
  const supabase=await adminClient();
  const {error}=await supabase.from("fixtures").update({is_eligible:next,...(!next?{is_gotw:false}:{})}).eq("id",fixtureId);
  if(error)throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/picks");
}

export async function syncLockToFirstKickoff(formData:FormData){
  const weekId=String(formData.get("weekId")??"");
  const supabase=await adminClient();
  const {data:fixture,error:fixtureError}=await supabase.from("fixtures").select("kickoff_at").eq("competition_week_id",weekId).eq("is_eligible",true).order("kickoff_at").limit(1).maybeSingle();
  if(fixtureError)throw new Error(fixtureError.message);
  if(!fixture)throw new Error("Choose at least one eligible fixture first");
  const {error}=await supabase.from("competition_weeks").update({lock_at:fixture.kickoff_at}).eq("id",weekId);
  if(error)throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/picks");
}

function normalizeTeamName(name:string){
  const aliases:Record<string,string>={
    "AFC Bournemouth":"Bournemouth",
    "Brighton & Hove Albion FC":"Brighton & Hove Albion",
    "Coventry City FC":"Coventry City",
    "Sunderland AFC":"Sunderland",
    "Tottenham Hotspur FC":"Tottenham Hotspur",
    "Manchester City FC":"Manchester City",
    "Manchester United FC":"Manchester United",
    "Newcastle United FC":"Newcastle United",
    "Nottingham Forest FC":"Nottingham Forest",
    "Ipswich Town FC":"Ipswich Town",
    "Leeds United FC":"Leeds United",
    "Hull City AFC":"Hull City",
  };
  return aliases[name]??name.replace(/ FC$/,"");
}

export async function refreshLeagueTable(){
  const supabase=await adminClient();
  const apiKey=process.env.FOOTBALL_DATA_API_KEY;
  if(!apiKey)throw new Error("Add FOOTBALL_DATA_API_KEY to enable table forecasts");
  const response=await fetch("https://api.football-data.org/v4/competitions/PL/standings",{
    headers:{"X-Auth-Token":apiKey},
    cache:"no-store",
  });
  if(!response.ok)throw new Error(`Standings provider returned ${response.status}`);
  const payload=await response.json() as {season?:{startDate?:string};standings?:{type:string;table:{position:number;playedGames:number;points:number;team:{name:string}}[]}[]};
  const table=payload.standings?.find(standing=>standing.type==="TOTAL")?.table;
  if(!table?.length)throw new Error("No Premier League table was returned");
  const capturedAt=new Date().toISOString();
  const {error}=await supabase.from("league_table_snapshots").insert(table.map(row=>({
    season:payload.season?.startDate?.slice(0,4)??"2026",
    captured_at:capturedAt,
    provider:"football-data.org",
    position:row.position,
    team_name:normalizeTeamName(row.team.name),
    played:row.playedGames,
    points:row.points,
  })));
  if(error)throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/picks");
  revalidatePath("/standings");
}

export async function syncMatchResults(){
  const supabase=await adminClient();
  const apiKey=process.env.FOOTBALL_DATA_API_KEY;
  if(!apiKey)throw new Error("Add FOOTBALL_DATA_API_KEY to enable result syncing");
  await runResultSync(supabase,apiKey);
  revalidatePath("/admin");
  revalidatePath("/picks");
  revalidatePath("/standings");
  revalidatePath("/season");
}

export async function overrideFixtureResult(formData:FormData){
  const fixtureId=String(formData.get("fixtureId")??"");
  const weekId=String(formData.get("weekId")??"");
  const homeScore=Number(formData.get("homeScore"));
  const awayScore=Number(formData.get("awayScore"));
  if(!fixtureId||!weekId||!Number.isInteger(homeScore)||homeScore<0||!Number.isInteger(awayScore)||awayScore<0){
    throw new Error("Enter valid final scores");
  }
  const supabase=await adminClient();
  const {error}=await supabase.from("fixtures").update({
    home_score:homeScore,away_score:awayScore,status:"final",
    result_source:"admin",result_updated_at:new Date().toISOString(),
  }).eq("id",fixtureId).eq("competition_week_id",weekId);
  if(error)throw new Error(error.message);
  const {error:settleError}=await supabase.rpc("settle_competition_week",{p_week_id:weekId});
  if(settleError)throw new Error(settleError.message);
  revalidatePath("/admin");
  revalidatePath("/picks");
  revalidatePath("/standings");
  revalidatePath("/season");
}
