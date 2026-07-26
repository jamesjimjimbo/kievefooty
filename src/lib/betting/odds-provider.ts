import type { Fixture } from "@/lib/demo-data";
export interface OddsProvider {
  getFixtures(weekId:string):Promise<Fixture[]>;
  getOdds(fixtureId:string):Promise<Fixture["odds"]>;
}
export class SeededOddsProvider implements OddsProvider {
  constructor(private readonly fixtures:Fixture[]){}
  async getFixtures(){return this.fixtures}
  async getOdds(id:string){const fixture=this.fixtures.find(f=>f.id===id);if(!fixture)throw new Error("Fixture not found");return fixture.odds}
}
