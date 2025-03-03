import { IsEnum, IsOptional } from 'class-validator';

import { OrderStatusList } from '../enum/order.enum';
import { OrderStatus } from '@prisma/client';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export class OrdersPaginationDto extends PaginationDto {
  @IsOptional()
  @IsEnum(OrderStatusList, {
    message: `Possible status values are ${OrderStatusList.join(', ')}`,
  })
  status?: OrderStatus;
}
