import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index, OneToMany } from 'typeorm';
import { Image } from './image.entity';

@Entity()
export class Deck {
    @PrimaryGeneratedColumn()
    id: number;

    @Index()
    @Column()
    user_id: number;

    @Column({ length: 50 })
    name: string;

    @CreateDateColumn()
    created_at: Date;

    @OneToMany(() => Image, (image) => image.deck)
    images: Image[];
}
