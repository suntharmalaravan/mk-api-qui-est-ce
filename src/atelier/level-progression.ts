/** Database thresholds are loaded at startup. Existing XP and bonus IDs are preserved. */
export type LevelThreshold = { id: number; score: number };
const DEFAULT_SCORES = [0,10,20,40,60,80,110,140,170,210,250,290,340,400,460,530,620,720];
let levels: LevelThreshold[] = DEFAULT_SCORES.map((score,index)=>({id:index+1,score}));
export function configureLevels(rows: LevelThreshold[]) {
  if(!rows.length) return;
  if(rows[0].id !== 1 || rows[0].score !== 0 || rows.some((row,index)=>!Number.isSafeInteger(row.id) || !Number.isSafeInteger(row.score) || row.score<0 || (index>0 && (row.score<=rows[index-1].score || row.id<=rows[index-1].id)))) throw new Error('Invalid level progression');
  levels=rows.map(row=>({id:row.id,score:row.score}));
}
export function levelThresholds() { return levels; }
export function progressionForScore(score: number) {
  const totalXp = Number.isFinite(score)?Math.max(0,score):0;
  const index = Math.max(0,levels.findIndex((row,i)=>totalXp>=row.score && (!levels[i+1] || totalXp<levels[i+1].score)));
  const current=levels[index],next=levels[index+1];
  const xpInLevel=totalXp-current.score,xpForNext=next?next.score-current.score:null;
  return { level:current.id,totalXp,minScore:current.score,maxScore:next?.score??null,nextLevel:next?.id??null,xpInLevel,xpForNext,progress:xpForNext===null?1:Math.min(1,xpInLevel/xpForNext) };
}
