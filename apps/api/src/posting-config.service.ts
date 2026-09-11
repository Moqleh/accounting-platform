import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

type Tx=Prisma.TransactionClient;
export type PostingConfig={receivableAccountId:string;payableAccountId:string;cashAccountId:string;retainedEarningsAccountId:string};

@Injectable()
export class PostingConfigService {
  async get(tx:Tx,companyId:string):Promise<PostingConfig>{
    const rows=await tx.$queryRaw<Array<Partial<PostingConfig>>>(Prisma.sql`SELECT "receivableAccountId","payableAccountId","cashAccountId","retainedEarningsAccountId" FROM "AccountingConfig" WHERE "companyId"=${companyId}::uuid`);
    const configured=rows[0]??{};
    const codes=await tx.account.findMany({where:{companyId,code:{in:['1110','1120','2110','3100']},isLeaf:true,isActive:true},select:{id:true,code:true}});
    const map=new Map(codes.map(a=>[a.code,a.id]));
    const receivableAccountId=configured.receivableAccountId??map.get('1120');
    const payableAccountId=configured.payableAccountId??map.get('2110');
    const cashAccountId=configured.cashAccountId??map.get('1110');
    const retainedEarningsAccountId=configured.retainedEarningsAccountId??map.get('3100');
    if(!receivableAccountId||!payableAccountId||!cashAccountId||!retainedEarningsAccountId) throw new Error('Accounting control accounts are not configured');
    return {receivableAccountId,payableAccountId,cashAccountId,retainedEarningsAccountId};
  }
}
