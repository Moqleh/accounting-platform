import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AiFinancialAccessGuard } from './ai-financial-access.guard';

/**
 * Phase 1 security boundary for the Financial AI Copilot.
 * No model/provider is connected yet. We establish authorization first.
 */
@Controller('companies/:companyId/financial-ai')
@UseGuards(JwtAuthGuard, AiFinancialAccessGuard)
export class AiFinancialController {
  @Get('capabilities')
  capabilities(@Param('companyId') companyId: string, @Req() req: any) {
    return {
      enabled: true,
      mode: 'read-only',
      companyId,
      role: req.membership.role,
      capabilities: [
        'sales-summary',
        'purchases-summary',
        'receivables-aging',
        'payables-aging',
        'cash-and-bank-balances',
        'profitability-comparison',
      ],
      restrictions: {
        mayPostTransactions: false,
        mayModifyTransactions: false,
        mayDeleteTransactions: false,
        mayChangePermissions: false,
      },
    };
  }

  @Post('ask')
  ask(@Param('companyId') companyId: string, @Body() body: { question?: string; language?: 'ar' | 'en' }) {
    // Intentionally fail closed until deterministic financial query services
    // and the audited AI provider adapter are wired in.
    return {
      ready: false,
      companyId,
      language: body.language === 'en' ? 'en' : 'ar',
      message:
        body.language === 'en'
          ? 'Financial AI analysis is not enabled until the audited data layer is connected.'
          : 'التحليل المالي بالذكاء الاصطناعي غير مفعّل حتى يتم ربط طبقة البيانات المالية المدققة.',
    };
  }
}
