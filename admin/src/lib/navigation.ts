import type { Route } from 'next';
import { Layers, LayoutGrid, Tags, Users, type LucideIcon } from 'lucide-react';

export type NavItem = {
  href: Route;
  label: string;
  icon: LucideIcon;
  /** Seconde touche de la séquence « G puis … ». */
  shortcut: string;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', label: 'Vue d’ensemble', icon: LayoutGrid, shortcut: 'h' },
  { href: '/users', label: 'Joueurs', icon: Users, shortcut: 'u' },
  { href: '/decks', label: 'Decks', icon: Layers, shortcut: 'd' },
  { href: '/categories', label: 'Catégories', icon: Tags, shortcut: 'c' },
];
