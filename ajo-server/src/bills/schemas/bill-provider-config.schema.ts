import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BillProviderConfigDocument = BillProviderConfig & Document;

export type BillServiceType = 'airtime' | 'data' | 'cable' | 'electricity';

/**
 * Per-category catalogue state for the admin Bills console: when the VTpass
 * plan catalogue was last synchronised and how that sync went.
 *
 * VTPass is the only bills provider, so the old `activeProvider` routing field
 * is gone — the remaining job of this document is to surface sync freshness.
 * One document per service type; a missing document simply means "never synced".
 */
@Schema({ timestamps: true })
export class BillProviderConfig {
  _id!: Types.ObjectId;

  /** 'airtime' | 'data' | 'cable' | 'electricity' — the service category. */
  @Prop({
    type: String,
    required: true,
    unique: true,
    enum: ['airtime', 'data', 'cable', 'electricity'],
  })
  serviceType!: string;

  /** Timestamp of the most recent successful plan synchronisation. */
  @Prop({ type: Date })
  lastSyncedAt?: Date;

  /** Human-readable status of the last sync, e.g. 'success' or an error message. */
  @Prop({ type: String, default: 'never' })
  lastSyncStatus?: string;

  /** How many plans the last sync pulled from VTpass. */
  @Prop({ type: Number, default: 0 })
  planCount?: number;
}

export const BillProviderConfigSchema =
  SchemaFactory.createForClass(BillProviderConfig);
