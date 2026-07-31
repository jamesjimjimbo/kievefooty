"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isValidLeagueInviteCode } from "@/lib/auth/invite";

function value(formData:FormData,key:string){return String(formData.get(key)??"").trim()}
function signUpErrorMessage(message:unknown){
  if(typeof message==="string"&&message.trim()&&message.trim()!=="{}"){
    if(message.toLowerCase().includes("database error"))return "We couldn’t create that account. Please try again in a moment.";
    return message;
  }
  return "We couldn’t create that account. Please try again in a moment.";
}

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
  if(error)redirect(`/auth/sign-up?error=${encodeURIComponent(signUpErrorMessage(error.message))}`);
  redirect("/auth/sign-in?message=Check+your+email+to+confirm+your+account");
}
