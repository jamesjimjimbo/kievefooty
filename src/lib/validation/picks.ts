import { z } from "zod";
export const weeklyPickSchema=z.object({
  weekId:z.string().uuid(),gotwPickId:z.string().uuid(),ownPickId:z.string().uuid(),
  gotwStake:z.number().int().min(1).max(9),ownStake:z.number().int().min(1).max(9),
}).refine(v=>v.gotwStake+v.ownStake===10,{message:"Weekly stakes must total exactly 10"});
