"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function savePlayerProfile(formData:FormData){
  const supabase=await createClient();if(!supabase)redirect("/profile?error=Supabase+is+not+configured");
  const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth/sign-in");
  const displayName=String(formData.get("display_name")??"").trim();
  const favoriteTeam=String(formData.get("favorite_team")??"").trim();
  const bio=String(formData.get("bio")??"").trim();
  const motto=String(formData.get("motto")??"").trim();
  if(displayName.length<1||displayName.length>50)redirect("/profile?error=Display+name+must+be+1+to+50+characters");
  if(bio.length>240||motto.length>80)redirect("/profile?error=Your+bio+or+motto+is+too+long");
  const changes:Record<string,string|null>={display_name:displayName,favorite_team:favoriteTeam||null,bio:bio||null,motto:motto||null,profile_completed_at:new Date().toISOString()};
  const {error}=await supabase.from("profiles").update(changes).eq("id",user.id);
  if(error)redirect(`/profile?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/profile");revalidatePath("/clubhouse");redirect("/profile?saved=1");
}

export async function updatePreferences(formData:FormData){
  const supabase=await createClient();if(!supabase)return;
  const {data:{user}}=await supabase.auth.getUser();if(!user)return;
  await supabase.from("email_preferences").upsert({
    user_id:user.id,new_week:formData.has("new_week"),deadline_reminder:formData.has("deadline_reminder"),
    challenge_notification:formData.has("challenge_notification"),weekly_results:formData.has("weekly_results"),
  });
  revalidatePath("/profile");
}
