"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { WeeklyReaction } from "@/lib/weekly-conversations";

function refreshConversationPages(){revalidatePath("/clubhouse");revalidatePath("/picks")}

export async function toggleCommentReaction(input:{submissionId:string;reaction:WeeklyReaction}){
  const supabase=await createClient();if(!supabase)return {error:"Supabase is not configured"};
  const {data:{user}}=await supabase.auth.getUser();if(!user)return {error:"Please sign in again"};
  const {error}=await supabase.rpc("toggle_weekly_comment_reaction",{p_submission_id:input.submissionId,p_reaction:input.reaction});
  if(error)return {error:error.message};refreshConversationPages();return {success:true};
}

export async function addCommentReply(input:{submissionId:string;body:string}){
  const body=input.body.trim();if(!body||body.length>180)return {error:"Reply must be 1 to 180 characters"};
  const supabase=await createClient();if(!supabase)return {error:"Supabase is not configured"};
  const {data:{user}}=await supabase.auth.getUser();if(!user)return {error:"Please sign in again"};
  const {error}=await supabase.rpc("add_weekly_comment_reply",{p_submission_id:input.submissionId,p_body:body});
  if(error)return {error:error.message};refreshConversationPages();return {success:true};
}
