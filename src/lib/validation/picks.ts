import { z } from "zod";
export const weeklyPickSchema=z.object({
  weekId:z.string().uuid(),gotwFixtureId:z.string().uuid(),ownFixtureId:z.string().uuid(),
  gotwOutcome:z.enum(["home","draw","away"]),ownOutcome:z.enum(["home","draw","away"]),
  gotwStake:z.number().int().min(1).max(9),ownStake:z.number().int().min(1).max(9),
}).refine(v=>v.gotwStake+v.ownStake===10,{message:"Weekly stakes must total exactly 10"});
