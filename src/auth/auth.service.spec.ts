import { AuthService } from './auth.service';
import * as bcrypt from 'bcrypt';
describe('AuthService identity and credentials', () => {
  const users = { findOneUsername: jest.fn(), create: jest.fn() };
  const service = new AuthService(users as any);
  beforeEach(() => jest.resetAllMocks());
  it('rejects an existing identifier before hashing', async () => {
    users.findOneUsername.mockResolvedValue({ id: 1 });
    await expect(
      service.register({ username: 'Existing', password: 'secret!' }),
    ).rejects.toMatchObject({ status: 409 });
    expect(users.create).not.toHaveBeenCalled();
  });
  it('arbitrates a concurrent registration through the database constraint', async () => {
    users.findOneUsername.mockResolvedValue(null);
    users.create.mockRejectedValue({
      code: '23505',
      constraint: 'user_public_identifier_unique',
    });
    await expect(
      service.register({ username: ' NewUser ', password: 'secret!' }),
    ).rejects.toMatchObject({ status: 409 });
    expect(users.create.mock.calls[0][0].username).toBe('NewUser');
    expect(
      await bcrypt.compare('secret!', users.create.mock.calls[0][0].password),
    ).toBe(true);
  });
  it('does not mutate the request object or return a plain password', async () => {
    const input = { username: 'APlayer', password: 'secret!' };
    users.findOneUsername.mockResolvedValue(null);
    users.create.mockImplementation((value) => ({ ...value, id: 1 }));
    await service.register(input);
    expect(input.password).toBe('secret!');
  });
  it('rejects a provider-only account without throwing a bcrypt error', async () => {
    users.findOneUsername.mockResolvedValue({ id: 1, password: null });
    await expect(
      service.login({ username: 'Provider', password: 'secret!' }),
    ).rejects.toMatchObject({ status: 401 });
  });
  it('returns the same error for an unknown account and a wrong password', async () => {
    users.findOneUsername.mockResolvedValue(null);
    await expect(
      service.login({ username: 'Unknown', password: 'wrong' }),
    ).rejects.toThrow('Identifiant ou mot de passe incorrect.');
    users.findOneUsername.mockResolvedValue({
      id: 1,
      password: await bcrypt.hash('secret', 4),
    });
    await expect(
      service.login({ username: 'Known', password: 'wrong' }),
    ).rejects.toThrow('Identifiant ou mot de passe incorrect.');
  });
});
