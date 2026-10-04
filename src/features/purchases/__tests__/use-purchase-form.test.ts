import { act, renderHook } from '@testing-library/react-native';

import { initialPurchaseForm, usePurchaseForm } from '../use-purchase-form';

async function setup() {
  return await renderHook(() =>
    usePurchaseForm(
      initialPurchaseForm({
        cardId: 'card',
        categoryId: 'cat',
        buyerId: 'lucas',
        merchant: 'Farmácia',
        shares: [{ memberId: 'lucas', amountCents: 0 }],
      }),
    ),
  );
}

describe('purchase form', () => {
  it('starts with the buyer paying everything', async () => {
    const { result } = await setup();
    await act(() => result.current.dispatch({ type: 'setTotal', value: 12000 }));
    expect(result.current.state.shares).toEqual([{ memberId: 'lucas', amountCents: 12000 }]);
    expect(result.current.canSave).toBe(true);
  });

  it('splits equally when adding payers, and keeps saving disabled while incomplete', async () => {
    const { result } = await setup();
    await act(() => result.current.dispatch({ type: 'setTotal', value: 12000 }));
    await act(() => result.current.dispatch({ type: 'togglePayer', memberId: 'avo' }));
    expect(result.current.state.shares.map((s) => s.amountCents)).toEqual([6000, 6000]);

    await act(() => result.current.dispatch({ type: 'setShareAmount', memberId: 'lucas', value: 5000 }));
    expect(result.current.split.status).toBe('missing');
    expect(result.current.canSave).toBe(false);

    await act(() => result.current.dispatch({ type: 'fillRemaining', memberId: 'avo' }));
    expect(result.current.state.shares.map((s) => s.amountCents)).toEqual([5000, 7000]);
    expect(result.current.canSave).toBe(true);
  });

  it('follows the buyer when the split was untouched', async () => {
    const { result } = await setup();
    await act(() => result.current.dispatch({ type: 'setTotal', value: 5000 }));
    await act(() => result.current.dispatch({ type: 'setBuyer', value: 'maria' }));
    expect(result.current.state.shares).toEqual([{ memberId: 'maria', amountCents: 5000 }]);
  });

  it('requires a valid installment count', async () => {
    const { result } = await setup();
    await act(() => result.current.dispatch({ type: 'setTotal', value: 5 }));
    await act(() => result.current.dispatch({ type: 'setInstallments', value: 12 }));
    expect(result.current.canSave).toBe(false);
  });
});
