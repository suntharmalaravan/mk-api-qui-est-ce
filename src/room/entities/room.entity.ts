import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Room {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @Column({ default: 'closed' })
  status: string;

  @Column({ default: 0 })
  hostplayerid: number;

  @Column({ nullable: true })
  guestplayerid: number | null;

  @Column({ nullable: true })
  hostcharacterid: number | null;

  @Column({ nullable: true })
  guestcharacterid: number | null;

  @Column()
  category: string;

  @Column({ default: 'category' })
  mode: string; // 'category' | 'custom'

  @Column({ nullable: true })
  custom_library_user_id: number | null; // ID de l'utilisateur dont on utilise la bibliothèque

  @Column({ nullable: true })
  deck_id: number | null; // ID du deck utilisé pour les parties custom
}
