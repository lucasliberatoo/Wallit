import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { LoadingState } from '@/components/ui';
import { useSession } from '@/features/auth/hooks';
import { usePendingInviteStore } from '@/stores/pending-invite-store';

/**
 * Invite link (`/convite/ABC123`, shared on WhatsApp). Signed in: goes to the
 * join screen with the code filled in. Otherwise the code waits until the
 * person logs in or creates an account.
 */
export default function InviteLinkScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const session = useSession();
  const setCode = usePendingInviteStore((state) => state.setCode);
  const signedIn = Boolean(session.data);

  useEffect(() => {
    if (!signedIn && code) setCode(code.toUpperCase());
  }, [signedIn, code, setCode]);

  if (session.isLoading) return <LoadingState />;
  if (signedIn) return <Redirect href={`/family/join?code=${encodeURIComponent(code ?? '')}`} />;
  return <Redirect href="/login?invite=1" />;
}
