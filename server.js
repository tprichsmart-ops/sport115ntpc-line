require('dotenv').config();

const express = require('express');
const line = require('@line/bot-sdk');

const app = express();

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.Client(config);

app.get('/health', (req, res) => {
  res.send('OK');
});

app.post('/webhook', line.middleware(config), async (req, res) => {
  const events = req.body.events;

  await Promise.all(events.map(handleEvent));

  res.status(200).end();
});

async function handleEvent(event) {

  if (event.type === 'message' && event.message.type === 'text') {

    const text = event.message.text.trim();

    if (text === '我來為2026全障運選手加油了~') {

      return client.replyMessage(event.replyToken, [
        {
          type: 'text',
          text: '嗨～我是小編 😊\n歡迎加入我們的 Line！\n\n今年我們很榮幸參與\n2026 全障運賽事的贊助與支持\n\n一起為努力突破自我的選手們加油 💪'
        },
        {
          type: 'text',
          text: '為了替選手們應援\n小編準備了一份 Epson M310 專屬優惠券\n\n有需要的朋友可以直接領取 👇'
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
                data: 'action=pg2026_coupon',
                displayText: '我要領取 M310 優惠券'
              }
            ]
          }
        }
      ]);

    }

  }

  if (event.type === 'postback') {

    if (event.postback.data === 'action=pg2026_coupon') {

      return client.replyMessage(event.replyToken, [
        {
          type: 'text',
          text: '小編已幫您準備好 Epson M310 專屬優惠券 🎁'
        },
        {
          type: 'text',
          text: process.env.PDF_URL
        },
        {
          type: 'text',
          text: '請回覆以下資料：\n1️⃣ 服務單位\n2️⃣ 您的大名'
        }
      ]);

    }

  }

  return null;

}

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
