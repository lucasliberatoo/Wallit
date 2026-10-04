import { useMutation, useQuery } from '@tanstack/react-query';

import type { CategoryInput } from '@/data';
import { queryKeys } from '@/lib/query-keys';
import { useInvalidateData } from '@/lib/use-invalidate';
import { useRepositories } from '@/providers/RepositoriesProvider';

export function useCategories(familyId: string | undefined) {
  const { categories } = useRepositories();
  return useQuery({
    queryKey: queryKeys.categories(familyId ?? ''),
    queryFn: () => categories.list(familyId!),
    enabled: Boolean(familyId),
  });
}

export function useCreateCategory() {
  const { categories } = useRepositories();
  const invalidate = useInvalidateData();
  return useMutation({
    mutationFn: ({ familyId, input }: { familyId: string; input: CategoryInput }) => categories.create(familyId, input),
    onSuccess: invalidate,
  });
}

export function useUpdateCategory() {
  const { categories } = useRepositories();
  const invalidate = useInvalidateData();
  return useMutation({
    mutationFn: ({ categoryId, input }: { categoryId: string; input: Partial<CategoryInput> }) => categories.update(categoryId, input),
    onSuccess: invalidate,
  });
}

export function useRemoveCategory() {
  const { categories } = useRepositories();
  const invalidate = useInvalidateData();
  return useMutation({ mutationFn: (categoryId: string) => categories.remove(categoryId), onSuccess: invalidate });
}

export function useReorderCategories() {
  const { categories } = useRepositories();
  const invalidate = useInvalidateData();
  return useMutation({
    mutationFn: ({ familyId, ids }: { familyId: string; ids: string[] }) => categories.reorder(familyId, ids),
    onSuccess: invalidate,
  });
}
