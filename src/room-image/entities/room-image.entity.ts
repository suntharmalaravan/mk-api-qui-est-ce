import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class RoomImage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  fk_room: number;

  @Column()
  fk_image: number;
}
