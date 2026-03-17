require('dotenv').config();

const express = require('express');
const line = require('@line/bot-sdk');

const app = express();

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: config.channelAccessToken,
});

const middleware = line.middleware(config);

const PORT = process.env.PORT || 3000;

const TRIGGER_TEXT = '我來為2026全障運選手加油了~';
const POSTBACK_GET_COUPON = 'action=pg2026_coupon';

const PDF_URL =
  process.env.PDF_URL ||
  'https://raw.githubusercontent.com/tprichsmart-ops/sport115ntpc-line/main/assets/EPSON%20AL-M310DN%20%E5%9E%8B%E9%8C%84.pdf';

const LINE_COUPON_ID = process.env.LINE_COUPON_ID || '';

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.post('/webhook', middleware, async (req, res) => {
  try {
    const results = await Promise.all(req.body.events.map(handleEvent));
    res.json(results);
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).end();
  }
});

async function handleEvent(event) {
  try {
    if (!event.replyToken) return null;

    if (event.type === 'message' && event.message.type === 'text') {
      const userText = normalizeText(event.message.text);

      if (userText === normalizeText(TRIGGER_TEXT)) {
        return replyMessage(event.replyToken, buildEntryReplyMessages());
      }

      return null;
    }

    if (event.type === 'postback') {
      const data = event.postback.data || '';

      if (data === POSTBACK_GET_COUPON) {
        return replyMessage(event.replyToken, buildCouponReplyMessages());
      }

      return null;
    }

    return null;
  } catch (err) {
    console.error('handleEvent error:', err, JSON.stringify(event, null, 2));
    return null;
  }
}

function normalizeText(text = '') {
  return text.trim().replace(/\s+/g, '');
}

async function replyMessage(replyToken, messages) {
  return client.replyMessage({
    replyToken,
    messages,
  });
}

function buildEntryReplyMessages() {
  return [
    {
      type: 'text',
      text:
        '嗨～我是小編 😊\n' +
        '歡迎加入我們的 Line！\n\n' +
        '今年我們很榮幸參與\n' +
        '2026 全障運賽事的贊助與支持\n\n' +
        '一起為努力突破自我的選手們加油 💪',
    },
    {
      type: 'text',
      text:
        '為了替選手們應援\n' +
        '小編準備了一份 Epson M310 專屬優惠券\n\n' +
        '有需要的朋友可以直接領取 👇',
    },
    {
      type: 'template',
      altText: '領取 M310 優惠券',
      template: {
        type: 'buttons',
        title: '2026 全障運應援優惠',
        text: '點擊下方按鈕，即可領取 Epson M310 專屬優惠券。',
        actions: [
          {
            type: 'postback',
            label: '領取 M310 優惠券',
            data: POSTBACK_GET_COUPON,
            displayText: '我要領取 M310 優惠券',
          },
        ],
      },
    },
  ];
}

function buildCouponReplyMessages() {
  const messages = [
    {
      type: 'text',
      text:
        '小編已幫您準備好\n' +
        'Epson M310 專屬優惠券 🎁\n\n' +
        '如果未來需要設備或相關資訊\n' +
        '小編也可以第一時間提供給您。',
    },
  ];

  if (LINE_COUPON_ID) {
    messages.push({
      type: 'coupon',
      couponId: LINE_COUPON_ID,
    });
  } else {
    messages.push({
      type: 'text',
      text: '目前尚未設定 LINE_COUPON_ID，請先補上優惠券 ID。',
    });
  }

  messages.push({
    type: 'template',
    altText: '查看 Epson M310 PDF 型錄',
    template: {
      type: 'buttons',
      title: 'Epson M310 PDF 型錄',
      text: '點擊下方按鈕即可查看完整型錄。',
      actions: [
        {
          type: 'uri',
          label: '開啟 PDF 型錄',
          uri: PDF_URL,
        },
      ],
    },
  });

  messages.push({
    type: 'text',
    text:
      '想先認識一下新朋友 😊\n' +
      '可以跟小編分享一下：\n\n' +
      '1️⃣ 服務單位\n' +
      '2️⃣ 您的大名',
  });

  return messages;
}

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
