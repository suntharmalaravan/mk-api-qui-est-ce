import { progressionForScore } from './level-progression';
import { rankCatalog,rankForScore } from './loupe-economy';
describe('XP, levels and grades',()=>{
 it('shows XP within the level and advances only at its threshold',()=>{
  expect(progressionForScore(19)).toMatchObject({level:2,xpInLevel:9,xpForNext:10,nextLevel:3});
  expect(progressionForScore(20)).toMatchObject({level:3,xpInLevel:0,xpForNext:20,nextLevel:4});
  expect(progressionForScore(24).progress).toBe(.2);
 });
 it('assigns every grade to an existing level',()=>{
  expect(rankCatalog().map(r=>r.minLevel)).toEqual([1,3,5,8,11,14,16,18]);
  for(const r of rankCatalog())expect(rankForScore(r.score).id).toBe(r.id);
  expect(rankForScore(719).id).toBe('maitre');expect(rankForScore(720).id).toBe('legende');
  expect(progressionForScore(800)).toMatchObject({level:18,nextLevel:null,maxScore:null,progress:1});
 });
});
