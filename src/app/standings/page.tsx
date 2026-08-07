import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StandingsBoard,type StandingPlayer } from "@/components/standings-board";
import { createClient } from "@/lib/supabase/server";
export const metadata:Metadata={title:"Standings"};export const dynamic="force-dynamic";
type AccuracySubmission={user_id:string;picks:{is_correct:boolean|null}[]};
type HistoryRow={
  week_number:number;week_label:string;week_end:string;user_id:string;display_name:string;
  first_score:number|string;second_score:number|string;full_score:number|string;accuracy_rate:number|string;
};
export default async function Page(){
  const supabase=await createClient();if(!supabase)redirect("/auth/sign-in");
  const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth/sign-in");
  const [{data:first},{data:second},{data:overall},{data:projected},{data:accuracyData},{data:historyData},{data:profiles}]=await Promise.all([
    supabase.rpc("get_standings",{p_half:"first"}),supabase.rpc("get_standings",{p_half:"second"}),supabase.rpc("get_standings",{p_half:null}),supabase.rpc("get_projected_standings"),
    supabase.from("weekly_submissions").select("user_id,picks(is_correct)"),
    supabase.rpc("get_standings_history"),
    supabase.from("profiles").select("id,crest_url"),
  ]);
  const crestMap=new Map((profiles??[]).map(profile=>[profile.id,profile.crest_url as string|null]));
  const map=new Map<string,StandingPlayer>();
  for(const row of overall??[])map.set(row.user_id,{id:row.user_id,name:row.display_name,crestUrl:crestMap.get(row.user_id)??null,initials:row.display_name.split(/\s+/).map((x:string)=>x[0]).join("").slice(0,2).toUpperCase(),first:0,second:0,overall:Number(row.score),projected:Number(row.score),seasonProjection:0,accuracyCorrect:0,accuracyTotal:0,me:row.user_id===user.id});
  for(const row of first??[]){const p=map.get(row.user_id);if(p)p.first=Number(row.score)}
  for(const row of second??[]){const p=map.get(row.user_id);if(p)p.second=Number(row.score)}
  for(const row of projected??[]){const p=map.get(row.user_id);if(p){p.projected=Number(row.score);p.seasonProjection=Number(row.season_projection)}}
  for(const submission of (accuracyData??[]) as unknown as AccuracySubmission[]){
    const player=map.get(submission.user_id);if(!player)continue;
    for(const pick of submission.picks??[]){if(pick.is_correct===null)continue;player.accuracyTotal+=1;if(pick.is_correct)player.accuracyCorrect+=1}
  }
  const historyRows=((historyData??[]) as HistoryRow[]).map(row=>({
    ...row,
    first_score:Number(row.first_score),second_score:Number(row.second_score),
    full_score:Number(row.full_score),accuracy_rate:Number(row.accuracy_rate),
  }));
  return <StandingsBoard players={[...map.values()]} history={historyRows}/>;
}
