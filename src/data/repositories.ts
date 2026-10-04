import type {
  Attachment,
  Card,
  Category,
  Family,
  FamilyMember,
  ID,
  Invoice,
  InvoiceRef,
  InvoiceStatus,
  Payment,
  PurchaseReview,
  Role,
  User,
  Wallet,
} from '../domain';
import type {
  AddAttachmentInput,
  AddMemberInput,
  AttachmentData,
  AuditLogView,
  CardSummary,
  CategoryInput,
  CreateCardInput,
  CreatePurchaseInput,
  DisputeInput,
  FamilySummary,
  HistoryFilters,
  HomeSummary,
  InvoiceDetails,
  InvoiceListItem,
  MerchantAlias,
  NotificationView,
  PurchaseDetails,
  PurchaseListItem,
  RegisterPaymentInput,
  Session,
  SignUpInput,
  StatisticsFilters,
  StatisticsView,
  UpdatePurchaseInput,
  WalletSummary,
} from './models';

/**
 * Contracts between the app and any backend. Screens only talk to these
 * interfaces (through hooks), so the backend can be swapped (mock in memory,
 * HTTP API on Vercel, ...) without touching the UI.
 */
export interface AuthRepository {
  getSession(): Promise<Session | null>;
  signIn(email: string, password: string): Promise<Session>;
  signUp(input: SignUpInput): Promise<Session>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  /** `photo: ''` removes the photo. */
  updateProfile(changes: Partial<Pick<User, 'name' | 'pixKey' | 'avatarColor' | 'photo' | 'notificationPrefs'>>): Promise<User>;
}

export interface FamilyRepository {
  listMine(): Promise<FamilySummary[]>;
  get(familyId: ID): Promise<FamilySummary>;
  create(input: { name: string; color: string }): Promise<Family>;
  listMembers(familyId: ID): Promise<FamilyMember[]>;
  addMember(input: AddMemberInput): Promise<FamilyMember>;
  updateMemberRole(memberId: ID, role: Role): Promise<FamilyMember>;
  removeMember(memberId: ID): Promise<void>;
  leave(familyId: ID): Promise<void>;
  createInvite(familyId: ID): Promise<{ code: string }>;
  joinByCode(code: string): Promise<Family>;
}

export interface WalletRepository {
  list(familyId: ID): Promise<WalletSummary[]>;
  get(walletId: ID): Promise<WalletSummary>;
  create(input: { familyId: ID; name: string }): Promise<Wallet>;
}

export interface CardRepository {
  listByFamily(familyId: ID): Promise<CardSummary[]>;
  get(cardId: ID): Promise<CardSummary>;
  create(input: CreateCardInput): Promise<Card>;
}

export interface InvoiceRepository {
  listByCard(cardId: ID): Promise<InvoiceListItem[]>;
  listByFamily(familyId: ID): Promise<InvoiceListItem[]>;
  getDetails(invoiceId: ID): Promise<InvoiceDetails>;
  create(cardId: ID, ref: InvoiceRef): Promise<Invoice>;
  changeStatus(invoiceId: ID, status: InvoiceStatus): Promise<Invoice>;
}

export interface PurchaseRepository {
  create(input: CreatePurchaseInput): Promise<PurchaseDetails>;
  update(purchaseId: ID, changes: UpdatePurchaseInput): Promise<PurchaseDetails>;
  cancel(purchaseId: ID): Promise<void>;
  get(purchaseId: ID): Promise<PurchaseDetails>;
  search(familyId: ID, filters: HistoryFilters): Promise<PurchaseListItem[]>;
}

export interface CategoryRepository {
  list(familyId: ID): Promise<Category[]>;
  create(familyId: ID, input: CategoryInput): Promise<Category>;
  update(categoryId: ID, input: Partial<CategoryInput>): Promise<Category>;
  remove(categoryId: ID): Promise<void>;
  reorder(familyId: ID, orderedIds: ID[]): Promise<void>;
}

export interface PaymentRepository {
  register(input: RegisterPaymentInput): Promise<Payment>;
  /** Holder confirms a transfer a member marked as sent. */
  confirm(paymentId: ID): Promise<Payment>;
  reject(paymentId: ID, note?: string): Promise<Payment>;
}

/** Invoice review ("conferência"): each person confirms or contests their purchases. */
export interface ReviewRepository {
  confirm(invoiceId: ID, purchaseId: ID): Promise<PurchaseReview>;
  dispute(invoiceId: ID, purchaseId: ID, input: DisputeInput): Promise<PurchaseReview>;
  /** Holder answers a dispute. */
  resolve(reviewId: ID, note: string): Promise<PurchaseReview>;
}

export interface AliasRepository {
  list(familyId: ID): Promise<MerchantAlias[]>;
  /** Creates or replaces the alias for a statement name. */
  save(familyId: ID, statementName: string, merchant: string): Promise<MerchantAlias>;
  remove(aliasId: ID): Promise<void>;
}

export interface NotificationRepository {
  list(): Promise<NotificationView[]>;
  unreadCount(): Promise<number>;
  /** Marks the given notifications (or all of them) as read. */
  markRead(ids?: ID[]): Promise<void>;
}

export interface StatisticsRepository {
  get(familyId: ID, filters: StatisticsFilters): Promise<StatisticsView>;
}

export interface AttachmentRepository {
  add(input: AddAttachmentInput): Promise<Attachment>;
  remove(attachmentId: ID): Promise<void>;
  getData(attachmentId: ID): Promise<AttachmentData>;
}

export interface DashboardRepository {
  home(familyId: ID): Promise<HomeSummary>;
  activity(familyId: ID): Promise<AuditLogView[]>;
}

export interface Repositories {
  auth: AuthRepository;
  families: FamilyRepository;
  wallets: WalletRepository;
  cards: CardRepository;
  invoices: InvoiceRepository;
  purchases: PurchaseRepository;
  categories: CategoryRepository;
  payments: PaymentRepository;
  reviews: ReviewRepository;
  aliases: AliasRepository;
  notifications: NotificationRepository;
  statistics: StatisticsRepository;
  attachments: AttachmentRepository;
  dashboard: DashboardRepository;
}
