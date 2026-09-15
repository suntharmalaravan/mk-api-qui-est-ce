import { requireAdmin } from '@/lib/auth/session';
import { readLoupeFilters, movementLabel, rewardReason } from '@/lib/loupes';
import { listLoupeLedger, listLoupeRewards, listLoupeWallets } from '@/lib/queries/loupes';
import { csv } from '@/lib/csv';
import { PAGE_SIZE } from '@/lib/params';
export async function GET(request: Request) {
  await requireAdmin();
  const f=readLoupeFilters(Object.fromEntries(new URL(request.url).searchParams));
  let rows: (string | number | null)[][];
  if(f.view==='wallets') {
    const wallets=await listLoupeWallets(f);
    rows=[['Joueur ID','Pseudo','Solde actuel','Gains période','Dépenses période','Opérations période'],...wallets.map(w=>[w.id,w.username,w.balance,w.earned,w.spent,w.operations])];
  } else if(f.view==='journal') {
    const ledger=(await listLoupeLedger(f)).slice(0,PAGE_SIZE);
    rows=[['Opération ID','Date UTC','Joueur ID','Pseudo','Type','Source','Montant','Solde après'],...ledger.map(l=>[l.id,l.createdAt.toISOString(),l.userId,l.username,movementLabel(l.source),l.source,l.amount,l.balanceAfter])];
  } else {
    const rewards=(await listLoupeRewards(f)).slice(0,PAGE_SIZE);
    rows=[['Attribution ID','Date UTC','Joueur ID','Pseudo','Duel ID','Total crédité','Crédit duel','XP','Motif','Acquittée le'],...rewards.map(r=>[r.id,r.createdAt.toISOString(),r.userId,r.username,r.matchId,r.payload.amount??0,r.payload.duelAmount??0,r.payload.xp??0,rewardReason(r.payload.breakdown?.reason??null,r.payload.breakdown?.factor),r.acknowledgedAt?.toISOString()??null])];
  }
  return new Response(csv(rows),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="loupes-${f.view}.csv"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
