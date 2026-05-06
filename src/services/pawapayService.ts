import { v4 as uuidv4 } from 'uuid';

const BASE_URL = process.env.PAWAPAY_BASE_URL!;
const TOKEN = process.env.PAWAPAY_API_TOKEN!;

const headers = {
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
};

// Zambia provider codes
export const getProvider = (phone: string): string => {
  const local = phone.replace('+260', '');
  const prefix = local.substring(0, 2);
  if (['96', '76'].includes(prefix)) return 'MTN_MOMO_ZMB';
  if (['97', '77'].includes(prefix)) return 'AIRTEL_ZMB';
  if (['95', '75'].includes(prefix)) return 'ZAMTEL_ZMB';
  throw new Error('Unknown provider for phone: ' + phone);
};

// Initiate a deposit (user tops up PhonePay from their mobile wallet)
export const initiateDeposit = async (phone: string, amount: number) => {
  const depositId = uuidv4();
  const provider = getProvider(phone);
  const phoneNumber = phone.replace('+', ''); // MSISDN format

  const res = await fetch(`${BASE_URL}/v2/deposits`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      depositId,
      amount: String(amount),
      currency: 'ZMW',
      payer: {
        type: 'MMO',
        accountDetails: { phoneNumber, provider },
      },
    }),
  });

  return { depositId, data: await res.json() };
};

// Initiate a payout (PhonePay sends money to a mobile wallet)
export const initiatePayout = async (phone: string, amount: number) => {
  const payoutId = uuidv4();
  const provider = getProvider(phone);
  const phoneNumber = phone.replace('+', '');

  const res = await fetch(`${BASE_URL}/v2/payouts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      payoutId,
      amount: String(amount),
      currency: 'ZMW',
      recipient: {
        type: 'MMO',
        accountDetails: { phoneNumber, provider },
      },
    }),
  });

  return { payoutId, data: await res.json() };
};