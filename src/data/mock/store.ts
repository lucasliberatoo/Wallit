import {
  type Card,
  closingDateFor,
  dueDateFor,
  type FamilyMember,
  type ID,
  type Invoice,
  type InvoiceRef,
  refKey,
  type AuditLog,
} from '@/domain';
import { AppError } from '../errors';
import { emptyDatabase, loadDatabase, type MockDatabase, saveDatabase } from './database';

type Collection = Exclude<keyof MockDatabase, 'version' | 'sessionUserId'>;

let counter = 0;
export function newId(prefix: string): ID {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}

/** Simulated network latency so loading states are exercised in development. */
const DEFAULT_LATENCY_MS = 120;

/**
 * In-memory database with persistence, plus the helpers every mock
 * repository needs (current user, membership checks, audit trail).
 */
export class MockStore {
  db: MockDatabase = emptyDatabase();
  private ready: Promise<void> | null = null;

  constructor(
    private readonly seed: (store: MockStore) => void,
    private readonly latencyMs = DEFAULT_LATENCY_MS,
  ) {}

  init(): Promise<void> {
    this.ready ??= (async () => {
      const saved = await loadDatabase();
      if (saved) {
        this.db = saved;
      } else {
        this.seed(this);
        await saveDatabase(this.db);
      }
    })();
    return this.ready;
  }

  /** Runs a repository operation: waits for init, simulates latency, persists writes. */
  async run<T>(operation: () => T, options: { write?: boolean } = {}): Promise<T> {
    await this.init();
    if (this.latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
    const result = operation();
    if (options.write) await saveDatabase(this.db);
    return structuredCloneSafe(result);
  }

  async reset(): Promise<void> {
    this.db = emptyDatabase();
    this.seed(this);
    await saveDatabase(this.db);
  }

  find<K extends Collection>(collection: K, id: ID): MockDatabase[K][number] | undefined {
    return (this.db[collection] as { id?: ID }[]).find((item) => item.id === id) as MockDatabase[K][number] | undefined;
  }

  require<K extends Collection>(collection: K, id: ID, label = 'Registro'): MockDatabase[K][number] {
    const item = this.find(collection, id);
    if (!item) throw new AppError('not_found', `${label} não encontrado.`);
    return item;
  }

  currentUserId(): ID {
    if (!this.db.sessionUserId) throw new AppError('forbidden', 'Faça login para continuar.');
    return this.db.sessionUserId;
  }

  /** Rule 8/9: every read and write is scoped to families the user belongs to. */
  requireMembership(familyId: ID): FamilyMember {
    const userId = this.currentUserId();
    const member = this.db.members.find((m) => m.familyId === familyId && m.userId === userId && m.status === 'active');
    if (!member) throw new AppError('forbidden', 'Você não tem acesso a esta família.');
    return member;
  }

  activeMembers(familyId: ID): FamilyMember[] {
    return this.db.members.filter((m) => m.familyId === familyId && m.status === 'active');
  }

  member(memberId: ID): FamilyMember {
    return this.require('members', memberId, 'Membro') as FamilyMember;
  }

  findInvoice(cardId: ID, ref: InvoiceRef): Invoice | undefined {
    const key = refKey(ref);
    return this.db.invoices.find((invoice) => invoice.cardId === cardId && refKey(invoice.ref) === key);
  }

  /** Invoices are created on demand from the card's closing and due days. */
  getOrCreateInvoice(card: Card, ref: InvoiceRef): Invoice {
    const existing = this.findInvoice(card.id, ref);
    if (existing) return existing;
    const invoice: Invoice = {
      id: newId('inv'),
      familyId: card.familyId,
      cardId: card.id,
      ref,
      closingDate: closingDateFor(ref, card.closingDay),
      dueDate: dueDateFor(ref, card.closingDay, card.dueDay),
      status: 'open',
    };
    this.db.invoices.push(invoice);
    return invoice;
  }

  audit(entry: Omit<AuditLog, 'id' | 'at' | 'actorUserId'> & { actorUserId?: ID }): void {
    this.db.auditLogs.push({
      ...entry,
      id: newId('log'),
      at: nowISO(),
      actorUserId: entry.actorUserId ?? this.currentUserId(),
    });
  }
}

function structuredCloneSafe<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}
