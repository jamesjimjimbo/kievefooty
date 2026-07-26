import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const protectedRoutes=["/picks","/standings","/season","/profile","/admin"];

export async function proxy(request:NextRequest){
  let response=NextResponse.next({request});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key)return response;
  const supabase=createServerClient(url,key,{cookies:{
    getAll:()=>request.cookies.getAll(),
    setAll(items){
      items.forEach(({name,value})=>request.cookies.set(name,value));
      response=NextResponse.next({request});
      items.forEach(({name,value,options})=>response.cookies.set(name,value,options));
    },
  }});
  const {data:{user}}=await supabase.auth.getUser();
  const path=request.nextUrl.pathname;
  if(!user&&protectedRoutes.some(route=>path.startsWith(route))){
    const redirect=request.nextUrl.clone();redirect.pathname="/auth/sign-in";redirect.searchParams.set("next",path);
    return NextResponse.redirect(redirect);
  }
  if(user&&path.startsWith("/auth/")){
    const redirect=request.nextUrl.clone();redirect.pathname="/picks";redirect.search="";
    return NextResponse.redirect(redirect);
  }
  return response;
}

export const config={matcher:["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]};
