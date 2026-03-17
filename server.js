const express = require('express');
const line = require('@line/bot-sdk');
const path = require('path');

const app = express();

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.Client(config);

// 提供靜態檔案
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// 健康檢查
app.get('/health', (req, res) => {
  res.status(200).send('ok');
});

// LINE webhook
app.post('/webhook', line.middleware(config), async (req, res) => {
  try {
    const results = await Promise.all(req.body.events.map(handleEvent));
    res.json(results);
  } catch (error) {
    console.error('Webhook Error:', error);
    res.status(500).end();
  }
});

async function handleEvent(event) {
  // 只處理文字訊息
  if (event.type !== 'message' || event.message.type !== 'text') {
    return null;
  }

  const userText = event.message.text.trim();

  // 觸發關鍵字
  if (userText === '我來為2026全障運選手加油了~') {
    const messages = [
      {
        type: 'text',
        text:
          '嗨～我是小編 😊\n' +
          '歡迎加入我們的 Line！\n\n' +
          '今年我們很榮幸參與\n' +
          '2026 全障運賽事的贊助與支持\n\n' +
          '一起為努力突破自我的選手們加油 💪'
      },
      {
        type: 'template',
        altText: 'M310 優惠券與型錄',
        template: {
          type: 'buttons',
          text:
            '為了替選手們應援\n' +
            '小編準備了一份 Epson M310 專屬優惠券\n' +
            '有需要的朋友可以直接領取 👇',
          actions: [
            {
              type: 'uri',
              label: '領取 M310 優惠券',
              uri: 'https://lin.ee/nP7OLzc'
            },
            {
              type: 'uri',
              label: '查看 M310 型錄',
              uri: 'https://sport115ntpc-line.onrender.com/public/catalog.html'
            }
          ]
        }
      }
    ];

    return client.replyMessage(event.replyToken, messages);
  }

  return null;
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`server running on ${port}`);
});
