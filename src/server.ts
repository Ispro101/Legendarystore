import express, { Request, Response } from 'express';
import { KHQR, CURRENCY, COUNTRY, TAG } from 'ts-khqr';
import QRCode from 'qrcode';
const fetch = require('node-fetch');

console.log('Starting server...');

const app = express();
const PORT = process.env.PORT || 3000;

const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1261447424849870900/xguHBOkPhd0RqTAVGDT2xibB2nh6sSfVbCJCDpMhee-X2ki1KC3n5Q3kGbHha7N5piLb';
const TELEGRAM_BOT_TOKEN = '6348436554:AAH-o-l7TlAB8l2VMIgH2hF9gI4LjLJFf5o';
const TELEGRAM_CHAT_ID = '-1002228298574';

app.use(express.static('public'));
app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.post('/generate-khqr', async (req: Request, res: Response) => {
  const { amount, itemId, userId, zoneId, transactionId } = req.body;
  console.log('Received request to generate KHQR:', { amount, itemId, userId, zoneId, transactionId });

  try {
    const khqrResult = KHQR.generate({
      tag: TAG.INDIVIDUAL,
      accountID: 'panhastore_game@aclb',
      merchantName: 'Panha Store',
      currency: CURRENCY.USD,
      amount: Number(amount),
      countryCode: COUNTRY.KH,
      additionalData: {
        billNumber: transactionId,
        purposeOfTransaction: 'Payment'
      }
    });

    console.log('Generated KHQR result:', khqrResult);

    if (khqrResult.status.code === 0 && khqrResult.data) {
      const qrString = khqrResult.data.qr;

      if (qrString) {
        console.log('QR Data:', qrString);

        const qrCodeData = await QRCode.toDataURL(qrString);
        console.log('Generated QR Code data');

        res.json({ qrCodeData });

        try {
          await checkPaymentStatus(khqrResult.data.md5, amount, itemId, userId, zoneId, transactionId, res);
        } catch (error) {
          console.error('Error during payment status check:', error);
          res.status(500).json({ error: 'Error checking payment status' });
        }
      } else {
        console.error('QR data is null or undefined');
        res.status(500).json({ error: 'QR data is null or undefined' });
      }
    } else {
      console.error('Invalid KHQR data:', khqrResult.status);
      res.status(400).json({ error: 'Invalid KHQR data' });
    }
  } catch (error) {
    console.error('Error generating KHQR:', error);
    res.status(500).json({ error: 'Error generating KHQR' });
  }
});

async function checkPaymentStatus(md5: string, amount: number, itemId: string, userId: string, zoneId: string, transactionId: string, res: Response): Promise<void> {
  const url = "https://api-bakong.nbc.gov.kh/v1/check_transaction_by_md5";
  const body = { "md5": md5 };

  const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7ImlkIjoiODZhZjk3Y2EyZDAzNGM2In0sImlhdCI6MTcyMDgyNDEyMCwiZXhwIjoxNzI4NjAwMTIwfQ.gmYjDoTQD03dDYyG4h0fJ3PNHdLH85BLySHFXkyLNdU";
  const header = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  };

  const intervalId = setInterval(async () => {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: header,
        body: JSON.stringify(body)
      });

      if (response.ok) {
        const jsonData = await response.json();
        console.log(jsonData);

        if (jsonData.responseCode === 0 && jsonData.data && jsonData.data.hash) {
          const discordMessage = {
            content: `@everyone check this topup!`,
            embeds: [
              {
                title: 'Payment Success',
                description: `💠 UserID: ${userId}\n🌐 ServerID: ${zoneId}\n💙 Items: ${itemId}\n💲 Price: ${amount}\n🌌 Transaction: ${transactionId}`,
              }
            ]
          };

          const telegramMessage = `🛍️ New Order 📥\n\n💠 UserID: <code>${userId}</code>\n🌐 ServerID: ${zoneId}\n💙 Items: ${itemId}\n💲 Price: ${amount}\n🌌 Transaction: ${transactionId}`;

          const discordResponse = await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(discordMessage)
          });

          if (discordResponse.ok) {
            console.log('Successfully sent message to Discord webhook');
          } else {
            console.error('Failed to send message to Discord webhook:', discordResponse.statusText);
          }

          const telegramResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: TELEGRAM_CHAT_ID,
              text: telegramMessage,
              parse_mode: 'HTML'
            })
          });

          if (telegramResponse.ok) {
            console.log('Successfully sent message to Telegram');
          } else {
            console.error('Failed to send message to Telegram:', telegramResponse.statusText);
          }

          clearInterval(intervalId);

          // Inform the client that the payment was successful
          res.json({ success: true });
        }
      } else {
        console.error('Failed to check payment status:', response.statusText);
      }
    } catch (error) {
      console.error('Error checking payment status:', error);
    }
  }, 5000);

  // Timeout to clear interval after 1000 seconds if no successful payment
  setTimeout(() => {
    clearInterval(intervalId);
  }, 1000000);
}

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
