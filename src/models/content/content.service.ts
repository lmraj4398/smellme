import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { R2Service } from '../../common/r2/r2.service';
import { CONTENT_PAGES, findPage, findSection } from './content.pages';
import type { Field } from './content.types';
import { imageKeys, mergeDefaults, resolveImages, validateSection } from './content.validate';
import { SiteContent } from './site-content.entity';

@Injectable()
export class ContentService {
  constructor(
    @InjectRepository(SiteContent) private readonly repo: Repository<SiteContent>,
    private readonly r2: R2Service,
  ) {}

  /** What the website renders: defaults overlaid with saved edits, image keys turned into URLs. */
  async publicPage(page: string) {
    const spec = findPage(page);
    if (!spec) throw new NotFoundException('Page not found');
    const rows = new Map((await this.repo.find({ where: { page } })).map((r) => [r.section, r]));
    const sections = Object.fromEntries(
      spec.sections.map((s) => [s.key, resolveImages(s.fields, mergeDefaults(s, rows.get(s.key)?.data), (k) => this.r2.publicUrl(k))]),
    );
    return { page, sections };
  }

  /** What the editor works on: same merge, but image fields keep their keys. */
  async adminPage(page: string) {
    const spec = findPage(page);
    if (!spec) throw new NotFoundException('Page not found');
    const rows = new Map((await this.repo.find({ where: { page } })).map((r) => [r.section, r]));
    return {
      page,
      title: spec.title,
      sections: spec.sections.map((s) => {
        const row = rows.get(s.key);
        return { key: s.key, customised: !!row, updated_at: row?.updated_at ?? null, data: mergeDefaults(s, row?.data) };
      }),
    };
  }

  /** Field definitions for the editor to build its forms from (defaults are not needed there). */
  schema() {
    return {
      media_base: this.r2.publicUrl('').replace(/\/$/, ''),
      pages: CONTENT_PAGES.map((p) => ({
        key: p.key,
        title: p.title,
        sections: p.sections.map(({ defaults: _defaults, ...s }) => s),
      })),
    };
  }

  async save(page: string, section: string, data: unknown, adminId: string) {
    const spec = findSection(page, section);
    if (!spec) throw new NotFoundException('Section not found');
    const clean = validateSection(spec, data);

    const existing = await this.repo.findOne({ where: { page, section } });
    await this.repo.upsert({ page, section, data: clean, updated_by: adminId } as QueryDeepPartialEntity<SiteContent>, ['page', 'section']);

    // Images the owner removed or replaced are no longer referenced anywhere: free the storage (best-effort).
    if (existing) await this.dropOrphans(spec.fields, existing.data, clean);
    return (await this.adminPage(page)).sections.find((s) => s.key === section)!;
  }

  async reset(page: string, section: string) {
    const spec = findSection(page, section);
    if (!spec) throw new NotFoundException('Section not found');
    const existing = await this.repo.findOne({ where: { page, section } });
    if (existing) {
      await this.repo.delete({ page, section });
      await this.dropOrphans(spec.fields, existing.data, {});
    }
    return (await this.adminPage(page)).sections.find((s) => s.key === section)!;
  }

  private async dropOrphans(fields: Field[], before: Record<string, unknown>, after: Record<string, unknown>) {
    const keep = new Set(imageKeys(fields, after));
    const gone = imageKeys(fields, before).filter((k) => !keep.has(k));
    await Promise.allSettled(gone.map((k) => this.r2.delete('media', k)));
  }
}
