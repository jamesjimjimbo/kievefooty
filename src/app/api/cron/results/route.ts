import {NextRequest,NextResponse} from "next/server";
import {syncWeeklyResults} from "@/lib/result-sync";
import {createAdminClient} from "@/lib/supabase/admin";

export const dynamic="force-dynamic";
export const maxDuration=30;

export async function GET(request:NextRequest){
  const secret=process.env.CRON_SECRET;
  if(!secret||request.headers.get("authorization")!==`Bearer ${secret}`){
    return NextResponse.json({error:"Unauthorized"},{status:401});
  }
  const apiKey=process.env.FOOTBALL_DATA_API_KEY;
  if(!apiKey)return NextResponse.json({error:"Football data is not configured"},{status:503});
  try{
    const result=await syncWeeklyResults(createAdminClient(),apiKey);
    return NextResponse.json({ok:true,...result});
  }catch(error){
    const message=error instanceof Error?error.message:"Result sync failed";
    return NextResponse.json({ok:false,error:message},{status:500});
  }
}
