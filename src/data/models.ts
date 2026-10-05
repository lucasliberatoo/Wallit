import type {
  AppNotification,
  Attachment,
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
  LineReviewStatus,
  MemberBalance,
  MerchantAlias,
  DisputeReason,
  Payment,
  Purchase,
  PurchaseInstallment,
  PurchaseReview,
  ReviewProgress,
  Role,
  ShareInput,
  Statistics,
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

export interface DisputeView {
  review: PurchaseReview;
  member: FamilyMember;
}

/** Where a purchase stands in the invoice review ("conferência"). */
export interface LineReview {
  status: LineReviewStatus;
  /** People who still have to confirm or contest it. */
  pendingMembers: FamilyMember[];
  disputes: DisputeView[];
  myReview: PurchaseReview | null;
  /** The signed-in user is involved and hasn't answered yet. */
  awaitingMe: boolean;
}

/** One installment of a purchase, as it appears inside an invoice. */
export interface InvoiceLine {
  installment: PurchaseInstallment;
  purchase: Purchase;
  category: Category | null;
  buyer: FamilyMember;
  /** Each member's part of this installment. */
  shares: ShareView[];
  review: LineReview;
  attachmentCount: number;
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
  payments: PaymentView[];
  me: FamilyMember;
  reviewProgress: ReviewProgress;
  /** The signed-in user can manage this invoice (holder or owner). */
  canManage: boolean;
  /** Where members send their part ("Copiar chave PIX"). */
  holderPixKey: string | null;
  /** The family hides other people's balances from this user. */
  balancesRestricted?: boolean;
}

export interface PaymentView extends Payment {
  member: FamilyMember;
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
  /** Holder power over the card: answers disputes, removes any attachment. */
  canManage: boolean;
  me: FamilyMember;
  /** Future installments that can be brought into the open invoice (null when none or not allowed). */
  anticipation: { available: number; availableCents: Cents; targetRef: InvoiceRef } | null;
  /** Review state while one of its invoices is being reviewed. */
  review: (LineReview & { invoiceId: ID }) | null;
  attachments: Attachment[];
  disputes: DisputeView[];
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
  /** Purchases waiting for my confirmation in invoices under review. */
  toReview: { count: number; invoiceId: ID | null };
  /** Payments other members marked, waiting for me as holder. */
  paymentsToConfirm: { count: number; invoiceId: ID | null };
}

export interface NotificationView extends AppNotification {
  familyName: string;
}

export interface StatisticsFilters {
  from: InvoiceRef;
  to: InvoiceRef;
  cardId?: ID;
  memberId?: ID;
  categoryId?: ID;
}

export interface StatisticsView extends Statistics {
  categories: Category[];
  members: FamilyMember[];
  cards: Card[];
}

export type { MerchantAlias };

export interface HistoryFilters {
  search?: string;
  cardId?: ID;
  /** Bought or pays part of it. */
  memberId?: ID;
  /** Only purchases this member bought. */
  buyerMemberId?: ID;
  onlyInstallments?: boolean;
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

export interface DisputeInput {
  reason: DisputeReason;
  note?: string;
}

export interface AddAttachmentInput {
  purchaseId: ID;
  /** Attaches the file to a dispute about the purchase. */
  reviewId?: ID;
  name: string;
  mimeType: string;
  /** `data:<mime>;base64,...` */
  dataUrl: string;
}

export interface AttachmentData {
  attachment: Attachment;
  dataUrl: string;
}

export interface RegisterPaymentInput {
  invoiceId: ID;
  memberId: ID;
  amountCents: Cents;
  note?: string;
}

export type { InvoiceRef };
