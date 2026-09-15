import { duelReward, rankForScore } from "./loupe-economy";
import { UserService } from "../user/user.service";
const input = {
  won: true,
  seconds: 45,
  misses: 0,
  sameOpponentToday: 0,
  earnedToday: 0,
};
describe("server loupe economy", () => {
  it("rewards speed and precision separately", () => {
    expect(duelReward(input).amount).toBe(26);
    expect(duelReward({ ...input, seconds: 90 }).amount).toBe(22);
    expect(duelReward({ ...input, seconds: 180, misses: 1 }).amount).toBe(14);
    expect(duelReward({ ...input, won: false }).amount).toBe(3);
  });
  it("rejects instant games and limits repeated opponents", () => {
    expect(duelReward({ ...input, seconds: 14 }).eligible).toBe(false);
    expect(duelReward({ ...input, seconds: NaN }).amount).toBe(0);
    expect(duelReward({ ...input, sameOpponentToday: 3 }).amount).toBe(6);
    expect(duelReward({ ...input, sameOpponentToday: 5 }).eligible).toBe(false);
  });
  it("clamps at the remaining daily allowance", () => {
    expect(duelReward({ ...input, earnedToday: 115 })).toMatchObject({
      amount: 5,
      capped: true,
    });
    expect(duelReward({ ...input, earnedToday: 140 }).amount).toBe(0);
  });
  it("uses permanent XP for public grades", () => {
    expect(rankForScore(39).id).toBe("recrue");
    expect(rankForScore(40).id).toBe("observateur");
    expect(rankForScore(10000).id).toBe("legende");
  });
  it("never lets a client rewrite progression", async () => {
    const repository: any = { update: jest.fn() };
    await expect(
      new UserService(repository, {} as any).updateScore(1, 99999)
    ).rejects.toMatchObject({ status: 403 });
    expect(repository.update).not.toHaveBeenCalled();
  });
});
