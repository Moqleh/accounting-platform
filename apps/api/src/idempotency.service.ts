import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, PrismaClientKnownRequestError } from '@prisma/client';
import { createHash } from 'node:crypto';

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
    try{
      const created=await tx.idempotencyRecord.create({data:{companyId,endpoint,key,payloadHash,status:'Processing',lockedAt:new Date()}});
      return {id:created.id};
    }catch(error){
      if(!(error instanceof PrismaClientKnownRequestError)||error.code!=='P2002') throw error;
      const existing=await tx.idempotencyRecord.findUnique({where:{companyId_endpoint_key:{companyId,endpoint,key}}});
      if(!existing) throw error;
      if(existing.payloadHash!==payloadHash) throw new ConflictException('Idempotency key was already used with a different payload');
      if(existing.status==='Completed') return {id:existing.id,replay:existing.response};
      throw new ConflictException('A request with this idempotency key is already processing');
    }
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
