import { Download, MonitorSmartphone, Share, Smartphone } from 'lucide-react-native';
import { Linking, StyleSheet, View } from 'react-native';

import { Logo } from '@/components/brand/Logo';
import { PageHeader, Screen } from '@/components/layout';
import { AppText, Button, Surface } from '@/components/ui';
import { useInstallPrompt } from '@/features/download/use-install-prompt';
import { ANDROID_APK_URL } from '@/lib/links';
import { spacing, useTheme } from '@/theme';

/** Public page: get the Wallit app from the browser (APK or home-screen install). */
export default function DownloadScreen() {
  const { colors } = useTheme();
  const { canInstall, installed, install } = useInstallPrompt();

  return (
    <>
      <PageHeader title="Baixar o Wallit" />
      <Screen>
        <View style={styles.hero}>
          <Logo size={88} />
          <AppText variant="body" color="textSecondary" align="center">
            Use o Wallit como app no celular. Seus dados são os mesmos do site.
          </AppText>
        </View>

        <Surface style={styles.card}>
          <View style={styles.cardTitle}>
            <Smartphone size={22} color={colors.primary} />
            <AppText variant="bodyStrong">Android</AppText>
          </View>
          <Button label="Baixar o app (APK)" icon={Download} size="lg" onPress={() => Linking.openURL(ANDROID_APK_URL)} />
          <AppText variant="caption" color="textSecondary">
            Abra o arquivo baixado e toque em Instalar. Na primeira vez, o Android pede para permitir a instalação pelo navegador: é só
            autorizar.
          </AppText>
        </Surface>

        <Surface style={styles.card}>
          <View style={styles.cardTitle}>
            <Share size={22} color={colors.primary} />
            <AppText variant="bodyStrong">iPhone</AppText>
          </View>
          <AppText variant="body" color="textSecondary">
            Abra este site no Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”. O Wallit aparece com ícone próprio e
            abre em tela cheia.
          </AppText>
        </Surface>

        {canInstall || installed ? (
          <Surface style={styles.card}>
            <View style={styles.cardTitle}>
              <MonitorSmartphone size={22} color={colors.primary} />
              <AppText variant="bodyStrong">Instalar pelo navegador</AppText>
            </View>
            {installed ? (
              <AppText variant="body" color="textSecondary">
                Pronto! O Wallit foi instalado.
              </AppText>
            ) : (
              <Button label="Instalar agora" variant="secondary" onPress={install} />
            )}
          </Surface>
        ) : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },
  card: { gap: spacing.md },
  cardTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
