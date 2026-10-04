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
} from '../../domain';
import { AppError } from '../errors';
import { type Collection, type Database, emptyDatabase } from './database';

let counter = 0;
export function newId(prefix: string): ID {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}_${uuid.replace(/-/g, '').slice(0, 20)}`;
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}

/** Where a store's database comes from and goes to (device storage, Postgres, ...). */
export interface Persistence {
  load(): Promise<Database | null>;
  save(db: Database): Promise<void>;
}

export interface StoreOptions {
  persistence: Persistence;
  /** Fills an empty database (demo data). */
  seed?: (store: Store) => void;
  /** Simulated network latency so loading states are exercised in development. */
  latencyMs?: number;
}

/**
 * In-memory database plus the helpers every repository needs (current user,
 * membership checks, audit trail). The same repositories run on the device
 * (offline mock) and on the server (one store per request, loaded from and
 * written back to Postgres).
 */
export class Store {
  db: Database = emptyDatabase();
  private ready: Promise<void> | null = null;

  constructor(private readonly options: StoreOptions) {}

  init(): Promise<void> {
    this.ready ??= (async () => {
      const saved = await this.options.persistence.load();
      if (saved) {
        this.db = saved;
      } else {
        this.options.seed?.(this);
        await this.options.persistence.save(this.db);
      }
    })();
    return this.ready;
  }

  /** Runs a repository operation: waits for init, simulates latency, persists writes. */
  async run<T>(operation: () => T, options: { write?: boolean } = {}): Promise<T> {
    await this.init();
    const latency = this.options.latencyMs ?? 0;
    if (latency > 0) await new Promise((resolve) => setTimeout(resolve, latency));
    const result = operation();
    if (options.write) await this.options.persistence.save(this.db);
    return structuredCloneSafe(result);
  }

  async reset(): Promise<void> {
    this.db = emptyDatabase();
    this.options.seed?.(this);
    await this.options.persistence.save(this.db);
  }

  find<K extends Collection>(collection: K, id: ID): Database[K][number] | undefined {
    return (this.db[collection] as { id?: ID }[]).find((item) => item.id === id) as Database[K][number] | undefined;
  }

  require<K extends Collection>(collection: K, id: ID, label = 'Registro'): Database[K][number] {
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
