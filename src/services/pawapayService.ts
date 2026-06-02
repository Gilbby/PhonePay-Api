import { v4 as uuidv4 } from 'uuid';

const BASE_URL = process.env.PAWAPAY_BASE_URL!;
const TOKEN = process.env.PAWAPAY_API_TOKEN!;

const headers = {
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
};

// Zambia provider codes
export const getProvider = (phone: string): string => {
  const normalized = phone
    .replace(/^\+260/, '')
    .replace(/^260/, '')
    .replace(/^0/, '');

  const prefix = normalized.substring(0, 2);
  if (['96', '76'].includes(prefix)) return 'MTN_MOMO_ZMB';
  if (['97', '77'].includes(prefix)) return 'AIRTEL_OAPI_ZMB';
  if (['95', '75'].includes(prefix)) return 'ZAMTEL_ZMB';
  throw new Error('Unknown provider for phone: ' + phone);
};

// Format phone to MSISDN (e.g. 260976123456)
const toMSISDN = (phone: string): string => {
  if (phone.startsWith('+')) return phone.slice(1);
  if (phone.startsWith('260')) return phone;
  return `260${phone.replace(/^0/, '')}`;
};

// Initiate a deposit (collect from user's mobile wallet into Snappay)
export const initiateDeposit = async (
  phone: string,
  amount: number
): Promise<{ depositId: string; data: any }> => {
  const depositId = uuidv4();
  const provider = getProvider(phone);
  const phoneNumber = toMSISDN(phone);

  const res = await fetch(`${BASE_URL}/v2/deposits`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      depositId,
      amount: String(Math.round(amount)),
      currency: 'ZMW',
      payer: {
        type: 'MMO',
        accountDetails: { phoneNumber, provider },
      },
    }),
  });

  const data = await res.json() as any;
  return { depositId, data };
};

// Initiate a payout (send from Snappay to recipient's mobile wallet)
export const initiatePayout = async (
  phone: string,
  amount: number
): Promise<{ payoutId: string; data: any }> => {
  const payoutId = uuidv4();
  const provider = getProvider(phone);
  const phoneNumber = toMSISDN(phone);

  const res = await fetch(`${BASE_URL}/v2/payouts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      payoutId,
      amount: String(Math.round(amount)),
      currency: 'ZMW',
      recipient: {
        type: 'MMO',
        accountDetails: { phoneNumber, provider },
      },
    }),
  });

  const data = await res.json() as any;
  return { payoutId, data };
};

// Initiate a refund (return funds to sender if payout fails)
export const initiateRefund = async (
  depositId: string,
  amount: number
): Promise<{ refundId: string; data: any }> => {
  const refundId = uuidv4();

  const res = await fetch(`${BASE_URL}/v2/refunds`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      refundId,
      depositId,
      amount: String(Math.round(amount)),
    }),
  });

  const data = await res.json() as any;
  return { refundId, data };
};