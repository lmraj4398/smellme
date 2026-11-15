import { CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Column } from 'typeorm';

// A product a signed-in customer has hearted. No foreign keys, like the rest of the schema: a product
// that is later hidden simply stops appearing (the read path only returns products a shopper may see).
@Entity('wishlist_items')
@Unique('UQ_wishlist_customer_product', ['customer_id', 'product_id'])
export class WishlistItem {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_wishlist_items_id' }) id: string;
  @Index('IDX_wishlist_items_customer_id') @Column({ type: 'uuid' }) customer_id: string;
  @Column({ type: 'uuid' }) product_id: string;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
}
