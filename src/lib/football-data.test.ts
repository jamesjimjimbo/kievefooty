import {describe,expect,it} from "vitest";
import {findProviderMatch,normalizeTeamName,providerFixtureState,type FootballDataMatch} from "./football-data";

const match:FootballDataMatch={
  id:123,utcDate:"2026-08-21T19:00:00Z",status:"FINISHED",
  homeTeam:{name:"Arsenal FC"},awayTeam:{name:"Coventry City FC"},
  score:{fullTime:{home:3,away:1}},
};

describe("football-data result matching",()=>{
  it("normalizes common provider club names",()=>{
    expect(normalizeTeamName("Brighton & Hove Albion FC")).toBe("brighton");
    expect(normalizeTeamName("Hull City AFC")).toBe("hull");
  });

  it("matches by provider id first and team names as a fallback",()=>{
    expect(findProviderMatch({id:"local",provider_match_id:null,kickoff_at:match.utcDate,home:{name:"Arsenal"},away:{name:"Coventry City"}},[match])?.id).toBe(123);
    expect(findProviderMatch({id:"local",provider_match_id:123,kickoff_at:match.utcDate,home:{name:"Wrong"},away:{name:"Wrong"}},[match])?.id).toBe(123);
  });

  it("turns a finished provider match into a final local score",()=>{
    expect(providerFixtureState(match)).toEqual({status:"final",homeScore:3,awayScore:1});
  });
});
