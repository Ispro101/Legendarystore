"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const ts_khqr_1 = require("ts-khqr");
const qrcode_1 = __importDefault(require("qrcode"));
const fetch = require('node-fetch');
console.log('Starting server...');
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1261447424849870900/xguHBOkPhd0RqTAVGDT2xibB2nh6sSfVbCJCDpMhee-X2ki1KC3n5Q3kGbHha7N5piLb';
const TELEGRAM_BOT_TOKEN = '6348436554:AAH-o-l7TlAB8l2VMIgH2hF9gI4LjLJFf5o';
const TELEGRAM_CHAT_ID = '-1002228298574';
app.use(express_1.default.static('public'));
app.use(express_1.default.json());
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});
app.post('/generate-khqr', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { amount, itemId, userId, zoneId, transactionId } = req.body;
    console.log('Received request to generate KHQR:', { amount, itemId, userId, zoneId, transactionId });
    try {
        const khqrResult = ts_khqr_1.KHQR.generate({
            tag: ts_khqr_1.TAG.INDIVIDUAL,
            accountID: 'panhastore_game@aclb',
            merchantName: 'Panha Store',
            currency: ts_khqr_1.CURRENCY.USD,
            amount: Number(amount),
            countryCode: ts_khqr_1.COUNTRY.KH,
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
                const qrCodeData = yield qrcode_1.default.toDataURL(qrString);
                console.log('Generated QR Code data');
                res.json({ qrCodeData });
                try {
                    yield checkPaymentStatus(khqrResult.data.md5, amount, itemId, userId, zoneId, transactionId, res);
                }
                catch (error) {
                    console.error('Error during payment status check:', error);
                    res.status(500).json({ error: 'Error checking payment status' });
                }
            }
            else {
                console.error('QR data is null or undefined');
                res.status(500).json({ error: 'QR data is null or undefined' });
            }
        }
        else {
            console.error('Invalid KHQR data:', khqrResult.status);
            res.status(400).json({ error: 'Invalid KHQR data' });
        }
    }
    catch (error) {
        console.error('Error generating KHQR:', error);
        res.status(500).json({ error: 'Error generating KHQR' });
    }
}));
function checkPaymentStatus(md5, amount, itemId, userId, zoneId, transactionId, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const url = "https://api-bakong.nbc.gov.kh/v1/check_transaction_by_md5";
        const body = { "md5": md5 };
        const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7ImlkIjoiODZhZjk3Y2EyZDAzNGM2In0sImlhdCI6MTcyMDgyNDEyMCwiZXhwIjoxNzI4NjAwMTIwfQ.gmYjDoTQD03dDYyG4h0fJ3PNHdLH85BLySHFXkyLNdU";
        const header = {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        };
        const intervalId = setInterval(() => __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield fetch(url, {
                    method: 'POST',
                    headers: header,
                    body: JSON.stringify(body)
                });
                if (response.ok) {
                    const jsonData = yield response.json();
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
                        const discordResponse = yield fetch(DISCORD_WEBHOOK_URL, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(discordMessage)
                        });
                        if (discordResponse.ok) {
                            console.log('Successfully sent message to Discord webhook');
                        }
                        else {
                            console.error('Failed to send message to Discord webhook:', discordResponse.statusText);
                        }
                        const telegramResponse = yield fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
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
                        }
                        else {
                            console.error('Failed to send message to Telegram:', telegramResponse.statusText);
                        }
                        clearInterval(intervalId);
                        // Inform the client that the payment was successful
                        res.json({ success: true });
                    }
                }
                else {
                    console.error('Failed to check payment status:', response.statusText);
                }
            }
            catch (error) {
                console.error('Error checking payment status:', error);
            }
        }), 5000);
        // Timeout to clear interval after 1000 seconds if no successful payment
        setTimeout(() => {
            clearInterval(intervalId);
        }, 1000000);
    });
}
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
