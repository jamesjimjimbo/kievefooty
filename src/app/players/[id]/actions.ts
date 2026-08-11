"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {z} from "zod";
import {createClient} from "@/lib/supabase/server";

const uuid=z.string().uuid();
const wallPostSchema=z.object({targetUserId:uuid,body:z.string().trim().min(1).max(180)});

export async function addPlayerWallPost(formData:FormData){
  const targetUserId=String(formData.get("target_user_id")??"");
  const result=wallPostSchema.safeParse({targetUserId,body:String(formData.get("body")??"")});
  if(!result.success){if(uuid.safeParse(targetUserId).success)redirect(`/players/${targetUserId}?wall=invalid`);redirect("/clubhouse")}
  const supabase=await createClient();if(!supabase)redirect(`/players/${targetUserId}?wall=error`);
  const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth/sign-in");
  const {error}=await supabase.from("player_wall_posts").insert({target_user_id:result.data.targetUserId,author_user_id:user.id,body:result.data.body});
  if(error)redirect(`/players/${targetUserId}?wall=error`);
  revalidatePath(`/players/${targetUserId}`);redirect(`/players/${targetUserId}?wall=posted`);
}

export async function deletePlayerWallPost(formData:FormData){
  const targetUserId=String(formData.get("target_user_id")??"");const postId=String(formData.get("post_id")??"");
  if(!uuid.safeParse(targetUserId).success||!uuid.safeParse(postId).success)redirect("/clubhouse");
  const supabase=await createClient();if(!supabase)redirect(`/players/${targetUserId}?wall=error`);
  const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth/sign-in");
  const {error}=await supabase.from("player_wall_posts").delete().eq("id",postId);
  if(error)redirect(`/players/${targetUserId}?wall=error`);
  revalidatePath(`/players/${targetUserId}`);redirect(`/players/${targetUserId}`);
}
