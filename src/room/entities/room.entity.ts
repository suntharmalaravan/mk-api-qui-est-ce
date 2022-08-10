import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Room {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ default: 'closed' })
  status: string;

  @Column({ default: 0 })
  hostPlayerId: number;

  @Column()
  guestPlayerId: number;

  @Column()
  hostCharacterId: number;

  @Column()
  guestCharacterId: number;
}
