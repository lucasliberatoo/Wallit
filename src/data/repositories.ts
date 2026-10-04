import type { Category, FamilyMember, ID, Invoice, InvoiceRef, InvoiceStatus, Payment, Role, User, Wallet, Card, Family } from '../domain';
import type {
  AddMemberInput,
  AuditLogView,
  CardSummary,
  CategoryInput,
  CreateCardInput,
  CreatePurchaseInput,
  FamilySummary,
  HistoryFilters,
  HomeSummary,
  InvoiceDetails,
  InvoiceListItem,
  PurchaseDetails,
  PurchaseListItem,
  RegisterPaymentInput,
  Session,
  SignUpInput,
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
  updateProfile(changes: Partial<Pick<User, 'name' | 'pixKey' | 'avatarColor'>>): Promise<User>;
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
  dashboard: DashboardRepository;
}
