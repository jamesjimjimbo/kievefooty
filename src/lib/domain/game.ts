import type { Fixture, Outcome } from "../demo-data";

export type LedgerType="weekly_credit"|"weekly_bet_win"|"weekly_bet_loss"|"challenge_win"|"challenge_loss"|"streak_bonus"|"admin_adjustment";
export type LedgerEntry={id:string;userId:string;weekId?:string;type:LedgerType;referenceId:string;amount:number};

export function validateWeeklyStakes(gotw:number,own:number){
  return Number.isFinite(gotw)&&Number.isFinite(own)&&gotw>=1&&own>=1&&gotw+own===10;
}
export function settleWager(stake:number,odds:number,won:boolean){
  if(stake<=0||odds<1)throw new Error("Invalid wager");
  return won?round(stake*odds):0;
}
export function settleChallenge(aNet:number,bNet:number){
  if(aNet===bNet)return {challenger:0,opponent:0,consumed:true};
  return aNet>bNet?{challenger:10,opponent:-10,consumed:true}:{challenger:-10,opponent:10,consumed:true};
}
export function bankroll(entries:Pick<LedgerEntry,"amount">[]){return round(entries.reduce((sum,e)=>sum+e.amount,0))}
export function performance(entries:LedgerEntry[],half?:"first"|"second",weekHalves:Record<string,"first"|"second">={}){
  return round(entries.filter(e=>{
    if(!["weekly_bet_win","weekly_bet_loss",...(half?[]:["challenge_win","challenge_loss"])].includes(e.type))return false;
    return !half||Boolean(e.weekId&&weekHalves[e.weekId]===half);
  }).reduce((s,e)=>s+e.amount,0));
}
export function favorite(f:Fixture):Outcome{return (Object.entries(f.odds) as [Outcome,number][]).sort((a,b)=>a[1]-b[1])[0][0]}
export function createAutoPicks(all:Fixture[]){
  const gotw=all.find(f=>f.gotw);if(!gotw)throw new Error("GOTW missing");
  const other=all.filter(f=>!f.gotw).sort((a,b)=>Math.min(...Object.values(a.odds))-Math.min(...Object.values(b.odds)))[0];
  if(!other)throw new Error("Eligible fixture missing");
  return [{fixtureId:gotw.id,outcome:favorite(gotw),stake:5,source:"auto" as const},{fixtureId:other.id,outcome:favorite(other),stake:5,source:"auto" as const}];
}
export function settleOnce(existing:LedgerEntry[],candidate:LedgerEntry){
  return existing.some(e=>e.type===candidate.type&&e.referenceId===candidate.referenceId)?existing:[...existing,candidate];
}
const round=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
