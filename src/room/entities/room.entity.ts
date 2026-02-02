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

  @Column()
  category: string;

  @Column({ default: 'category' })
  mode: string; // 'category' | 'custom'

  @Column({ nullable: true })
  custom_library_user_id: number; // ID de l'utilisateur dont on utilise la bibliothèque

  @Column({ nullable: true })
  deck_id: number; // ID du deck utilisé pour les parties custom
}
