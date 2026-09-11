export const RolePermissions: Record<string, string[]> = {
  Admin: ['*'],
  Owner: ['*'],
  Accountant: ['accounting.read','accounting.write','sales.read','sales.write','purchases.read','purchases.write','inventory.read','reports.read','payments.write'],
  Sales: ['sales.read','sales.write','customers.read','customers.write','inventory.read'],
  Purchases: ['purchases.read','purchases.write','suppliers.read','suppliers.write','inventory.read'],
  Employee: ['dashboard.read'],
};

export function hasPermission(role: string, permission: string) {
  const permissions = RolePermissions[role] ?? [];
  return permissions.includes('*') || permissions.includes(permission);
}
