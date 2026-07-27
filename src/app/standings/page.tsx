import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StandingsBoard,type StandingPlayer } from "@/components/standings-board";
import { createClient } from "@/lib/supabase/server";
export const metadata:Metadata={title:"Standings"};export const dynamic="force-dynamic";
export default async function Page(){
  const supabase=await createClient();if(!supabase)redirect("/auth/sign-in");
  const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth/sign-in");
  const [{data:first},{data:second},{data:overall},{data:projected}]=await Promise.all([
    supabase.rpc("get_standings",{p_half:"first"}),supabase.rpc("get_standings",{p_half:"second"}),supabase.rpc("get_standings",{p_half:null}),supabase.rpc("get_projected_standings"),
  ]);
  const map=new Map<string,StandingPlayer>();
  for(const row of overall??[])map.set(row.user_id,{id:row.user_id,name:row.display_name,initials:row.display_name.split(/\s+/).map((x:string)=>x[0]).join("").slice(0,2).toUpperCase(),first:0,second:0,overall:Number(row.score),projected:Number(row.score),seasonProjection:0,me:row.user_id===user.id});
  for(const row of first??[]){const p=map.get(row.user_id);if(p)p.first=Number(row.score)}
  for(const row of second??[]){const p=map.get(row.user_id);if(p)p.second=Number(row.score)}
  for(const row of projected??[]){const p=map.get(row.user_id);if(p){p.projected=Number(row.score);p.seasonProjection=Number(row.season_projection)}}
  return <StandingsBoard players={[...map.values()]}/>;
}
