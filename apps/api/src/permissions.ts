export const RolePermissions:Record<string,string[]>={
 Admin:['*'],Owner:['*'],
 FinancialManager:['dashboard.read','accounting.read','accounting.write','sales.read','sales.write','purchases.read','purchases.write','customers.read','customers.write','suppliers.read','suppliers.write','inventory.read','reports.read','payments.write'],
 Accountant:['dashboard.read','accounting.read','accounting.write','sales.read','sales.write','purchases.read','purchases.write','customers.read','customers.write','suppliers.read','suppliers.write','inventory.read','reports.read','payments.write'],
 Sales:['dashboard.read','accounting.read','sales.read','sales.write','customers.read','customers.write','inventory.read'],
 Purchases:['dashboard.read','accounting.read','purchases.read','purchases.write','suppliers.read','suppliers.write','inventory.read'],
 Employee:['dashboard.read'],
};
export function hasPermission(role:string,permission:string){const permissions=RolePermissions[role]??[];return permissions.includes('*')||permissions.includes(permission)}
