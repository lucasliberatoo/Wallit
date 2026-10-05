import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';

import { LoadingState } from '@/components/ui';
import { useSession, useSignInWithToken } from '@/features/auth/hooks';

/** `wallit://entrar?token=…`: the browser hands the Google session to the installed app. */
export default function EnterWithTokenScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const session = useSession();
  const signIn = useSignInWithToken();
  const started = useRef(false);
  const signedIn = Boolean(session.data);

  useEffect(() => {
    if (started.current || signedIn || !token || session.isLoading) return;
    started.current = true;
    signIn.mutate(token);
  }, [signedIn, token, session.isLoading, signIn]);

  if (signedIn) return <Redirect href="/" />;
  if (!token || signIn.isError) return <Redirect href="/login" />;
  return <LoadingState />;
}
