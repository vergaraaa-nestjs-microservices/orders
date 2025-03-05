import { IsString, IsUrl, IsUUID } from 'class-validator';

export class PaymentSuccededDto {
  @IsString()
  stripePaymentId: string;

  @IsString()
  @IsUUID()
  orderId: string;

  @IsString()
  @IsUrl()
  receiptUrl: string;
}
