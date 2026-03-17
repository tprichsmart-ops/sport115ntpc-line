const express = require('express');
const line = require('@line/bot-sdk');
const path = require('path');

const app = express();

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.Client(config);

// 靜態檔案
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// 健康檢查
app.get('/health', (req, res) => {
  res.status(200).send('ok');
});

// webhook
app.post('/webhook', line.middleware(config), async (req, res) => {
  try {
    const results = await Promise.all(req.body.events.map(handleEvent));
    res.json(results);
  } catch (error) {
    console.error('Webhook Error:', error?.response?.data || error.message || error);
    res.status(500).end();
  }
});

async function handleEvent(event) {
  console.log('EVENT:', JSON.stringify(event, null, 2));

  // 文字訊息
  if (event.type === 'message' && event.message.type === 'text') {
    const userText = event.message.text.trim();

    if (userText.includes('我來為2026全障運選手加油')) {
      const messages = [
        {
          type: 'text',
          text:
            '嗨～我是小編 😊\n' +
            '歡迎加入我們的 Line！\n\n' +
            '今年我們很榮幸參與\n' +
            '2026 全障運賽事的贊助與支持\n\n' +
            '一起為努力突破自我的選手們加油💪'
        },
        {
          type: 'flex',
          altText: 'M310 優惠券與型錄',
          contents: {
            type: 'bubble',
            body: {
              type: 'box',
              layout: 'vertical',
              spacing: 'md',
              contents: [
                {
                  type: 'text',
                  text: '2026 全障運專屬應援禮',
                  weight: 'bold',
                  size: 'xl',
                  wrap: true,
                  color: '#111111'
                },
                {
                  type: 'text',
                  text: '我已幫您準備好 Epson M310 專屬優惠券與型錄，趕快查收!!!',
                  size: 'sm',
                  color: '#666666',
                  wrap: true
                },
                {
                  type: 'separator',
                  margin: 'md'
                },
                {
                  type: 'box',
                  layout: 'vertical',
                  spacing: 'sm',
                  margin: 'md',
                  contents: [
                    {
                      type: 'button',
                      style: 'primary',
                      height: 'sm',
                      action: {
                        type: 'uri',
                        label: '我想領取優惠券',
                        uri: 'https://lin.ee/nP7OLzc'
                      }
                    },
                    {
                      type: 'button',
                      style: 'secondary',
                      height: 'sm',
                      action: {
                        type: 'postback',
                        label: '我要查看型錄',
                        data: 'action=view_catalog'
                      }
                    }
                  ]
                }
              ]
            }
          }
        },
        {
          type: 'text',
          text:
            '如果未來需要設備或相關資訊，\n' +
            '我會第一時間提供給您。\n' +
            '先讓我認識一下新朋友 😊\n\n' +
            '趕快留下您的【服務單位】與【大名】吧~'
        }
      ];

      return client.replyMessage(event.replyToken, messages);
    }

    return null;
  }

  // postback：查看型錄，送出兩張圖
  if (event.type === 'postback') {
    if (event.postback.data === 'action=view_catalog') {
      const messages = [
        {
          type: 'image',
          originalContentUrl: 'https://sport115ntpc-line.onrender.com/assets/m310-1.jpg',
          previewImageUrl: 'https://sport115ntpc-line.onrender.com/assets/m310-1.jpg'
        },
        {
          type: 'image',
          originalContentUrl: 'https://sport115ntpc-line.onrender.com/assets/m310-2.jpg',
          previewImageUrl: 'https://sport115ntpc-line.onrender.com/assets/m310-2.jpg'
        }
      ];

      return client.replyMessage(event.replyToken, messages);
    }

    return null;
  }

  return null;
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`server running on ${port}`);
});
