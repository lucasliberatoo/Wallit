import { useMutation } from '@tanstack/react-query';

import type { DisputeInput } from '@/data';
import { useInvalidateData } from '@/lib/use-invalidate';
import { useRepositories } from '@/providers/RepositoriesProvider';

export function useConfirmPurchase() {
  const { reviews } = useRepositories();
  const invalidate = useInvalidateData();
  return useMutation({
    mutationFn: ({ invoiceId, purchaseId }: { invoiceId: string; purchaseId: string }) => reviews.confirm(invoiceId, purchaseId),
    onSuccess: invalidate,
  });
}

export function useDisputePurchase() {
  const { reviews } = useRepositories();
  const invalidate = useInvalidateData();
  return useMutation({
    mutationFn: ({ invoiceId, purchaseId, input }: { invoiceId: string; purchaseId: string; input: DisputeInput }) =>
      reviews.dispute(invoiceId, purchaseId, input),
    onSuccess: invalidate,
  });
}

export function useResolveDispute() {
  const { reviews } = useRepositories();
  const invalidate = useInvalidateData();
  return useMutation({
    mutationFn: ({ reviewId, note }: { reviewId: string; note: string }) => reviews.resolve(reviewId, note),
    onSuccess: invalidate,
  });
}
