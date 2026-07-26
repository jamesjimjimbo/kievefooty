"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { weeklyPickSchema } from "@/lib/validation/picks";

export async function saveWeeklyPicks(input:unknown){
  const parsed=weeklyPickSchema.safeParse(input);
  if(!parsed.success)return {error:parsed.error.issues[0]?.message??"Invalid picks"};
  const supabase=await createClient();if(!supabase)return {error:"Supabase is not configured"};
  const {data:{user}}=await supabase.auth.getUser();if(!user)return {error:"Please sign in again"};
  const v=parsed.data;
  const {error}=await supabase.rpc("submit_weekly_picks",{
    p_week_id:v.weekId,p_gotw_fixture_id:v.gotwFixtureId,p_gotw_outcome:v.gotwOutcome,p_gotw_stake:v.gotwStake,
    p_own_fixture_id:v.ownFixtureId,p_own_outcome:v.ownOutcome,p_own_stake:v.ownStake,
  });
  if(error)return {error:error.message};
  revalidatePath("/picks");return {success:true};
}

export async function createChallenge(input:{weekId:string;opponentId:string}){
  const supabase=await createClient();if(!supabase)return {error:"Supabase is not configured"};
  const {data:{user}}=await supabase.auth.getUser();if(!user)return {error:"Please sign in again"};
  const {error}=await supabase.from("challenges").insert({competition_week_id:input.weekId,challenger_id:user.id,opponent_id:input.opponentId});
  if(error)return {error:error.message};
  revalidatePath("/picks");return {success:true};
}
