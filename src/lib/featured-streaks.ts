export type FeaturedStreakSubmission={
  user_id:string;
  week:{number:number;start_date:string}|null;
  picks:{kind:string;is_correct:boolean|null}[];
};

export function featuredStreakMap(submissions:FeaturedStreakSubmission[]){
  const streaks=new Map<string,number>();
  const ordered=[...submissions].sort((a,b)=>{
    const date=(a.week?.start_date??"").localeCompare(b.week?.start_date??"");
    return date||((a.week?.number??0)-(b.week?.number??0));
  });
  for(const submission of ordered){
    const featured=(submission.picks??[]).find(pick=>pick.kind==="gotw");
    if(featured?.is_correct===true)streaks.set(submission.user_id,(streaks.get(submission.user_id)??0)+1);
    else if(featured?.is_correct===false)streaks.set(submission.user_id,0);
  }
  return streaks;
}
