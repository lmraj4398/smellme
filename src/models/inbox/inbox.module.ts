import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InboxAdminController, InboxPublicController } from './inbox.controllers';
import { ContactMessage, NewsletterSubscriber } from './inbox.entities';
import { InboxService } from './inbox.service';

@Module({
  imports: [TypeOrmModule.forFeature([ContactMessage, NewsletterSubscriber])],
  controllers: [InboxPublicController, InboxAdminController],
  providers: [InboxService],
})
export class InboxModule {}
