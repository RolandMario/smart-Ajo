import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import type { BillProviderKey } from '../../payments/gladtidings.service';

export type BillProviderConfigDocument = BillProviderConfig & Document;

export type BillServiceType = 'airtime' | 'data' | 'cable' | 'electricity';

/**
 * Admin-controlled routing: which provider (VTPass or Gladtidings) is the
 * *active* source for each bill service category, plus the last successful
 * plan sync so the admin UI can show freshness at a glance.
 *
 * One document per service type. If a document is missing for a category the
 * system falls back to VTPass (the original behaviour).
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

  /** The provider to route this category through ('vtpass' | 'gladtidings'). */
  @Prop({ type: String, required: true, enum: ['vtpass', 'gladtidings'] })
  activeProvider!: BillProviderKey;

  /** ISO timestamp of the most recent successful plan synchronisation. */
  @Prop({ type: Date })
  lastSyncedAt?: Date;

  /** Human-readable status of the last sync, e.g. 'success' or an error message. */
  @Prop({ type: String, default: 'never' })
  lastSyncStatus?: string;

  @Prop({ type: Number, default: 0 })
  planCount?: number;
}

export const BillProviderConfigSchema =
  SchemaFactory.createForClass(BillProviderConfig);
