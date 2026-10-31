BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
CREATE TABLE app."LocationStock"(id uuid PRIMARY KEY,"salonId" uuid NOT NULL,"branchId" uuid NOT NULL,"productId" uuid NOT NULL,stock integer NOT NULL DEFAULT 0 CHECK(stock>=0),"createdAt" timestamptz NOT NULL DEFAULT now(),"updatedAt" timestamptz NOT NULL,UNIQUE(id,"salonId"),UNIQUE("salonId","branchId","productId"),FOREIGN KEY("branchId","salonId") REFERENCES app."Branch"(id,"salonId"),FOREIGN KEY("productId","salonId") REFERENCES app."Product"(id,"salonId"));
CREATE INDEX "LocationStock_salonId_branchId_idx" ON app."LocationStock"("salonId","branchId");
ALTER TABLE app."LocationStock" ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON app."LocationStock" TO saloonsync_runtime;
CREATE POLICY backend_runtime ON app."LocationStock" TO saloonsync_runtime USING(true) WITH CHECK(true);
DO $$ BEGIN IF EXISTS(SELECT 1 FROM app."Product" p WHERE p.stock>0 AND NOT EXISTS(SELECT 1 FROM app."Branch" b WHERE b."salonId"=p."salonId" AND b.status='active')) THEN RAISE EXCEPTION 'A product with opening stock needs an active location before allocation'; END IF; END $$;
-- Preserve existing quantities. Legacy shared stock is allocated to the first
-- active location; subsequent transfers explicitly move it between locations.
INSERT INTO app."LocationStock"(id,"salonId","branchId","productId",stock,"updatedAt") SELECT gen_random_uuid(),p."salonId",b.id,p.id,p.stock,now() FROM app."Product" p JOIN LATERAL(SELECT id FROM app."Branch" WHERE "salonId"=p."salonId" AND status='active' ORDER BY "createdAt",id LIMIT 1) b ON true;
CREATE FUNCTION app.location_stock_total() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='UPDATE' AND (NEW."salonId"<>OLD."salonId" OR NEW."branchId"<>OLD."branchId" OR NEW."productId"<>OLD."productId") THEN RAISE EXCEPTION 'Stock balance scope is immutable'; END IF;
 UPDATE app."Product" SET stock=stock+NEW.stock-(CASE WHEN TG_OP='INSERT' THEN 0 ELSE OLD.stock END),"updatedAt"=clock_timestamp() WHERE id=NEW."productId" AND "salonId"=NEW."salonId";
 RETURN NEW;
END $$;
CREATE TRIGGER location_stock_total AFTER INSERT OR UPDATE ON app."LocationStock" FOR EACH ROW EXECUTE FUNCTION app.location_stock_total();
CREATE FUNCTION app.protect_product_total() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF (TG_OP='INSERT' AND NEW.stock<>0) OR (TG_OP='UPDATE' AND NEW.stock<>OLD.stock AND pg_trigger_depth()=1) THEN RAISE EXCEPTION 'Change stock through a location balance'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_product_total BEFORE INSERT OR UPDATE ON app."Product" FOR EACH ROW EXECUTE FUNCTION app.protect_product_total();
COMMIT;
