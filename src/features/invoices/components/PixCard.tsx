import * as Clipboard from 'expo-clipboard';
import { Check, Clock, Copy, Send } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText, Button, Surface } from '@/components/ui';
import { type Cents, formatBRL } from '@/domain';
import { makeStyles, radius, spacing, useTheme } from '@/theme';

export interface PixCardProps {
  holderName: string;
  pixKey: string | null;
  /** What is left to send, not counting payments waiting for confirmation. */
  toSendCents: Cents;
  awaitingCents: Cents;
  onInform: () => void;
}

/** "Sua parte": how much to send to the holder, with the PIX key to copy. */
export function PixCard({ holderName, pixKey, toSendCents, awaitingCents, onInform }: PixCardProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!pixKey) return;
    await Clipboard.setStringAsync(pixKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Surface style={styles.card}>
      <View style={styles.text}>
        <AppText variant="caption" color="textSecondary">
          Sua parte
        </AppText>
        {toSendCents > 0 ? (
          <AppText variant="h3">
            Enviar {formatBRL(toSendCents)} para {holderName}
          </AppText>
        ) : (
          <AppText variant="h3">Pagamento informado</AppText>
        )}
      </View>

      {awaitingCents > 0 ? (
        <View style={styles.awaiting}>
          <Clock size={14} color={colors.warning} />
          <AppText variant="caption" color="textSecondary" style={styles.flex}>
            {formatBRL(awaitingCents)} aguardando {holderName} confirmar que recebeu.
          </AppText>
        </View>
      ) : null}

      {toSendCents > 0 ? (
        <>
          {pixKey ? (
            <View style={styles.key}>
              <View style={styles.flex}>
                <AppText variant="small" color="textMuted">
                  Chave PIX de {holderName}
                </AppText>
                <AppText variant="bodyStrong" numberOfLines={1} selectable>
                  {pixKey}
                </AppText>
              </View>
              <Button
                label={copied ? 'Copiada' : 'Copiar chave PIX'}
                icon={copied ? Check : Copy}
                variant="secondary"
                fullWidth={false}
                onPress={copy}
                style={styles.copy}
              />
            </View>
          ) : (
            <AppText variant="small" color="textMuted">
              {holderName} ainda não cadastrou a chave PIX no perfil.
            </AppText>
          )}
          <Button label="Já paguei, avisar" icon={Send} variant="accent" onPress={onInform} />
        </>
      ) : null}
    </Surface>
  );
}

const useStyles = makeStyles((colors) => ({
  card: { gap: spacing.md, backgroundColor: colors.highlightSoft, borderWidth: 1, borderColor: colors.primarySoft },
  text: { gap: 2 },
  flex: { flex: 1, gap: 2 },
  awaiting: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  key: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  copy: { height: 36, paddingHorizontal: spacing.md },
}));
