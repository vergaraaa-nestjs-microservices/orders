import { OrderStatus } from '@prisma/client';

export interface OrderWithProducts {
  items: {
    name: string | undefined;
    productId: number;
    quantity: number;
    price: number;
  }[];
  OrderItem: undefined;
  id: string;
  totalAmount: number;
  totalItems: number;
  status: OrderStatus;
  paid: boolean;
  paidAt: Date | null;
  createdAt: Date;
  upatedAt: Date;
}
