import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContactDto, InboxQuery, NewsletterDto } from './inbox.dto';
import { ContactMessage, NewsletterSubscriber } from './inbox.entities';

@Injectable()
export class InboxService {
  constructor(
    @InjectRepository(ContactMessage) private readonly messages: Repository<ContactMessage>,
    @InjectRepository(NewsletterSubscriber) private readonly subs: Repository<NewsletterSubscriber>,
  ) {}

  async submitContact(dto: ContactDto) {
    // A person must leave at least one way to reply.
    if (!dto.phone && !dto.email) throw new BadRequestException('Please give a phone number or an email so we can reply');
    // Bots fill the hidden field: answer exactly like success, store nothing.
    if (dto.website) return { ok: true };
    await this.messages.insert({ name: dto.name, phone: dto.phone ?? '', email: dto.email ?? '', topic: dto.topic, message: dto.message });
    return { ok: true };
  }

  async subscribe(dto: NewsletterDto) {
    if (dto.website) return { ok: true };
    // Same response whether new or already subscribed, so the form can't be used to probe who is on the list.
    await this.subs.createQueryBuilder().insert().values({ email: dto.email }).orIgnore().execute();
    return { ok: true };
  }

  async listMessages(q: InboxQuery) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 30;
    const [items, total] = await this.messages.findAndCount({
      where: q.unread ? { is_read: false } : {},
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { total, page, limit, unread: await this.messages.count({ where: { is_read: false } }), items };
  }

  async markRead(id: string, is_read: boolean) {
    const r = await this.messages.update(id, { is_read });
    if (!r.affected) throw new NotFoundException('Message not found');
    return { id, is_read };
  }

  async listSubscribers(q: InboxQuery) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 100;
    const [items, total] = await this.subs.findAndCount({ order: { created_at: 'DESC' }, skip: (page - 1) * limit, take: limit });
    return { total, page, limit, items };
  }
}
