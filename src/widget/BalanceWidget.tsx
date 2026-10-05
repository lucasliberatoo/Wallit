import { FlexWidget, TextWidget } from 'react-native-android-widget';

import { formatBRL } from '@/domain';
import type { WidgetSnapshot } from './snapshot';

export const BALANCE_WIDGET = 'Balance';

type Hex = `#${string}`;

interface Palette {
  background: Hex;
  text: Hex;
  muted: Hex;
  brand: Hex;
  success: Hex;
  warning: Hex;
  button: Hex;
  onButton: Hex;
}

const light: Palette = {
  background: '#FFFFFF',
  text: '#101828',
  muted: '#667085',
  brand: '#155EEF',
  success: '#067647',
  warning: '#B54708',
  button: '#155EEF',
  onButton: '#FFFFFF',
};

const dark: Palette = {
  background: '#111A33',
  text: '#F5F7FB',
  muted: '#98A2B3',
  brand: '#84ADFF',
  success: '#47CD89',
  warning: '#FDB022',
  button: '#2970FF',
  onButton: '#FFFFFF',
};

function dueLabel(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const due = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  const short = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
  if (days === 0) return `vence hoje (${short})`;
  if (days === 1) return `vence amanhã (${short})`;
  if (days > 1 && days <= 7) return `vence em ${days} dias (${short})`;
  return `vence ${short}`;
}

function money(cents: number, hidden: boolean | undefined): string {
  return hidden ? 'R$ ••••' : formatBRL(cents);
}

function NewPurchaseButton({ colors }: { colors: Palette }) {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'wallit://purchase/new' }}
      style={{ backgroundColor: colors.button, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 }}>
      <TextWidget text="+ Nova compra" style={{ color: colors.onButton, fontSize: 13, fontWeight: '700' }} />
    </FlexWidget>
  );
}

function Widget({ snapshot, colors }: { snapshot: WidgetSnapshot; colors: Palette }) {
  const frame = {
    height: 'match_parent' as const,
    width: 'match_parent' as const,
    backgroundColor: colors.background,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
  };
  if (!snapshot.signedIn) {
    return (
      <FlexWidget clickAction="OPEN_APP" style={{ ...frame, justifyContent: 'center', flexGap: 4 }}>
        <TextWidget text="Wallit" style={{ color: colors.brand, fontSize: 13, fontWeight: '700' }} />
        <TextWidget text="Entre no app para ver quanto você deve." style={{ color: colors.text, fontSize: 14 }} maxLines={2} />
      </FlexWidget>
    );
  }
  const owed = snapshot.owedCents ?? 0;
  const settled = owed === 0;
  const due = snapshot.nextDue ? `${snapshot.nextDue.cardName} ${dueLabel(snapshot.nextDue.date)}` : 'Nenhuma fatura a vencer';
  const review = snapshot.toReviewCount
    ? snapshot.toReviewCount === 1
      ? '1 compra para conferir'
      : `${snapshot.toReviewCount} compras para conferir`
    : null;
  return (
    <FlexWidget clickAction="OPEN_APP" style={{ ...frame, justifyContent: 'space-between' }}>
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
        <FlexWidget style={{ flex: 1 }}>
          <TextWidget
            text={snapshot.familyName ? `Wallit · ${snapshot.familyName}` : 'Wallit'}
            style={{ color: colors.brand, fontSize: 12, fontWeight: '700' }}
            maxLines={1}
            truncate="END"
          />
        </FlexWidget>
        <TextWidget text={settled ? 'Em dia' : 'Você deve'} style={{ color: colors.muted, fontSize: 12 }} />
      </FlexWidget>
      <TextWidget
        text={money(owed, snapshot.hidden)}
        style={{ color: settled ? colors.success : colors.text, fontSize: 26, fontWeight: '800' }}
        maxLines={1}
      />
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', flexGap: 8 }}>
        <FlexWidget style={{ flex: 1 }}>
          <TextWidget text={due} style={{ color: colors.muted, fontSize: 12 }} maxLines={1} truncate="END" />
          {review ? <TextWidget text={review} style={{ color: colors.warning, fontSize: 12, fontWeight: '600' }} maxLines={1} /> : null}
        </FlexWidget>
        <NewPurchaseButton colors={colors} />
      </FlexWidget>
    </FlexWidget>
  );
}

/** Light and dark versions; Android picks one from the system theme. */
export function balanceWidget(snapshot: WidgetSnapshot) {
  return { light: <Widget snapshot={snapshot} colors={light} />, dark: <Widget snapshot={snapshot} colors={dark} /> };
}
