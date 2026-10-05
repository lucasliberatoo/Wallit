import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { AppText, Button, LoadingState } from '@/components/ui';
import { errorMessage } from '@/data';
import { AuthScaffold } from '@/features/auth/AuthScaffold';
import { useCompleteBrowserSignIn } from '@/features/auth/hooks';
import { useRepositories } from '@/providers/RepositoriesProvider';

/**
 * Web page of the Google sign-in. Without `done` it starts the flow (the
 * installed app opens it with `app=1`); Google sends the browser back with
 * `done=1`, and the session goes to the web app or back to the installed app.
 */
export default function GoogleSignInPage() {
  const params = useLocalSearchParams<{ app?: string; done?: string; falha?: string }>();
  const { auth } = useRepositories();
  const complete = useCompleteBrowserSignIn();
  const [error, setError] = useState<string | null>(params.falha ? 'O Google não confirmou o login. Tente de novo.' : null);
  const [appLink, setAppLink] = useState<string | null>(null);
  const started = useRef(false);
  const forApp = params.app === '1';

  useEffect(() => {
    if (started.current || params.falha) return;
    started.current = true;
    if (Platform.OS !== 'web') {
      router.replace('/');
      return;
    }
    const origin = window.location.origin;
    const app = forApp ? '&app=1' : '';
    if (!params.done) {
      auth
        .googleSignInUrl(`${origin}/entrar/google?done=1${app}`, `${origin}/entrar/google?falha=1${app}`)
        .then((url) => window.location.assign(url))
        .catch((e) => setError(errorMessage(e)));
      return;
    }
    if (forApp) {
      auth
        .completeBrowserSignIn()
        .then(({ token }) => {
          const link = `wallit://entrar?token=${encodeURIComponent(token)}`;
          setAppLink(link);
          window.location.assign(link);
        })
        .catch((e) => setError(errorMessage(e)));
      return;
    }
    complete.mutate(undefined, { onSuccess: () => router.replace('/'), onError: (e) => setError(errorMessage(e)) });
  }, [auth, complete, forApp, params.done, params.falha]);

  if (error) {
    return (
      <AuthScaffold title="Não deu certo" subtitle={error}>
        <Button label="Voltar para o login" onPress={() => router.replace('/login')} />
      </AuthScaffold>
    );
  }
  if (appLink) {
    return (
      <AuthScaffold title="Pronto!" subtitle="Você entrou com o Google.">
        <AppText variant="body" color="textSecondary" align="center">
          Se o app não abriu sozinho, toque no botão.
        </AppText>
        <Button label="Voltar para o app" onPress={() => window.location.assign(appLink)} />
      </AuthScaffold>
    );
  }
  return <LoadingState />;
}
