import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import type { AddMemberInput } from '@/data';
import type { Role } from '@/domain';
import { queryKeys } from '@/lib/query-keys';
import { useInvalidateData } from '@/lib/use-invalidate';
import { useRepositories } from '@/providers/RepositoriesProvider';
import { useSelectionStore } from '@/stores/selection-store';

export function useFamilies() {
  const { families } = useRepositories();
  return useQuery({ queryKey: queryKeys.families, queryFn: () => families.listMine() });
}

export function useFamily(familyId: string | undefined) {
  const { families } = useRepositories();
  return useQuery({ queryKey: queryKeys.family(familyId ?? ''), queryFn: () => families.get(familyId!), enabled: Boolean(familyId) });
}

/**
 * The family the app is currently showing. Falls back to the first family
 * the user belongs to, and clears the selection when they leave it.
 */
export function useCurrentFamily() {
  const { data: list, isLoading } = useFamilies();
  const familyId = useSelectionStore((state) => state.familyId);
  const setFamilyId = useSelectionStore((state) => state.setFamilyId);
  const current = list?.find((item) => item.family.id === familyId) ?? list?.[0] ?? null;

  useEffect(() => {
    if (!list) return;
    const nextId = current?.family.id ?? null;
    if (nextId !== familyId) setFamilyId(nextId);
  }, [list, current, familyId, setFamilyId]);

  return { current, families: list ?? [], isLoading, select: setFamilyId };
}

export function useMembers(familyId: string | undefined) {
  const { families } = useRepositories();
  return useQuery({
    queryKey: queryKeys.members(familyId ?? ''),
    queryFn: () => families.listMembers(familyId!),
    enabled: Boolean(familyId),
  });
}

export function useCreateFamily() {
  const { families } = useRepositories();
  const invalidate = useInvalidateData();
  const setFamilyId = useSelectionStore((state) => state.setFamilyId);
  return useMutation({
    mutationFn: families.create,
    onSuccess: (family) => {
      setFamilyId(family.id);
      return invalidate();
    },
  });
}

export function useJoinFamily() {
  const { families } = useRepositories();
  const invalidate = useInvalidateData();
  const setFamilyId = useSelectionStore((state) => state.setFamilyId);
  return useMutation({
    mutationFn: (code: string) => families.joinByCode(code),
    onSuccess: (family) => {
      setFamilyId(family.id);
      return invalidate();
    },
  });
}

export function useLeaveFamily() {
  const { families } = useRepositories();
  const invalidate = useInvalidateData();
  return useMutation({ mutationFn: (familyId: string) => families.leave(familyId), onSuccess: invalidate });
}

export function useAddMember() {
  const { families } = useRepositories();
  const invalidate = useInvalidateData();
  return useMutation({ mutationFn: (input: AddMemberInput) => families.addMember(input), onSuccess: invalidate });
}

export function useUpdateMemberRole() {
  const { families } = useRepositories();
  const invalidate = useInvalidateData();
  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: Role }) => families.updateMemberRole(memberId, role),
    onSuccess: invalidate,
  });
}

export function useRemoveMember() {
  const { families } = useRepositories();
  const invalidate = useInvalidateData();
  return useMutation({ mutationFn: (memberId: string) => families.removeMember(memberId), onSuccess: invalidate });
}

export function useCreateInvite() {
  const { families } = useRepositories();
  return useMutation({ mutationFn: (familyId: string) => families.createInvite(familyId) });
}
