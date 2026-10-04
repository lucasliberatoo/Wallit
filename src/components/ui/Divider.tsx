import { StyleSheet, View } from 'react-native';

import { makeStyles } from '@/theme';

export function Divider({ inset = 0 }: { inset?: number }) {
  const styles = useStyles();
  return <View style={[styles.line, { marginLeft: inset }]} />;
}

const useStyles = makeStyles((colors) => ({
  line: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
}));
