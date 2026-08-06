import { ContributionFrequency, RotationMethod } from '../../common/enums/group.enum';
export declare class CreateGroupDto {
    name: string;
    contributionAmount: number;
    frequency?: ContributionFrequency;
    totalSlots: number;
    rotationMethod: RotationMethod;
}
