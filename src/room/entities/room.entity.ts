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
  hostplayerid: number;

  @Column()
  guestplayerid: number;

  @Column()
  hostcharacterid: number;

  @Column()
  guestcharacterid: number;
}
