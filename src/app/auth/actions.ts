"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isValidLeagueInviteCode } from "@/lib/auth/invite";

function value(formData:FormData,key:string){return String(formData.get(key)??"").trim()}

export async function signIn(formData:FormData){
  const supabase=await createClient();if(!supabase)redirect("/auth/sign-in?error=Supabase+is+not+configured");
  const {error}=await supabase.auth.signInWithPassword({email:value(formData,"email"),password:value(formData,"password")});
  if(error)redirect(`/auth/sign-in?error=${encodeURIComponent(error.message)}`);
  redirect(value(formData,"next")||"/picks");
}

export async function signUp(formData:FormData){
  const supabase=await createClient();if(!supabase)redirect("/auth/sign-up?error=Supabase+is+not+configured");
  const inviteCode=value(formData,"invite_code");
  if(!isValidLeagueInviteCode(inviteCode))redirect("/auth/sign-up?error=That+invite+code+isn%27t+valid");
  const origin=value(formData,"origin");
  const {error}=await supabase.auth.signUp({
    email:value(formData,"email"),password:value(formData,"password"),
    options:{
      data:{display_name:value(formData,"display_name"),league_invite_code:inviteCode},
      emailRedirectTo:`${origin}/auth/callback`,
    },
  });
  if(error)redirect(`/auth/sign-up?error=${encodeURIComponent(error.message)}`);
  redirect("/auth/sign-in?message=Check+your+email+to+confirm+your+account");
}
