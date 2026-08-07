export type WeeklyReaction="fire"|"trash"|"eyes";
export type WeeklyConversation={
  submissionId:string;userId:string;name:string;crestUrl:string|null;commentary:string;
  reactions:{userId:string;reaction:WeeklyReaction}[];
  replies:{id:string;userId:string;name:string;crestUrl:string|null;body:string;createdAt:string}[];
};
