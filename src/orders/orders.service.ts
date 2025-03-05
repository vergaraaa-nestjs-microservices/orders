import {
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { PrismaClient } from '@prisma/client';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { OrdersPaginationDto } from './dto/orders-pagination.dto';
import { ChangeOrderStatusDto } from './dto/change-order-status.dto';
import { NATS_SERVICE } from 'src/config/services';
import { catchError, firstValueFrom } from 'rxjs';
import { Product } from 'src/common/dto/product.dto';
import { OrderWithProducts } from './interfaces/order-with-products.interface';
import { StripePaymentSessionCreated } from './interfaces/stripe-payment-session-created.interface.dto';
import { PaymentSuccededDto } from './dto/payment-succeded.dto';

@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger('Orders service');

  constructor(@Inject(NATS_SERVICE) private readonly client: ClientProxy) {
    super();
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Db connected');
  }

  async create(createOrderDto: CreateOrderDto) {
    const productsIds = createOrderDto.items.map((item) => item.productId);

    const products = await firstValueFrom<Product[]>(
      this.client
        .send<Product[]>({ cmd: 'validate_products' }, productsIds)
        .pipe(
          catchError((error) => {
            if (typeof error === 'object') {
              throw new RpcException(error as object);
            }

            throw new RpcException('Unknown error');
          }),
        ),
    );

    const totalAmount = createOrderDto.items.reduce((acc, orderItem) => {
      const price = products.find(
        (product) => product.id === orderItem.productId,
      )!.price;

      return acc + price * orderItem.quantity;
    }, 0);

    const totalItems = createOrderDto.items.reduce((acc, orderItem) => {
      return acc + orderItem.quantity;
    }, 0);

    const order = await this.order.create({
      data: {
        totalAmount,
        totalItems,
        OrderItem: {
          createMany: {
            data: createOrderDto.items.map((orderItem) => ({
              price: products.find(
                (product) => product.id === orderItem.productId,
              )!.price,
              productId: orderItem.productId,
              quantity: orderItem.quantity,
            })),
          },
        },
      },
      include: {
        OrderItem: {
          select: {
            productId: true,
            price: true,
            quantity: true,
          },
        },
      },
    });

    return {
      ...order,
      items: order.OrderItem.map((orderItem) => ({
        ...orderItem,
        name: products.find((product) => product.id === orderItem.productId)
          ?.name,
      })),
      OrderItem: undefined,
    };
  }

  async findAll(ordersPaginationDato: OrdersPaginationDto) {
    const page = ordersPaginationDato.page;
    const limit = ordersPaginationDato.limit;

    const total = await this.order.count({
      where: { status: ordersPaginationDato.status },
    });

    const pages = Math.ceil(total / limit);

    const orders = await this.order.findMany({
      where: { status: ordersPaginationDato.status },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: orders,
      meta: {
        page,
        total,
        pages,
      },
    };
  }

  async findOne(id: string) {
    const order = await this.order.findUnique({
      where: { id },
      include: {
        OrderItem: {
          select: {
            productId: true,
            price: true,
            quantity: true,
          },
        },
      },
    });

    if (!order)
      throw new RpcException({
        message: `Order with id #${id} not found`,
        status: HttpStatus.NOT_FOUND,
      });

    const productsIds = order.OrderItem.map((item) => item.productId);

    const products = await firstValueFrom<Product[]>(
      this.client
        .send<Product[]>({ cmd: 'validate_products' }, productsIds)
        .pipe(
          catchError((error) => {
            if (typeof error === 'object') {
              throw new RpcException(error as object);
            }

            throw new RpcException('Unknown error');
          }),
        ),
    );

    return {
      ...order,
      items: order.OrderItem.map((orderItem) => ({
        ...orderItem,
        name: products.find((product) => product.id === orderItem.productId)
          ?.name,
      })),
      OrderItem: undefined,
    };
  }

  async changeStatus(changeOrderStatusDto: ChangeOrderStatusDto) {
    const { id, status } = changeOrderStatusDto;

    const order = await this.findOne(id);

    if (order.status === status) {
      return order;
    }

    return this.order.update({
      where: { id },
      data: { status },
    });
  }

  async createPaymentSession(order: OrderWithProducts) {
    const paymentSession = await firstValueFrom<StripePaymentSessionCreated>(
      this.client
        .send<StripePaymentSessionCreated>('create.payment.session', {
          orderId: order.id,
          currency: 'usd',
          items: order.items.map((item) => ({
            name: item.name,
            price: item.price,
            quantity: item.quantity,
          })),
        })
        .pipe(
          catchError((error) => {
            if (typeof error === 'object') {
              throw new RpcException(error as object);
            }

            throw new RpcException('Unknown error');
          }),
        ),
    );

    return paymentSession;
  }

  async paymentSucceded(paymentSuccededDto: PaymentSuccededDto) {
    const order = await this.order.update({
      where: { id: paymentSuccededDto.orderId },
      data: {
        paid: true,
        status: 'PAID',
        paidAt: new Date(),
        stripeChargeId: paymentSuccededDto.stripePaymentId,

        // relation
        OrderReceipt: {
          create: {
            receiptUrl: paymentSuccededDto.receiptUrl,
          },
        },
      },
    });

    return order;
  }
}
