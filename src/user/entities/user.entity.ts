import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  username: string;

  @Column()
  public_identifier: string;

  @Column({ default: 0, nullable: false })
  score: number;

  @Column({ type: 'varchar', nullable: true })
  password: string | null;

  @Column({ default: 'debutant', nullable: false })
  title: string;

  @Column({ nullable: true })
  image_url: string;

  constructor(username?: string, password?: string) {
    this.username = username;
    this.password = password;
  }
}
