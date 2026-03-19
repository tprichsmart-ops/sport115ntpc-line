const express = require('express');
const line = require('@line/bot-sdk');
const path = require('path');

const app = express();

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.Client(config);

const LIFF_ID = process.env.LIFF_ID || '2009521956-OmBMwwQz';
const LIFF_URL = `https://liff.line.me/${LIFF_ID}`;

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

  // -----------------------------
  // 文字訊息
  // -----------------------------
  if (event.type === 'message' && event.message.type === 'text') {
    const userText = (event.message.text || '').trim();

    // 1) 活動入口關鍵字
    if (userText.includes('我來為2026全障運選手加油')) {
      const messages = [
        {
          type: 'text',
          text:
            '嗨～歡迎加入我們的 Line！\n' +
            '今年我們很榮幸參與\n' +
            '2026 全障運賽事的贊助與支持\n\n' +
            '一起為 2026 全障運選手加油💪\n\n' +
            '🎯 您已獲得抽獎資格，點擊下方按鈕即可開始抽獎'
        },
        {
          type: 'text',
          text:
            '本次應援優惠獎項如下，點擊下方按鈕試試手氣吧 🎁'
        },
        {
          type: 'flex',
          altText: '2026全障運應援抽獎',
          contents: {
  type: 'carousel',
  contents: [
    {
  type: 'bubble',
  size: 'mega',
  header: {
    type: 'box',
    layout: 'vertical',
    backgroundColor: '#ECE8F3',
    paddingAll: '20px',
    contents: [
      {
        type: 'text',
        text: '2026 全障運應援抽獎',
        weight: 'bold',
        color: '#FFFFFF',
        size: 'xl',
        wrap: true
      },
      {
  type: 'text',
  text: '🏃‍♂️ 應援活動',
  size: 'xs',
  color: '#BBF7D0'
     },
      {
        type: 'text',
        text: '人人有獎，最高價值 1 萬元',
        color: '#DBEAFE',
        size: 'sm',
        margin: 'md',
        wrap: true
      }
    ]
  },
  body: {
    type: 'box',
    layout: 'vertical',
    spacing: 'lg',
    paddingAll: '20px',
    contents: [
      {
        type: 'text',
        text: '點擊下方按鈕，立即開始抽獎！',
        size: 'md',
        weight: 'bold',
        color: '#111111',
        wrap: true
      },
      {
        type: 'text',
        text: '本次應援活動人人有獎，快來試試手氣，把專屬優惠帶回家 🎁',
        size: 'sm',
        color: '#666666',
        wrap: true
      },
      {
        type: 'button',
        style: 'primary',
        height: 'md',
        color: '#6B46C1',
        action: {
          type: 'uri',
          label: '立即抽獎',
          uri: LIFF_URL
        }
      }
    ]
  }
},
    {
      type: 'bubble',
      hero: {
        type: 'image',
        url: 'https://sport115ntpc-line.onrender.com/assets/GET_M310.jpg',
        size: 'full',
        aspectRatio: '1:1',
        aspectMode: 'cover'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'text',
            text: 'EPSON M310DN 印表機 1 台',
            weight: 'bold',
            size: 'md',
            wrap: true
          },
          {
            type: 'text',
            text: '價值 10,900 元',
            size: 'sm',
            color: '#666666'
          }
        ]
      }
    },
    {
      type: 'bubble',
      hero: {
        type: 'image',
        url: 'https://sport115ntpc-line.onrender.com/assets/GET_toner.jpg',
        size: 'full',
        aspectRatio: '1:1',
        aspectMode: 'cover'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'text',
            text: '隨機黑色碳粉匣贈品 1 支',
            weight: 'bold',
            size: 'md',
            wrap: true
          },
          {
            type: 'text',
            text: '價值 3,700 元',
            size: 'sm',
            color: '#666666'
          }
        ]
      }
    },
    {
      type: 'bubble',
      hero: {
        type: 'image',
        url: 'https://sport115ntpc-line.onrender.com/assets/GET_0.jpg',
        size: 'full',
        aspectRatio: '1:1',
        aspectMode: 'cover'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'text',
            text: '全障運應援參加禮優惠券 1 張',
            weight: 'bold',
            size: 'md',
            wrap: true
          },
          {
            type: 'text',
            text: '人人有獎',
            size: 'sm',
            color: '#666666'
          }
        ]
      }
    }
  ]
}
        }
      ];

      return client.replyMessage(event.replyToken, messages);
    }

    // 2) 使用者主動表示要使用優惠券
    if (userText.includes('我要使用優惠券，請協助我')) {
      const messages = [
        {
          type: 'text',
          text:
            '好的，我來協助您使用這次的應援優惠 😊\n\n' +
            '請直接回覆以下資訊，我們就能盡快幫您安排：\n\n' +
            '1.裝機窗口姓名\n' +
            '2.聯絡電話\n' +
            '3.安裝地址：\n' +
            '4.服務單位名稱：\n' +
            '5.統編：\n\n' +
            '我會請專人盡快與您聯繫'
        }
      ];

      return client.replyMessage(event.replyToken, messages);
    }

    return null;
  }

  // -----------------------------
  // postback
  // -----------------------------
  if (event.type === 'postback') {
    const postbackData = event.postback?.data || '';

    // 查看型錄 → 傳兩張圖片
    if (postbackData === 'action=view_catalog') {
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
