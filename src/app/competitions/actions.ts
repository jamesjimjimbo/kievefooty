"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function saveSeasonEntry(input:{marketId:string;optionIds:string[]}){
  const supabase=await createClient();
  if(!supabase)return {error:"Supabase is not configured"};
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return {error:"Please sign in again"};
  const {error}=await supabase.rpc("submit_season_market_entry",{
    p_market_id:input.marketId,
    p_option_ids:input.optionIds,
  });
  if(error)return {error:error.message};
  revalidatePath("/competitions");
  revalidatePath("/picks");
  revalidatePath("/standings");
  return {success:true};
}
