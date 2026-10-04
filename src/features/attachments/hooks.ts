import { useMutation, useQuery } from '@tanstack/react-query';

import type { AddAttachmentInput } from '@/data';
import { queryKeys } from '@/lib/query-keys';
import { useInvalidateData } from '@/lib/use-invalidate';
import { useRepositories } from '@/providers/RepositoriesProvider';

export function useAttachmentData(attachmentId: string | undefined) {
  const { attachments } = useRepositories();
  return useQuery({
    queryKey: queryKeys.attachment(attachmentId ?? ''),
    queryFn: () => attachments.getData(attachmentId!),
    enabled: Boolean(attachmentId),
    // Files never change; keep them while the app is open.
    staleTime: Infinity,
  });
}

export function useAddAttachment() {
  const { attachments } = useRepositories();
  const invalidate = useInvalidateData();
  return useMutation({ mutationFn: (input: AddAttachmentInput) => attachments.add(input), onSuccess: invalidate });
}

export function useRemoveAttachment() {
  const { attachments } = useRepositories();
  const invalidate = useInvalidateData();
  return useMutation({ mutationFn: (attachmentId: string) => attachments.remove(attachmentId), onSuccess: invalidate });
}

/** Uploads files picked in a form once the purchase exists. Returns how many failed. */
export function useUploadPicked() {
  const add = useAddAttachment();
  return {
    isPending: add.isPending,
    upload: async (purchaseId: string, files: { name: string; mimeType: string; dataUrl: string }[]) => {
      let failed = 0;
      for (const file of files) {
        try {
          await add.mutateAsync({ purchaseId, ...file });
        } catch {
          failed += 1;
        }
      }
      return failed;
    },
  };
}
