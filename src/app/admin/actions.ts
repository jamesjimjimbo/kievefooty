"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
