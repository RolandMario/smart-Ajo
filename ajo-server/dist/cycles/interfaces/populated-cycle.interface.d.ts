import { Types } from 'mongoose';
import { ContributionStatus, CycleStatus } from '../../common/enums/cycle.enum';
export interface PopulatedContribution {
    _id: Types.ObjectId;
    group: Types.ObjectId;
    cycle: Types.ObjectId;
    member: Types.ObjectId;
    user: {
        _id: Types.ObjectId;
        name?: string;
        phone: string;
        email?: string;
    };
    amount: number;
    status: ContributionStatus;
    paidAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export interface PopulatedCycle {
    _id: Types.ObjectId;
    group: Types.ObjectId;
    cycleNumber: number;
    recipientMember: {
        _id: Types.ObjectId;
        position: number | null;
        user: {
            _id: Types.ObjectId;
            name?: string;
            phone: string;
            email?: string;
        };
    };
    contributionAmount: number;
    totalSlots: number;
    dueDate: Date;
    status: CycleStatus;
    completedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
