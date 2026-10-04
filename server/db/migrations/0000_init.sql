CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"family_id" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"summary" text NOT NULL,
	"changes" jsonb NOT NULL,
	"actor_user_id" text NOT NULL,
	"at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"id" text PRIMARY KEY NOT NULL,
	"family_id" text NOT NULL,
	"wallet_id" text NOT NULL,
	"name" text NOT NULL,
	"holder_member_id" text NOT NULL,
	"theme" text NOT NULL,
	"brand" text,
	"limit_cents" integer,
	"closing_day" integer NOT NULL,
	"due_day" integer NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "cards_closing_day_ck" CHECK ("cards"."closing_day" between 1 and 31),
	CONSTRAINT "cards_due_day_ck" CHECK ("cards"."due_day" between 1 and 31),
	CONSTRAINT "cards_limit_ck" CHECK ("cards"."limit_cents" is null or "cards"."limit_cents" > 0),
	CONSTRAINT "cards_status_ck" CHECK ("cards"."status" in ('active', 'blocked', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"family_id" text NOT NULL,
	"name" text NOT NULL,
	"icon" text NOT NULL,
	"color" text NOT NULL,
	"sort_order" integer NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "families" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "family_invites" (
	"code" text PRIMARY KEY NOT NULL,
	"family_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "family_members" (
	"id" text PRIMARY KEY NOT NULL,
	"family_id" text NOT NULL,
	"user_id" text,
	"display_name" text NOT NULL,
	"nickname" text,
	"role" text NOT NULL,
	"avatar_color" text NOT NULL,
	"status" text NOT NULL,
	"joined_at" timestamp with time zone NOT NULL,
	CONSTRAINT "family_members_role_ck" CHECK ("family_members"."role" in ('owner', 'titular', 'member', 'guest')),
	CONSTRAINT "family_members_status_ck" CHECK ("family_members"."status" in ('active', 'removed'))
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"family_id" text NOT NULL,
	"card_id" text NOT NULL,
	"ref_year" integer NOT NULL,
	"ref_month" integer NOT NULL,
	"closing_date" date NOT NULL,
	"due_date" date NOT NULL,
	"status" text NOT NULL,
	CONSTRAINT "invoices_month_ck" CHECK ("invoices"."ref_month" between 1 and 12),
	CONSTRAINT "invoices_status_ck" CHECK ("invoices"."status" in ('open', 'reviewing', 'closed', 'collecting', 'paid', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"family_id" text NOT NULL,
	"invoice_id" text NOT NULL,
	"member_id" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"paid_at" timestamp with time zone NOT NULL,
	"registered_by" text NOT NULL,
	"note" text,
	CONSTRAINT "payments_amount_ck" CHECK ("payments"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "purchase_installments" (
	"id" text PRIMARY KEY NOT NULL,
	"family_id" text NOT NULL,
	"purchase_id" text NOT NULL,
	"invoice_id" text NOT NULL,
	"number" integer NOT NULL,
	"count" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	CONSTRAINT "purchase_installments_number_ck" CHECK ("purchase_installments"."number" between 1 and "purchase_installments"."count"),
	CONSTRAINT "purchase_installments_amount_ck" CHECK ("purchase_installments"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "purchase_shares" (
	"id" text PRIMARY KEY NOT NULL,
	"family_id" text NOT NULL,
	"purchase_id" text NOT NULL,
	"member_id" text NOT NULL,
	"amount_cents" integer NOT NULL,
	CONSTRAINT "purchase_shares_amount_ck" CHECK ("purchase_shares"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" text PRIMARY KEY NOT NULL,
	"family_id" text NOT NULL,
	"card_id" text NOT NULL,
	"merchant" text NOT NULL,
	"statement_name" text,
	"total_cents" integer NOT NULL,
	"date" date NOT NULL,
	"category_id" text NOT NULL,
	"buyer_member_id" text NOT NULL,
	"installment_count" integer NOT NULL,
	"note" text,
	"status" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "purchases_total_ck" CHECK ("purchases"."total_cents" > 0),
	CONSTRAINT "purchases_installments_ck" CHECK ("purchases"."installment_count" between 1 and 48),
	CONSTRAINT "purchases_status_ck" CHECK ("purchases"."status" in ('active', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"avatar_color" text DEFAULT '#155EEF' NOT NULL,
	"pix_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" text PRIMARY KEY NOT NULL,
	"family_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_holder_member_id_family_members_id_fk" FOREIGN KEY ("holder_member_id") REFERENCES "public"."family_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "families" ADD CONSTRAINT "families_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_invites" ADD CONSTRAINT "family_invites_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_registered_by_user_id_fk" FOREIGN KEY ("registered_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_installments" ADD CONSTRAINT "purchase_installments_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_installments" ADD CONSTRAINT "purchase_installments_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_installments" ADD CONSTRAINT "purchase_installments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_shares" ADD CONSTRAINT "purchase_shares_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_shares" ADD CONSTRAINT "purchase_shares_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_shares" ADD CONSTRAINT "purchase_shares_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_buyer_member_id_family_members_id_fk" FOREIGN KEY ("buyer_member_id") REFERENCES "public"."family_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_family_idx" ON "audit_logs" USING btree ("family_id","at");--> statement-breakpoint
CREATE INDEX "cards_family_idx" ON "cards" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "categories_family_idx" ON "categories" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "family_invites_family_idx" ON "family_invites" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "family_members_family_idx" ON "family_members" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "family_members_user_idx" ON "family_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "family_members_family_user_uq" ON "family_members" USING btree ("family_id","user_id") WHERE "family_members"."user_id" is not null;--> statement-breakpoint
CREATE INDEX "invoices_family_idx" ON "invoices" USING btree ("family_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_card_ref_uq" ON "invoices" USING btree ("card_id","ref_year","ref_month");--> statement-breakpoint
CREATE INDEX "payments_family_idx" ON "payments" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "purchase_installments_family_idx" ON "purchase_installments" USING btree ("family_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_installments_number_uq" ON "purchase_installments" USING btree ("purchase_id","number");--> statement-breakpoint
CREATE INDEX "purchase_shares_family_idx" ON "purchase_shares" USING btree ("family_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_shares_member_uq" ON "purchase_shares" USING btree ("purchase_id","member_id");--> statement-breakpoint
CREATE INDEX "purchases_family_idx" ON "purchases" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wallets_family_idx" ON "wallets" USING btree ("family_id");