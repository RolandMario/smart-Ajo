import { IsEnum } from 'class-validator';

export enum InviteResponseAction {
  ACCEPT = 'accept',
  DECLINE = 'decline',
}

export class RespondToInviteDto {
  @IsEnum(InviteResponseAction)
  action!: InviteResponseAction;
}
