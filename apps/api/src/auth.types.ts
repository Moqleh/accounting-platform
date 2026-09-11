export type AuthenticatedRequest = {
  user: { sub: string; email: string; companyId?: string };
  membership?: { role: string; dataScope: string | null; companyId: string; userId: string };
  params?: Record<string, string>;
  body?: Record<string, unknown>;
};
