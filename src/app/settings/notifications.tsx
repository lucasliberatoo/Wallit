import { BellRing, Smartphone } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Platform, Switch, View } from 'react-native';

import { PageHeader, Screen } from '@/components/layout';
import { AppText, Button, Divider, SectionHeader, Surface } from '@/components/ui';
import { errorMessage } from '@/data';
import { type NotificationCategory, NOTIFICATION_CATEGORY_LABEL, type NotificationPrefs } from '@/domain';
import { useCurrentUser, useUpdateProfile } from '@/features/auth/hooks';
import { disablePush, enablePush, isPushEnabled, pushSupport } from '@/features/notifications/web-push';
import { useRepositories } from '@/providers/RepositoriesProvider';
import { makeStyles, spacing, useTheme } from '@/theme';
import { showError } from '@/utils/confirm';

const CATEGORIES = Object.keys(NOTIFICATION_CATEGORY_LABEL) as NotificationCategory[];

export default function NotificationSettingsScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const user = useCurrentUser();
  const update = useUpdateProfile();
  const saved = user?.notificationPrefs ?? {};
  const [prefs, setPrefs] = useState<NotificationPrefs>(saved);

  const toggle = (category: NotificationCategory, value: boolean) => {
    const next = { ...prefs, [category]: value };
    setPrefs(next);
    update.mutate(
      { notificationPrefs: next },
      {
        onError: (error) => {
          setPrefs(saved);
          showError('Não foi possível salvar', errorMessage(error));
        },
      },
    );
  };

  return (
    <>
      <PageHeader title="Notificações" />
      <Screen>
        {Platform.OS === 'web' ? <PushSection /> : <ApkNote />}

        <View>
          <SectionHeader title="O que avisar" />
          <Surface padded={false} style={styles.list}>
            {CATEGORIES.map((category, index) => {
              const label = NOTIFICATION_CATEGORY_LABEL[category];
              const enabled = prefs[category] !== false;
              return (
                <View key={category}>
                  {index > 0 && <Divider />}
                  <View style={styles.row}>
                    <View style={styles.flex}>
                      <AppText variant="bodyStrong">{label.title}</AppText>
                      <AppText variant="caption" color="textSecondary">
                        {label.description}
                      </AppText>
                    </View>
                    <Switch
                      value={enabled}
                      onValueChange={(value) => toggle(category, value)}
                      trackColor={{ false: colors.borderStrong, true: colors.primaryFill }}
                      thumbColor={colors.surface}
                      // react-native-web colors the "on" thumb separately.
                      {...({ activeThumbColor: colors.surface } as object)}
                      accessibilityLabel={label.title}
                    />
                  </View>
                </View>
              );
            })}
          </Surface>
        </View>
        <AppText variant="small" color="textMuted">
          Os avisos sempre ficam guardados no sino da tela inicial. Aqui você escolhe quais quer receber.
        </AppText>
      </Screen>
    </>
  );
}

/** Push on this browser / installed web app. */
function PushSection() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { push } = useRepositories();
  const support = pushSupport();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    isPushEnabled()
      .then(setEnabled)
      .catch(() => setEnabled(false));
  }, []);

  const turnOn = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await enablePush(push);
      if (result === 'enabled') setEnabled(true);
      else if (result === 'denied') setMessage('O navegador bloqueou as notificações. Libere nas configurações do site e tente de novo.');
      else setMessage('Este aparelho não aceita notificações do Wallit.');
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    try {
      await disablePush(push);
      setEnabled(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Surface style={styles.push}>
      <View style={styles.pushHeader}>
        <BellRing size={20} color={colors.primary} />
        <AppText variant="bodyStrong" style={styles.flex}>
          Avisos neste aparelho
        </AppText>
      </View>
      {support === 'supported' ? (
        <>
          <AppText variant="caption" color="textSecondary">
            {enabled
              ? 'Ligado. Você recebe os avisos mesmo com o Wallit fechado.'
              : 'Receba os avisos como notificação do celular ou do computador, mesmo com o Wallit fechado.'}
          </AppText>
          {enabled === null ? null : enabled ? (
            <Button label="Desligar neste aparelho" variant="secondary" loading={busy} onPress={turnOff} />
          ) : (
            <Button label="Ativar notificações" icon={BellRing} loading={busy} onPress={turnOn} />
          )}
        </>
      ) : support === 'needs-install' ? (
        <AppText variant="caption" color="textSecondary">
          No iPhone, as notificações funcionam depois de adicionar o Wallit à tela de início: toque em Compartilhar e em &quot;Adicionar à
          Tela de Início&quot;. Depois abra o Wallit por lá e volte aqui.
        </AppText>
      ) : (
        <AppText variant="caption" color="textSecondary">
          Este navegador não aceita notificações. Os avisos continuam aparecendo no sino.
        </AppText>
      )}
      {message ? (
        <AppText variant="caption" color="danger">
          {message}
        </AppText>
      ) : null}
    </Surface>
  );
}

function ApkNote() {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Surface style={styles.push}>
      <View style={styles.pushHeader}>
        <Smartphone size={20} color={colors.primary} />
        <AppText variant="bodyStrong" style={styles.flex}>
          Avisos no app
        </AppText>
      </View>
      <AppText variant="caption" color="textSecondary">
        Por enquanto, no app Android os avisos aparecem no sino da tela inicial. Para receber notificações no celular, use o Wallit pelo
        navegador instalado na tela de início.
      </AppText>
    </Surface>
  );
}

const useStyles = makeStyles(() => ({
  list: { paddingHorizontal: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  flex: { flex: 1, gap: 2 },
  push: { gap: spacing.md },
  pushHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
}));
