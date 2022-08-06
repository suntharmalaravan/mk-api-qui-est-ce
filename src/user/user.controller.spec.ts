import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { UserController } from './user.controller';
import { UserService } from './user.service';
const testUser = new User('testUser', 'testingPassword');

describe('UserController', () => {
  let controller: UserController;
  let service: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        UserService,
        {
          provide: UserService,
          useValue: {
            findOne: jest.fn().mockImplementation((id: string) =>
              Promise.resolve({
                name: 'testUser',
                password: 'testingPassword',
                score: 0,
                title: 'debutant',
                id,
              }),
            ),
            update: jest.fn().mockImplementation((user: UpdateUserDto) => {
              return Promise.resolve({ id: 'fk', ...user });
            }),
            remove: jest.fn().mockResolvedValue({ deleted: true }),
          },
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
