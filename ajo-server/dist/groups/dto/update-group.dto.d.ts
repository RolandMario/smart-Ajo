import { ContributionFrequency } from '../../common/enums/group.enum';
export declare class UpdateGroupDto {
    name?: string;
    contributionAmount?: number;
    frequency?: ContributionFrequency;
    totalSlots?: number;
}
