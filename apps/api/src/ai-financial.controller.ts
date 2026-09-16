import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AiFinancialAccessGuard } from './ai-financial-access.guard';
import { FinancialAiQuery, FinancialAiQueryService } from './financial-ai-query.service';

@Controller('companies/:companyId/financial-ai')
@UseGuards(JwtAuthGuard, AiFinancialAccessGuard)
export class AiFinancialController {
  constructor(private readonly queries: FinancialAiQueryService) {}

  @Get('capabilities')
  capabilities(@Param('companyId') companyId: string, @Req() req: any) {
    return {
      enabled: true,
      mode: 'read-only-deterministic',
      companyId,
      role: req.membership.role,
      intents: ['profitability', 'profitability-comparison', 'receivables', 'payables', 'bank-balances'],
      restrictions: { arbitrarySql: false, mayPostTransactions: false, mayModifyTransactions: false, mayDeleteTransactions: false, mayChangePermissions: false },
    };
  }

  /**
   * Safe machine-readable facts endpoint. It deliberately accepts an allowlisted
   * intent instead of free-form SQL or model-selected database operations.
   */
  @Post('facts')
  facts(@Param('companyId') companyId: string, @Body() body: FinancialAiQuery) {
    return this.queries.execute(companyId, body);
  }

  @Post('ask')
  ask(@Param('companyId') companyId: string, @Body() body: { question?: string; language?: 'ar' | 'en' }) {
    return {
      ready: false,
      companyId,
      language: body.language === 'en' ? 'en' : 'ar',
      message: body.language === 'en'
        ? 'Natural-language AI remains disabled until provider isolation, auditing, and tests are complete.'
        : 'الأسئلة باللغة الطبيعية ما زالت معطلة حتى اكتمال عزل مزود الذكاء الاصطناعي والتدقيق والاختبارات.',
    };
  }
}
