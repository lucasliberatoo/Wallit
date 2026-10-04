import { Redirect } from 'expo-router';

/** Placeholder route for the central "+" tab; the tab bar opens /purchase/new instead. */
export default function AddTab() {
  return <Redirect href="/purchase/new" />;
}
