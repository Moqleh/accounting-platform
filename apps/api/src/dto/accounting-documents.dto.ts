import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsISO8601, IsOptional, IsString, IsUUID, Length, Matches, ValidateNested } from 'class-validator';

const positiveDecimal = /^(?:0\.\d*[1-9]\d*|[1-9]\d*(?:\.\d+)?)$/;
const nonNegativeDecimal = /^(?:0|0\.\d+|[1-9]\d*(?:\.\d+)?)$/;

class TaxableDocumentLineDto {
  @IsUUID()
  itemId!: string;

  @Matches(positiveDecimal, { message: 'quantity must be a positive decimal string' })
  quantity!: string;

  @IsOptional()
  @IsUUID()
  taxRateId?: string;
}

export class SalesInvoiceLineDto extends TaxableDocumentLineDto {
  @Matches(nonNegativeDecimal, { message: 'unitPrice must be a non-negative decimal string' })
  unitPrice!: string;
}

export class PurchaseBillLineDto extends TaxableDocumentLineDto {
  @Matches(nonNegativeDecimal, { message: 'unitCost must be a non-negative decimal string' })
  unitCost!: string;
}

class BasePostingDocumentDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  warehouseId!: string;

  @IsISO8601({ strict: true })
  documentDate!: string;

  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/, { message: 'currencyCode must be a 3-letter uppercase ISO-style code' })
  currencyCode!: string;

  @Matches(positiveDecimal, { message: 'exchangeRate must be a positive decimal string' })
  exchangeRate!: string;
}

export class CreateSalesInvoiceDto extends BasePostingDocumentDto {
  @IsUUID()
  customerId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SalesInvoiceLineDto)
  lines!: SalesInvoiceLineDto[];
}

export class CreatePurchaseBillDto extends BasePostingDocumentDto {
  @IsUUID()
  supplierId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseBillLineDto)
  lines!: PurchaseBillLineDto[];
}
