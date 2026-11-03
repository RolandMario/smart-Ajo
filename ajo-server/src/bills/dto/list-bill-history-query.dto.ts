import { IsIn, IsOptional } from 'class-validator';

/**
 * Query of `GET /bills/history` — the service-type tabs on the app's bill
 * history screen.
 *
 * `serviceType` is optional: omit it for the unfiltered "All" tab. The filter
 * runs in the database (before the 100-row cap), so picking "Data" surfaces
 * data receipts even when a hundred other payments happened more recently.
 */
export class ListBillHistoryQueryDto {
  @IsOptional()
  @IsIn(['airtime', 'data', 'cable', 'electricity'])
  serviceType?: string;
}
