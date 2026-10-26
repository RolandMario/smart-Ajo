import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  ContributionFrequency,
  GroupStatus,
  RotationMethod,
} from '../../common/enums/group.enum';
import { DedicatedAccountSchema } from '../../users/schemas/dedicated-account.schema';
import type { DedicatedAccount } from '../../users/schemas/dedicated-account.schema';

export type GroupDocument = Group & Document;

@Schema({ timestamps: true })
export class Group {
  _id!: Types.ObjectId;

  /**
   * Human-friendly, unique "Group ID" shared by the admin so members can
   * find and join this group (see `join-code.ts` for the format). This is
   * what a potential member types into the app's "Join Group" screen — it
   * is intentionally distinct from the Mongo `_id`, which is long and not
   * pleasant to share/type. Generated once at creation; unique across all
   * groups.
   */
  @Prop({
    type: String,
    required: true,
    unique: true,
    index: true,
    uppercase: true,
    trim: true,
  })
  joinCode!: string;

  @Prop({ required: true, trim: true })
  name!: string;

  /**
   * The user who created this group. They are also the group's admin
   * (see GroupMember.isGroupAdmin) and count toward totalSlots.
   */
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  createdBy!: Types.ObjectId;

  /**
   * Amount each member contributes per interval, in the smallest
   * currency unit handling is deferred to the payments phase — for now
   * this is a plain number (e.g. naira).
   */
  @Prop({ required: true, min: 1 })
  contributionAmount!: number;

  @Prop({
    type: String,
    enum: ContributionFrequency,
    default: ContributionFrequency.MONTHLY,
  })
  frequency!: ContributionFrequency;

  /**
   * Total number of members in the group, including the admin.
   * Fixed at creation time.
   */
  @Prop({ required: true, min: 2 })
  totalSlots!: number;

  /**
   * Chosen once by the admin at group creation. Determines how
   * `/groups/:id/rotation/lock` behaves: MANUAL requires an explicit
   * order, RANDOM shuffles accepted members server-side.
   */
  @Prop({ type: String, enum: RotationMethod, required: true })
  rotationMethod!: RotationMethod;

  @Prop({
    type: String,
    enum: GroupStatus,
    default: GroupStatus.OPEN_FOR_INVITES,
  })
  status!: GroupStatus;

  /**
   * Set when the rotation order is locked (Phase 2). The contribution
   * cycle engine (Phase 3) will use this as the basis for scheduling
   * the first cycle's due date.
   */
  @Prop()
  orderLockedAt?: Date;

  /**
   * Set when the group is activated (Phase 3) — the moment cycle 1 is
   * created and contributions begin.
   */
  @Prop()
  startDate?: Date;

  /**
   * 1-indexed cycle currently collecting contributions / awaiting
   * payout. Matches the `position` of the member due to collect.
   * Null until the group is activated; cleared (left at its final
   * value) once the group reaches COMPLETED.
   */
  @Prop({ type: Number, default: null })
  currentCycleNumber?: number | null;

  /**
   * Which round of cycles the group is currently on. Starts at 1 when
   * the group is first activated and increments by 1 each time the
   * admin continues a COMPLETED group (POST /groups/:id/continue);
   * cycle numbers reset to 1 at the start of every round.
   */
  @Prop({ type: Number, default: 1 })
  currentRound!: number;

  /**
   * Platform service fee per member per contribution, in the smallest
   * currency unit. Collected alongside the contribution amount when
   * contributions are collected. Goes to the platform admin's wallet.
   * Defaults to 0 (no fee).
   */
  @Prop({ default: 0, min: 0 })
  serviceFee!: number;

  /**
   * The group's escrow account — a Paystack Dedicated Virtual Account
   * (its own NUBAN) that members transfer their contribution into when
   * paying by local bank transfer. Provisioned (best-effort) when the
   * group is activated; `POST :id/escrow-account/refresh` retries.
   *
   * Inbound transfers settle as Paystack `charge.success` webhooks and
   * are recorded as unallocated EscrowDeposits against the group's
   * central wallet, which the group admin then allocates to the paying
   * member's contribution (or which auto-match by narration reference).
   */
  @Prop({ type: DedicatedAccountSchema })
  escrowAccount?: DedicatedAccount;
}

export const GroupSchema = SchemaFactory.createForClass(Group);
