import { UsersService } from './users.service';

/**
 * The webhook resolver has to recognise a transfer from whichever identifier
 * Paystack sends. These tests pin the Mongo filter it builds, in particular
 * the phone expansion across Nigerian formats.
 */
describe('UsersService.findByDedicatedAccountIdentity', () => {
  function buildService() {
    const findOne = jest.fn().mockResolvedValue(null);
    const service = new UsersService({ findOne } as never);

    return { service, findOne };
  }

  it('queries the customer code, account number and every phone variant', async () => {
    const { service, findOne } = buildService();

    await service.findByDedicatedAccountIdentity({
      customerCode: 'CUS_ajo',
      accountNumber: '9817686278',
      phone: '07068497568',
    });

    expect(findOne).toHaveBeenCalledWith({
      $or: [
        { 'dedicatedAccount.paystackCustomerCode': 'CUS_ajo' },
        { 'dedicatedAccount.accountNumber': '9817686278' },
        {
          phone: {
            $in: [
              '+2347068497568',
              '2347068497568',
              '07068497568',
              '7068497568',
            ],
          },
        },
      ],
    });
  });

  it('omits identifiers that are missing from the webhook payload', async () => {
    const { service, findOne } = buildService();

    await service.findByDedicatedAccountIdentity({ phone: '+2347068497568' });

    expect(findOne).toHaveBeenCalledWith({
      $or: [
        {
          phone: {
            $in: [
              '+2347068497568',
              '2347068497568',
              '07068497568',
              '7068497568',
            ],
          },
        },
      ],
    });
  });

  it('returns null without querying when no identifier is supplied', async () => {
    const { service, findOne } = buildService();

    await expect(
      service.findByDedicatedAccountIdentity({}),
    ).resolves.toBeNull();
    expect(findOne).not.toHaveBeenCalled();
  });
});
