import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AiFinancialAccessGuard } from './ai-financial-access.guard';
import { FinancialAiQuery, FinancialAiQueryService } from './financial-ai-query.service';
import { FinancialAiAnswerService } from './financial-ai-answer.service';
import { PrismaService } from './prisma.service';

@Controller('companies/:companyId/financial-ai')
@UseGuards(JwtAuthGuard, AiFinancialAccessGuard)
export class AiFinancialController {
  constructor(private readonly queries: FinancialAiQueryService, private readonly answers: FinancialAiAnswerService, private readonly prisma: PrismaService) {}

  @Get('capabilities')
  capabilities(@Param('companyId') companyId: string, @Req() req: any) {
    return { enabled: true, mode: 'read-only-grounded', companyId, role: req.membership.role, intents: ['profitability','profitability-comparison','receivables','payables','bank-balances'], restrictions: { arbitrarySql:false, mayPostTransactions:false, mayModifyTransactions:false, mayDeleteTransactions:false, mayChangePermissions:false } };
  }

  @Post('facts')
  facts(@Param('companyId') companyId: string, @Body() body: FinancialAiQuery) { return this.queries.execute(companyId, body); }

  @Post('ask')
  async ask(@Req() req:any,@Param('companyId') companyId:string,@Body() body:{question?:string;language?:'ar'|'en'}) {
    const requestId=randomUUID(),language=body.language==='en'?'en':'ar',started=Date.now();
    try{
      const result=await this.answers.answer(companyId,body.question??'',language);
      await this.prisma.auditLog.create({data:{companyId,userId:req.user.sub,action:'READ',entityType:'FinancialAI',entityId:requestId,afterPayload:{requestId,intent:result.intent,language,status:'success',durationMs:Date.now()-started,modelUsed:result.modelUsed}}});
      return {...result,requestId};
    }catch(error){
      await this.prisma.auditLog.create({data:{companyId,userId:req.user.sub,action:'READ',entityType:'FinancialAI',entityId:requestId,afterPayload:{requestId,language,status:'failed',durationMs:Date.now()-started}}}).catch(()=>undefined);
      throw error;
    }
  }
}
