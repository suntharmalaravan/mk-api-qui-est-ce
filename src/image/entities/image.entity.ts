import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
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

  @CreateDateColumn({ nullable: true })
  created_at: Date;
}
