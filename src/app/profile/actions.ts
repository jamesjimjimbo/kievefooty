"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
export async function updatePreferences(formData:FormData){
  const supabase=await createClient();if(!supabase)return;
  const {data:{user}}=await supabase.auth.getUser();if(!user)return;
  await supabase.from("email_preferences").upsert({
    user_id:user.id,new_week:formData.has("new_week"),deadline_reminder:formData.has("deadline_reminder"),
    challenge_notification:formData.has("challenge_notification"),weekly_results:formData.has("weekly_results"),
  });
  revalidatePath("/profile");
}
