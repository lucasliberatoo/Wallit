import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/components/layout';
import { useTheme } from '@/theme';

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="families" />
      <Tabs.Screen name="add" />
      <Tabs.Screen name="invoices" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
