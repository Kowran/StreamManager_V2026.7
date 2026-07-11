-- The discount_coupons table has a NOT NULL constraint on 'name' but the
-- frontend uses 'description' for display. Give 'name' a default so inserts work.
ALTER TABLE discount_coupons ALTER COLUMN name SET DEFAULT '';
