import * as Clipboard from 'expo-clipboard';
import { Check, Link2, MessageCircle, Share2 } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Platform, Share, View } from 'react-native';

import { AppText, Button } from '@/components/ui';
import { inviteLink, inviteMessage } from '@/lib/invite-link';
import { makeStyles, radius, spacing } from '@/theme';

/** Link to send on WhatsApp (or anywhere) that opens Wallit with the code filled in. */
export function InviteShare({ familyName, code }: { familyName: string; code: string }) {
  const styles = useStyles();
  const [copied, setCopied] = useState(false);
  const link = inviteLink(code);
  const message = inviteMessage(familyName, code);
  const canShare = Platform.OS !== 'web' || (typeof navigator !== 'undefined' && 'share' in navigator);

  const copy = async () => {
    await Clipboard.setStringAsync(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.link}>
        <AppText variant="caption" color="textSecondary" numberOfLines={1} selectable>
          {link}
        </AppText>
      </View>
      <Button
        label="Enviar pelo WhatsApp"
        icon={MessageCircle}
        onPress={() => Linking.openURL(`https://wa.me/?text=${encodeURIComponent(message)}`)}
      />
      <View style={styles.row}>
        <Button
          label={copied ? 'Link copiado' : 'Copiar link'}
          icon={copied ? Check : Link2}
          variant="secondary"
          fullWidth={false}
          style={styles.flex}
          onPress={copy}
        />
        {canShare ? (
          <Button
            label="Compartilhar"
            icon={Share2}
            variant="secondary"
            fullWidth={false}
            style={styles.flex}
            onPress={() => Share.share({ message, url: link }).catch(() => undefined)}
          />
        ) : null}
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrapper: { gap: spacing.sm },
  link: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
}));
