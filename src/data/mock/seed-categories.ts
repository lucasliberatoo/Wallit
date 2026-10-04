import type { ID } from '@/domain';
import { newId, type MockStore } from './store';

export const DEFAULT_CATEGORIES = [
  { name: 'Mercado', icon: 'shopping-cart', color: '#155EEF' },
  { name: 'Farmácia', icon: 'pill', color: '#E31B54' },
  { name: 'Alimentação', icon: 'utensils', color: '#FF8A00' },
  { name: 'Transporte', icon: 'bus', color: '#0E9384' },
  { name: 'Combustível', icon: 'fuel', color: '#DC6803' },
  { name: 'Educação', icon: 'graduation-cap', color: '#7A5AF8' },
  { name: 'Saúde', icon: 'heart-pulse', color: '#D92D20' },
  { name: 'Lazer', icon: 'party-popper', color: '#EE46BC' },
  { name: 'Roupas', icon: 'shirt', color: '#6172F3' },
  { name: 'Casa', icon: 'house', color: '#079455' },
  { name: 'Assinaturas', icon: 'repeat', color: '#0B1F4D' },
  { name: 'Eletrônicos', icon: 'laptop', color: '#475467' },
  { name: 'Outros', icon: 'shapes', color: '#6B7487' },
] as const;

export function seedDefaultCategories(store: MockStore, familyId: ID): void {
  DEFAULT_CATEGORIES.forEach((category, order) => {
    store.db.categories.push({ id: newId('cat'), familyId, order, ...category });
  });
}
