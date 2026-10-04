import { useMutation, useQuery } from '@tanstack/react-query';

import type { RegisterPaymentInput } from '@/data';
import type { InvoiceRef, InvoiceStatus } from '@/domain';
import { queryKeys } from '@/lib/query-keys';
import { useInvalidateData } from '@/lib/use-invalidate';
import { useRepositories } from '@/providers/RepositoriesProvider';

export function useFamilyInvoices(familyId: string | undefined) {
  const { invoices } = useRepositories();
  return useQuery({
    queryKey: queryKeys.familyInvoices(familyId ?? ''),
    queryFn: () => invoices.listByFamily(familyId!),
    enabled: Boolean(familyId),
  });
}

export function useCardInvoices(cardId: string | undefined) {
  const { invoices } = useRepositories();
  return useQuery({
    queryKey: queryKeys.cardInvoices(cardId ?? ''),
    queryFn: () => invoices.listByCard(cardId!),
    enabled: Boolean(cardId),
  });
}

export function useInvoice(invoiceId: string | undefined) {
  const { invoices } = useRepositories();
  return useQuery({
    queryKey: queryKeys.invoice(invoiceId ?? ''),
    queryFn: () => invoices.getDetails(invoiceId!),
    enabled: Boolean(invoiceId),
  });
}

export function useCreateInvoice() {
  const { invoices } = useRepositories();
  const invalidate = useInvalidateData();
  return useMutation({
    mutationFn: ({ cardId, ref }: { cardId: string; ref: InvoiceRef }) => invoices.create(cardId, ref),
    onSuccess: invalidate,
  });
}

export function useChangeInvoiceStatus() {
  const { invoices } = useRepositories();
  const invalidate = useInvalidateData();
  return useMutation({
    mutationFn: ({ invoiceId, status }: { invoiceId: string; status: InvoiceStatus }) => invoices.changeStatus(invoiceId, status),
    onSuccess: invalidate,
  });
}

export function useRegisterPayment() {
  const { payments } = useRepositories();
  const invalidate = useInvalidateData();
  return useMutation({ mutationFn: (input: RegisterPaymentInput) => payments.register(input), onSuccess: invalidate });
}

export function useConfirmPayment() {
  const { payments } = useRepositories();
  const invalidate = useInvalidateData();
  return useMutation({ mutationFn: (paymentId: string) => payments.confirm(paymentId), onSuccess: invalidate });
}

export function useRejectPayment() {
  const { payments } = useRepositories();
  const invalidate = useInvalidateData();
  return useMutation({
    mutationFn: ({ paymentId, note }: { paymentId: string; note?: string }) => payments.reject(paymentId, note),
    onSuccess: invalidate,
  });
}
