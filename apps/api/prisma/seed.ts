import { AccountType, ItemType, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const DEMO_COMPANY_ID='11111111-1111-4111-8111-111111111111';

async function main(){
  await prisma.currency.upsert({where:{code:'SAR'},update:{},create:{code:'SAR',name:'Saudi Riyal',symbol:'ر.س',decimalPlaces:2}});
  await prisma.currency.upsert({where:{code:'USD'},update:{},create:{code:'USD',name:'US Dollar',symbol:'$',decimalPlaces:2}});
  const company=await prisma.company.upsert({where:{id:DEMO_COMPANY_ID},update:{name:'Example Trading Company'},create:{id:DEMO_COMPANY_ID,name:'Example Trading Company',taxNumber:'310000000000003',baseCurrencyCode:'SAR'}});
  const seedPassword=process.env.SEED_ADMIN_PASSWORD;
  const passwordHash=seedPassword?await bcrypt.hash(seedPassword,12):undefined;
  const user=await prisma.user.upsert({where:{email:'admin@example.com'},update:{fullName:'Mohammed Admin',...(passwordHash?{passwordHash}:{})},create:{email:'admin@example.com',fullName:'Mohammed Admin',passwordHash}});
  await prisma.companyMembership.upsert({where:{companyId_userId:{companyId:company.id,userId:user.id}},update:{role:'Admin',dataScope:'all'},create:{companyId:company.id,userId:user.id,role:'Admin',dataScope:'all'}});
  const year=await prisma.fiscalYear.upsert({where:{companyId_name:{companyId:company.id,name:'FY2026'}},update:{},create:{companyId:company.id,name:'FY2026',startDate:new Date('2026-01-01'),endDate:new Date('2026-12-31')}});
  for(let m=1;m<=12;m++){const start=new Date(Date.UTC(2026,m-1,1));const end=new Date(Date.UTC(2026,m,0));await prisma.fiscalPeriod.upsert({where:{fiscalYearId_number:{fiscalYearId:year.id,number:m}},update:{},create:{fiscalYearId:year.id,number:m,startDate:start,endDate:end}})}
  const roots=[['1','Assets',AccountType.Asset],['2','Liabilities',AccountType.Liability],['3','Equity',AccountType.Equity],['4','Revenue',AccountType.Revenue],['5','Expenses',AccountType.Expense]] as const;
  const rootIds:Record<string,string>={};
  for(const [code,name,type] of roots){const a=await prisma.account.upsert({where:{companyId_code:{companyId:company.id,code}},update:{isLeaf:false},create:{companyId:company.id,code,name,type,isLeaf:false}});rootIds[code]=a.id}
  const leaves=[['1110','Cash',AccountType.Asset,'1'],['1120','Accounts Receivable',AccountType.Asset,'1'],['1130','Inventory',AccountType.Asset,'1'],['2110','Accounts Payable',AccountType.Liability,'2'],['2120','Output VAT',AccountType.Liability,'2'],['2130','Input VAT',AccountType.Asset,'1'],['3100','Retained Earnings',AccountType.Equity,'3'],['4100','Sales Revenue',AccountType.Revenue,'4'],['5100','Cost of Goods Sold',AccountType.Expense,'5'],['5200','Operating Expenses',AccountType.Expense,'5']] as const;
  const acc:Record<string,string>={};
  for(const [code,name,type,parent] of leaves){const a=await prisma.account.upsert({where:{companyId_code:{companyId:company.id,code}},update:{},create:{companyId:company.id,code,name,type,parentId:rootIds[parent],isLeaf:true}});acc[code]=a.id}
  const warehouse=await prisma.warehouse.upsert({where:{companyId_code:{companyId:company.id,code:'MAIN'}},update:{},create:{companyId:company.id,code:'MAIN',name:'Main Warehouse'}});
  const tax=await prisma.taxRate.upsert({where:{companyId_code_effectiveFrom:{companyId:company.id,code:'VAT15',effectiveFrom:new Date('2020-07-01')}},update:{},create:{companyId:company.id,code:'VAT15',name:'VAT 15%',rate:'0.15',salesTaxAccountId:acc['2120'],purchaseTaxAccountId:acc['2130'],effectiveFrom:new Date('2020-07-01')}});
  const laptop=await prisma.item.upsert({where:{companyId_code:{companyId:company.id,code:'LP001'}},update:{},create:{companyId:company.id,code:'LP001',name:'Laptop',type:ItemType.Inventory,revenueAccountId:acc['4100'],inventoryAccountId:acc['1130'],cogsAccountId:acc['5100']}});
  await prisma.item.upsert({where:{companyId_code:{companyId:company.id,code:'MS002'}},update:{},create:{companyId:company.id,code:'MS002',name:'Wireless Mouse',type:ItemType.Inventory,revenueAccountId:acc['4100'],inventoryAccountId:acc['1130'],cogsAccountId:acc['5100']}});
  await prisma.customer.upsert({where:{companyId_code:{companyId:company.id,code:'C001'}},update:{},create:{companyId:company.id,code:'C001',name:'Al Noor Company',email:'info@alnoor.com',phone:'0501234567'}});
  await prisma.supplier.upsert({where:{companyId_code:{companyId:company.id,code:'S001'}},update:{},create:{companyId:company.id,code:'S001',name:'Tech Company',email:'sales@tech.com',phone:'0505551111'}});
  const lotCount=await prisma.inventoryLot.count({where:{companyId:company.id,itemId:laptop.id,warehouseId:warehouse.id}});
  if(!lotCount) await prisma.inventoryLot.create({data:{companyId:company.id,itemId:laptop.id,warehouseId:warehouse.id,receivedDate:new Date('2026-09-01T08:00:00Z'),unitCost:'2800',initialQuantity:'20',remainingQuantity:'20'}});
  for(const [documentType,prefix] of [['SALES_INVOICE','INV-'],['PURCHASE_BILL','PUR-'],['JOURNAL','JV-']] as const){await prisma.documentSequence.upsert({where:{companyId_fiscalYearId_branchCode_documentType:{companyId:company.id,fiscalYearId:year.id,branchCode:'MAIN',documentType}},update:{prefix},create:{companyId:company.id,fiscalYearId:year.id,branchCode:'MAIN',documentType,prefix,currentNumber:0n,padding:6}})}
  console.log({companyId:company.id,userId:user.id,taxRateId:tax.id,adminEmail:user.email,passwordConfigured:Boolean(passwordHash)});
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());