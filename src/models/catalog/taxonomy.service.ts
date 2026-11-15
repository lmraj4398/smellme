import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { rethrowDbError } from '../../common/utils/db-error';
import { slugify } from '../../common/utils/slug';
import { BrandDto, FamilyDto, NoteDto } from './dto/catalog.dto';
import { Brand, Note, ScentFamily } from './entities/taxonomy.entities';

@Injectable()
export class TaxonomyService {
  constructor(
    @InjectRepository(Brand) private readonly brands: Repository<Brand>,
    @InjectRepository(ScentFamily) private readonly families: Repository<ScentFamily>,
    @InjectRepository(Note) private readonly notes: Repository<Note>,
  ) {}

  // ── brands ──
  listBrands(onlyActive = false) {
    return this.brands.find({ where: onlyActive ? { is_active: true } : {}, order: { sort_order: 'ASC', name: 'ASC' } });
  }
  async createBrand(dto: BrandDto) {
    try {
      return await this.brands.save(this.brands.create({ ...dto, slug: dto.slug ?? slugify(dto.name) }));
    } catch (e) {
      rethrowDbError(e, 'A brand with this name or slug');
    }
  }
  async updateBrand(id: string, dto: BrandDto) {
    const row = await this.brands.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Brand not found');
    try {
      return await this.brands.save(Object.assign(row, dto, { slug: dto.slug ?? row.slug }));
    } catch (e) {
      rethrowDbError(e, 'A brand with this name or slug');
    }
  }
  async removeBrand(id: string) {
    try {
      const r = await this.brands.delete(id);
      if (!r.affected) throw new NotFoundException('Brand not found');
    } catch (e) {
      if (e instanceof NotFoundException) throw e;
      rethrowDbError(e, 'This brand (products use it; deactivate it instead)');
    }
  }

  // ── families ──
  listFamilies(onlyActive = false) {
    return this.families.find({ where: onlyActive ? { is_active: true } : {}, order: { sort_order: 'ASC', name: 'ASC' } });
  }
  async createFamily(dto: FamilyDto) {
    try {
      return await this.families.save(this.families.create({ ...dto, slug: dto.slug ?? slugify(dto.name) }));
    } catch (e) {
      rethrowDbError(e, 'A scent family with this name or slug');
    }
  }
  async updateFamily(id: string, dto: FamilyDto) {
    const row = await this.families.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Scent family not found');
    try {
      return await this.families.save(Object.assign(row, dto, { slug: dto.slug ?? row.slug }));
    } catch (e) {
      rethrowDbError(e, 'A scent family with this name or slug');
    }
  }
  async removeFamily(id: string) {
    try {
      const r = await this.families.delete(id);
      if (!r.affected) throw new NotFoundException('Scent family not found');
    } catch (e) {
      if (e instanceof NotFoundException) throw e;
      rethrowDbError(e, 'This scent family (products use it; deactivate it instead)');
    }
  }

  // ── notes ──
  listNotes() {
    return this.notes.find({ order: { name: 'ASC' } });
  }
  async createNote(dto: NoteDto) {
    try {
      return await this.notes.save(this.notes.create(dto));
    } catch (e) {
      rethrowDbError(e, 'A note with this name');
    }
  }
  async updateNote(id: string, dto: NoteDto) {
    const row = await this.notes.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Note not found');
    try {
      return await this.notes.save(Object.assign(row, dto));
    } catch (e) {
      rethrowDbError(e, 'A note with this name');
    }
  }
  async removeNote(id: string) {
    try {
      const r = await this.notes.delete(id);
      if (!r.affected) throw new NotFoundException('Note not found');
    } catch (e) {
      if (e instanceof NotFoundException) throw e;
      rethrowDbError(e, 'This note (products use it)');
    }
  }
}
