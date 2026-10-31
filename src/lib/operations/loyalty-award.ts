import 'server-only';
import {Prisma} from '@/generated/prisma/client';
import type {Context} from './shared';
// One atomic statement: the same customer lock used by checkout serializes
// awards with redemptions. Every inserted identity remains tenant constrained.
export function loyaltyAwardQuery(c:Context,input:{customerId:string;points:number;reason:string;membershipName:string;referralCode:string}){
 return Prisma.sql`WITH permitted AS MATERIALIZED (
  SELECT id FROM app."SalonCustomer" WHERE id=${input.customerId}::uuid AND "salonId"=${c.salonId}::uuid
 ), locked AS MATERIALIZED (
  SELECT pg_advisory_xact_lock(hashtextextended(${c.salonId+input.customerId},4))::text FROM permitted
 ), account AS (
  INSERT INTO app."LoyaltyAccount" (id,"salonId","customerId",points,"membershipName","referralCode","createdAt","updatedAt")
  SELECT gen_random_uuid(),${c.salonId}::uuid,${input.customerId}::uuid,${input.points},${input.membershipName},${input.referralCode},now(),now() FROM locked
  ON CONFLICT ("salonId","customerId") DO UPDATE SET points=app."LoyaltyAccount".points+EXCLUDED.points,"membershipName"=CASE WHEN EXCLUDED."membershipName"='' THEN app."LoyaltyAccount"."membershipName" ELSE EXCLUDED."membershipName" END,"updatedAt"=now()
  WHERE app."LoyaltyAccount".points::bigint+EXCLUDED.points BETWEEN 0 AND 2147483647
  RETURNING id,points
 ), ledger AS (
  INSERT INTO app."LoyaltyEntry" (id,"salonId","customerId",points,reason,"actorUserId","createdAt","updatedAt")
  SELECT gen_random_uuid(),${c.salonId}::uuid,${input.customerId}::uuid,${input.points},${input.reason},${c.user.id}::uuid,now(),now() FROM account RETURNING id
 ), audited AS (
  INSERT INTO app."AuditEvent" (id,"salonId","actorUserId",action,"targetType","targetId",outcome)
  SELECT gen_random_uuid(),${c.salonId}::uuid,${c.user.id}::uuid,'loyalty.adjusted','loyalty',ledger.id,'allowed' FROM ledger RETURNING id
 ) SELECT ledger.id,account.points FROM ledger CROSS JOIN account CROSS JOIN audited`;
}
