import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';

type Claim = { id:string; replay?:unknown };

@Injectable()
export class IdempotencyService {
  payloadHash(payload: unknown) {
    return createHash('sha256').update(JSON.stringify(this.canonical(payload))).digest('hex');
  }

  async reserve(tx: Prisma.TransactionClient, companyId:string, endpoint:string, key:string|undefined, payload:unknown):Promise<Claim|null>{
    if(!key) return null;
    if(key.length>200) throw new ConflictException('Idempotency key is too long');
    const payloadHash=this.payloadHash(payload);
    const candidateId=randomUUID();

    // PostgreSQL aborts the whole transaction after a unique-constraint error.
    // ON CONFLICT DO NOTHING preserves the transaction so an existing request can
    // be inspected and safely replayed without turning a legitimate retry into 500.
    const inserted=await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`
      INSERT INTO "IdempotencyRecord"
        ("id","companyId","endpoint","key","payloadHash","status","lockedAt","createdAt","updatedAt")
      VALUES
        (${candidateId}::uuid,${companyId}::uuid,${endpoint},${key},${payloadHash},'Processing'::"IdempotencyStatus",NOW(),NOW(),NOW())
      ON CONFLICT ("companyId","endpoint","key") DO NOTHING
      RETURNING "id"
    `);
    if(inserted.length) return {id:inserted[0].id};

    const existing=await tx.idempotencyRecord.findUnique({where:{companyId_endpoint_key:{companyId,endpoint,key}}});
    if(!existing) throw new ConflictException('Unable to reserve idempotency key');
    if(existing.payloadHash!==payloadHash) throw new ConflictException('Idempotency key was already used with a different payload');
    if(existing.status==='Completed') return {id:existing.id,replay:existing.response};
    throw new ConflictException('A request with this idempotency key is already processing');
  }

  async complete(tx:Prisma.TransactionClient,claim:Claim|null,statusCode:number,response:unknown){
    if(!claim) return;
    const safe=JSON.parse(JSON.stringify(response)) as Prisma.InputJsonValue;
    await tx.idempotencyRecord.update({where:{id:claim.id},data:{status:'Completed',statusCode,response:safe,lockedAt:null}});
  }

  private canonical(value:unknown):unknown{
    if(Array.isArray(value)) return value.map(v=>this.canonical(v));
    if(value&&typeof value==='object') return Object.fromEntries(Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,this.canonical(v)]));
    return value;
  }
}
