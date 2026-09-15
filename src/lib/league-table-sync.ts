import type {SupabaseClient} from "@supabase/supabase-js";

const TEAM_ALIASES:Record<string,string>={
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

function displayTeamName(name:string){
  return TEAM_ALIASES[name]??name.replace(/ FC$/,'');
}

export type LeagueTableSyncSummary={capturedAt:string;clubs:number};

export async function syncLeagueTable(supabase:SupabaseClient,apiKey:string):Promise<LeagueTableSyncSummary>{
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
    season:payload.season?.startDate?.slice(0,4)??String(new Date().getUTCFullYear()),
    captured_at:capturedAt,
    provider:"football-data.org",
    position:row.position,
    team_name:displayTeamName(row.team.name),
    played:row.playedGames,
    points:row.points,
  })));
  if(error)throw new Error(error.message);
  return {capturedAt,clubs:table.length};
}
