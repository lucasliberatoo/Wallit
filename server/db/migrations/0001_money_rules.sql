-- A purchase's shares and installments must each add up to its total, and it
-- must have exactly installment_count installments. Checked at commit time
-- (deferred), so a purchase and its rows can be written in any order inside
-- one transaction, but an unbalanced purchase can never be saved.
CREATE OR REPLACE FUNCTION wallit_check_purchase(p_id text) RETURNS void AS $$
DECLARE
  p purchases%ROWTYPE;
  shares_total bigint;
  installments_total bigint;
  installments_count integer;
BEGIN
  SELECT * INTO p FROM purchases WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  SELECT coalesce(sum(amount_cents), 0) INTO shares_total FROM purchase_shares WHERE purchase_id = p_id;
  SELECT coalesce(sum(amount_cents), 0), count(*) INTO installments_total, installments_count
    FROM purchase_installments WHERE purchase_id = p_id;
  IF shares_total <> p.total_cents THEN
    RAISE EXCEPTION 'purchase % shares add up to % but the total is %', p_id, shares_total, p.total_cents
      USING ERRCODE = 'check_violation';
  END IF;
  IF installments_total <> p.total_cents OR installments_count <> p.installment_count THEN
    RAISE EXCEPTION 'purchase % installments do not match its total or count', p_id
      USING ERRCODE = 'check_violation';
  END IF;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION wallit_check_purchase_trigger() RETURNS trigger AS $$
BEGIN
  IF TG_TABLE_NAME = 'purchases' THEN
    PERFORM wallit_check_purchase(NEW.id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM wallit_check_purchase(OLD.purchase_id);
  ELSE
    PERFORM wallit_check_purchase(NEW.purchase_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER purchases_balanced
  AFTER INSERT OR UPDATE ON purchases
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION wallit_check_purchase_trigger();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER purchase_shares_balanced
  AFTER INSERT OR UPDATE OR DELETE ON purchase_shares
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION wallit_check_purchase_trigger();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER purchase_installments_balanced
  AFTER INSERT OR UPDATE OR DELETE ON purchase_installments
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION wallit_check_purchase_trigger();
