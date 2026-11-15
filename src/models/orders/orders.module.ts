import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogModule } from '../catalog/catalog.module';
import { CouponsModule } from '../coupons/coupons.module';
import { CustomersModule } from '../customers/customers.module';
import { AdminCustomersController, AdminOrdersController, CartController, CustomerOrdersController } from './orders.controllers';
import { Order, OrderEvent, OrderItem } from './order.entities';
import { OrdersAdminService } from './orders-admin.service';
import { OrdersService } from './orders.service';
import { PricingService } from './pricing.service';

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderItem, OrderEvent]), CatalogModule, CouponsModule, CustomersModule],
  controllers: [CartController, CustomerOrdersController, AdminOrdersController, AdminCustomersController],
  providers: [PricingService, OrdersService, OrdersAdminService],
})
export class OrdersModule {}
