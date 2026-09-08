import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Deck } from './deck.entity';

@Entity()
export class Image {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  category: string;

  @Column()
  url: string;

  @Column()
  name: string;

  @Index()
  @Column({ nullable: true })
  user_id: number;

  @Index()
  @Column({ nullable: true })
  deck_id: number;

  @ManyToOne(() => Deck, (deck) => deck.images, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deck_id' })
  deck: Deck;

  // Attribution des images du catalogue officiel. Les licences CC BY et CC BY-SA
  // imposent de créditer l'auteur et de nommer la licence à l'affichage.
  @Column({ nullable: true })
  author: string;

  @Column({ nullable: true })
  license: string;

  @Column({ nullable: true })
  license_url: string;

  @Column({ nullable: true })
  source_url: string;

  // Restrictions distinctes du copyright (par exemple : marque déposée).
  @Column({ nullable: true })
  restrictions: string;

  @CreateDateColumn({ nullable: true })
  created_at: Date;
}
