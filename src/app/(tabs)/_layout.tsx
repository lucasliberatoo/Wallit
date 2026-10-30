import { Tabs } from 'expo-router/js-tabs';
import { StyleSheet, View } from 'react-native';

import { TabBar } from '@/components/layout';
import { WallyBubble } from '@/features/assistant/WallyBubble';
import { useTheme } from '@/theme';

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <View style={styles.root}>
      <Tabs
        tabBar={(props) => <TabBar {...props} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="families" />
        <Tabs.Screen name="add" />
        <Tabs.Screen name="invoices" />
        <Tabs.Screen name="profile" />
      </Tabs>
      <WallyBubble />
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
