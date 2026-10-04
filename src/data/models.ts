import type {
  AuditLog,
  Card,
  CardBrand,
  CardTheme,
  Category,
  Cents,
  Family,
  FamilyMember,
  ID,
  Invoice,
  InvoiceRef,
  InvoiceTotals,
  ISODate,
  MemberBalance,
  Payment,
  Purchase,
  PurchaseInstallment,
  Role,
  ShareInput,
  User,
  Wallet,
} from '../domain';

/** Audit entry with the author's name resolved for display. */
export interface AuditLogView extends AuditLog {
  actorName: string;
}

export interface Session {
  user: User;
}

export interface FamilySummary {
  family: Family;
  me: FamilyMember;
  memberCount: number;
  walletCount: number;
}

export interface WalletSummary {
  wallet: Wallet;
  cards: CardSummary[];
}

export interface CardSummary {
  card: Card;
  holder: FamilyMember;
  currentInvoice: Invoice | null;
  totals: InvoiceTotals;
}

export interface ShareView {
  member: FamilyMember;
  amountCents: Cents;
}

/** One installment of a purchase, as it appears inside an invoice. */
export interface InvoiceLine {
  installment: PurchaseInstallment;
  purchase: Purchase;
  category: Category | null;
  buyer: FamilyMember;
  /** Each member's part of this installment. */
  shares: ShareView[];
}

export interface MemberBalanceView extends MemberBalance {
  member: FamilyMember;
}

export interface InvoiceDetails {
  invoice: Invoice;
  card: Card;
  holder: FamilyMember;
  lines: InvoiceLine[];
  balances: MemberBalanceView[];
  totals: InvoiceTotals;
  payments: Payment[];
  me: FamilyMember;
}

export interface InvoiceListItem {
  invoice: Invoice;
  card: Card;
  totals: InvoiceTotals;
  myBalance: MemberBalance | null;
}

export interface PurchaseListItem {
  purchase: Purchase;
  category: Category | null;
  buyer: FamilyMember;
  card: Card;
  payers: FamilyMember[];
  /** Installment that falls in the invoice being listed, when relevant. */
  installment?: PurchaseInstallment;
}

export interface PurchaseDetails {
  purchase: Purchase;
  category: Category | null;
  buyer: FamilyMember;
  card: Card;
  shares: ShareView[];
  installments: { installment: PurchaseInstallment; invoice: Invoice }[];
  history: AuditLogView[];
  canEdit: boolean;
}

export interface HomeSummary {
  me: FamilyMember;
  /** What I still need to transfer to card holders. */
  owedCents: Cents;
  /** What others still need to transfer to me, as a holder. */
  toReceiveCents: Cents;
  nextDue: { date: ISODate; cardName: string; invoiceId: ID } | null;
  openInvoicesCount: number;
  recentPurchases: PurchaseListItem[];
  activeInstallments: { count: number; remainingCents: Cents };
  myCurrentShareCents: Cents;
}

export interface HistoryFilters {
  search?: string;
  cardId?: ID;
  memberId?: ID;
  categoryId?: ID;
  from?: ISODate;
  to?: ISODate;
}

// ---- inputs ----

export interface SignUpInput {
  name: string;
  email: string;
  password: string;
}

export interface CreatePurchaseInput {
  familyId: ID;
  cardId: ID;
  merchant: string;
  statementName?: string;
  totalCents: Cents;
  date: ISODate;
  categoryId: ID;
  buyerMemberId: ID;
  installmentCount: number;
  shares: ShareInput[];
  note?: string;
}

export type UpdatePurchaseInput = Partial<Omit<CreatePurchaseInput, 'familyId' | 'cardId' | 'installmentCount'>>;

export interface CreateCardInput {
  walletId: ID;
  name: string;
  holderMemberId: ID;
  theme: CardTheme;
  brand?: CardBrand;
  limitCents?: Cents;
  closingDay: number;
  dueDay: number;
}

export interface AddMemberInput {
  familyId: ID;
  displayName: string;
  role: Role;
}

export interface CategoryInput {
  name: string;
  icon: string;
  color: string;
}

export interface RegisterPaymentInput {
  invoiceId: ID;
  memberId: ID;
  amountCents: Cents;
  note?: string;
}

export type { InvoiceRef };
