import { Controller, ParseUUIDPipe } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersPaginationDto } from './dto/orders-pagination.dto';
import { ChangeOrderStatusDto } from './dto/change-order-status.dto';
import { PaymentSuccededDto } from './dto/payment-succeded.dto';

@Controller()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @MessagePattern('createOrder')
  async create(@Payload() createOrderDto: CreateOrderDto) {
    const order = await this.ordersService.create(createOrderDto);

    const paymentSession = await this.ordersService.createPaymentSession(order);

    return { order, paymentSession };
  }

  @MessagePattern('findAllOrders')
  findAll(@Payload() ordersPaginationDato: OrdersPaginationDto) {
    return this.ordersService.findAll(ordersPaginationDato);
  }

  @MessagePattern('findOneOrder')
  findOne(@Payload(ParseUUIDPipe) id: string) {
    return this.ordersService.findOne(id);
  }

  @MessagePattern('changeOrderStatus')
  changeOrderStatus(@Payload() changeOrderStatusDto: ChangeOrderStatusDto) {
    return this.ordersService.changeStatus(changeOrderStatusDto);
  }

  @EventPattern('payment.succeded')
  paymentSucceded(@Payload() paymentSuccededDto: PaymentSuccededDto) {
    console.log({ paymentSuccededDto });
    return;
  }
}
