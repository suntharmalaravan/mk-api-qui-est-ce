import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  username: string;

  @Column({ default: 0, nullable: false })
  score: number;

  @Column()
  password: string;

  @Column({ default: 'debutant', nullable: false })
  title: string;

  constructor(username?: string, password?: string) {
    this.username = username;
    this.password = password;
  }
}
