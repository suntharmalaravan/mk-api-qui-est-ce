import { Test, TestingModule } from '@nestjs/testing';
import { User } from '../user/entities/user.entity';
import AuthController from './auth.controller';
import { AuthService } from './auth.service';
const testUser = new User('testUser');
describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        {
          provide: AuthService,
          useValue: {
            login: jest.fn().mockResolvedValue({
              name: 'testUser',
              password: 'testingPassword',
              score: 0,
              title: 'debutant',
              id: 1,
            }),
            register: jest.fn().mockResolvedValue({ token: 'ok' }),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
