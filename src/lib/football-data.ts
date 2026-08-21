export type FootballDataMatch={
  id:number;
  utcDate:string;
  status:string;
  homeTeam:{name:string;shortName?:string};
  awayTeam:{name:string;shortName?:string};
  score?:{
    fullTime?:{home?:number|null;away?:number|null;homeTeam?:number|null;awayTeam?:number|null};
  };
};

export type LocalFixtureMatch={
  id:string;
  provider_match_id:number|null;
  kickoff_at:string;
  home:{name:string}|null;
  away:{name:string}|null;
};

const TEAM_ALIASES:Record<string,string>={
  "afc bournemouth":"bournemouth",
  "brighton hove albion":"brighton",
  "brighton and hove albion":"brighton",
  "coventry city":"coventry",
  "hull city":"hull",
  "ipswich town":"ipswich",
  "leeds united":"leeds",
  "manchester city":"manchester city",
  "manchester united":"manchester united",
  "newcastle united":"newcastle",
  "nottingham forest":"nottingham forest",
  "sunderland afc":"sunderland",
  "tottenham hotspur":"tottenham",
  "west ham united":"west ham",
  "wolverhampton wanderers":"wolves",
};

export function normalizeTeamName(name:string){
  const normalized=name
    .toLocaleLowerCase("en-US")
    .replace(/&/g," and ")
    .replace(/\b(fc|afc)\b/g," ")
    .replace(/[^a-z0-9]+/g," ")
    .trim()
    .replace(/\s+/g," ");
  return TEAM_ALIASES[normalized]??normalized;
}

export function findProviderMatch(fixture:LocalFixtureMatch,matches:FootballDataMatch[]){
  if(fixture.provider_match_id!==null){
    const byId=matches.find(match=>match.id===fixture.provider_match_id);
    if(byId)return byId;
  }
  if(!fixture.home||!fixture.away)return undefined;
  const home=normalizeTeamName(fixture.home.name);
  const away=normalizeTeamName(fixture.away.name);
  return matches.find(match=>
    normalizeTeamName(match.homeTeam.name)===home&&normalizeTeamName(match.awayTeam.name)===away
  );
}

export function providerFixtureState(match:FootballDataMatch){
  const status=match.status.toUpperCase();
  const fullTime=match.score?.fullTime;
  const home=fullTime?.home??fullTime?.homeTeam??null;
  const away=fullTime?.away??fullTime?.awayTeam??null;
  if((status==="FINISHED"||status==="AWARDED")&&home!==null&&away!==null){
    return {status:"final" as const,homeScore:home,awayScore:away};
  }
  if(["IN_PLAY","PAUSED","EXTRA_TIME","PENALTY_SHOOTOUT"].includes(status)){
    return {status:"live" as const,homeScore:home,awayScore:away};
  }
  if(["POSTPONED","SUSPENDED","CANCELLED"].includes(status)){
    return {status:"postponed" as const,homeScore:home,awayScore:away};
  }
  return {status:"scheduled" as const,homeScore:home,awayScore:away};
}

export async function fetchCompetitionMatches({competition,dateFrom,dateTo,apiKey}:{competition:string;dateFrom:string;dateTo:string;apiKey:string}){
  const endpoint=new URL(`https://api.football-data.org/v4/competitions/${competition}/matches`);
  endpoint.searchParams.set("dateFrom",dateFrom);
  endpoint.searchParams.set("dateTo",exclusiveDayAfter(dateTo));
  const response=await fetch(endpoint,{headers:{"X-Auth-Token":apiKey},cache:"no-store"});
  if(!response.ok)throw new Error(`football-data.org returned ${response.status}`);
  const payload=await response.json() as {matches?:FootballDataMatch[]};
  return payload.matches??[];
}

function exclusiveDayAfter(date:string){
  const value=new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate()+1);
  return value.toISOString().slice(0,10);
}
