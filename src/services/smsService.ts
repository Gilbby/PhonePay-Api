import AfricasTalking from 'africastalking';

let smsClient: any = null;

const getSmsClient = () => {
  if (!smsClient) {
    const at = AfricasTalking({
      apiKey: process.env.AT_API_KEY!,
      username: process.env.AT_USERNAME!, // 'sandbox' in dev, your real username in prod
    });
    smsClient = at.SMS;
  }
  return smsClient;
};

export const sendOtpSms = async (phone: string, otp: string): Promise<void> => {
  // Always log in dev for easy testing
  if (process.env.NODE_ENV !== 'production') {
    console.log(`📱 OTP for ${phone}: ${otp}`);
  }

  // Skip actual SMS send if AT keys not configured
  if (!process.env.AT_API_KEY || !process.env.AT_USERNAME) {
    console.warn("Africa's Talking not configured — OTP only logged above");
    return;
  }

  const message = `Your Snappay code is ${otp}. Valid 10 minutes. Do not share it.`;

  const result = await getSmsClient().send({
    to: [phone], // already in +260XXXXXXXXX format
    message,
    // from: process.env.AT_SENDER_ID  // only set in prod after registering sender ID
  });

  const recipient = result.SMSMessageData?.Recipients?.[0];
  if (recipient?.status !== 'Success') {
    throw new Error(`SMS delivery failed: ${recipient?.status ?? 'no response'}`);
  }
};
