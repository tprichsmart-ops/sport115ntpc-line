const express = require('express');
const line = require('@line/bot-sdk');
const path = require('path');
const { google } = require('googleapis');

const app = express();

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.Client(config);

const LIFF_ID = process.env.LIFF_ID || '2009521956-OmBMwwQz';
const LIFF_URL = `https://liff.line.me/${LIFF_ID}`;

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY_RAW = process.env.GOOGLE_PRIVATE_KEY || '';

app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/api', express.json());

app.get('/health', (req, res) => res.send('ok'));

function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: GOOGLE_PRIVATE_KEY_RAW.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

async function getLineProfileFromAccessToken(accessToken) {
  const resp = await fetch('https://api.line.me/v2/profile', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  return resp.json();
}

async function getAllDrawRows() {
  const sheets = getSheetsClient();
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: 'Sheet1!A:F'
  });
  return resp.data.values || [];
}

async function appendDrawRow(row) {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: 'Sheet1!A:F',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] }
  });
}

function pickPrize() {
  return Math.random() < 0.7
    ? {
        prizeKey: 'm310',
        couponUrl: 'https://lin.ee/nOBmzbiP',
        title: 'EPSON M310DN 印表機應援優惠 🎉'
      }
    : {
        prizeKey: 'toner',
        couponUrl: 'https://lin.ee/yydvi5g',
        title: '隨機黑色碳粉匣贈品優惠 🎉'
      };
}

async function findUserDrawRecord(userId) {
  const rows = await getAllDrawRows();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1] === userId) {
      return {
        prizeKey: rows[i][3],
        couponUrl: rows[i][4]
      };
    }
  }
  return null;
}

// =======================
// 抽獎
// =======================

app.post('/api/draw', async (req, res) => {
  const { accessToken } = req.body;
  const profile = await getLineProfileFromAccessToken(accessToken);

  const existing = await findUserDrawRecord(profile.userId);
  if (existing) return res.json({ alreadyDrawn: true });

  const prize = pickPrize();

  await appendDrawRow([
    new Date().toISOString(),
    profile.userId,
    profile.displayName,
    prize.prizeKey,
    prize.couponUrl,
    'FALSE'
  ]);

  res.json({ alreadyDrawn: false, prize });
});

// =======================
// ⭐ 抽完後推送 LINE（核心）
// =======================

app.post('/api/push-after-draw', async (req, res) => {
  const { accessToken } = req.body;
  const profile = await getLineProfileFromAccessToken(accessToken);
  const record = await findUserDrawRecord(profile.userId);

  const flex = {
    type: 'flex',
    altText: '應援專案',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: 'EPSON M310DN 應援專案', weight: 'bold', size: 'lg' },
          { type: 'text', text: '查看設備資訊或使用優惠', size: 'sm', color: '#666' }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: {
              type: 'postback',
              label: '設備型錄',
              data: 'action=view_catalog'
            }
          },
          {
            type: 'button',
            style: 'primary',
            action: {
              type: 'message',
              label: '我要用優惠',
              text: '我要使用優惠券，請協助我'
            }
          }
        ]
      }
    }
  };

  await client.pushMessage(profile.userId, [
    {
      type: 'text',
      text: '恭喜您完成抽獎 🎉\n優惠券請記得於期限內使用喔！'
    },
    flex,
    {
      type: 'text',
      text: '也歡迎留下您的【服務單位】與【大名】，我可以更精準協助您'
    }
  ]);

  res.json({ ok: true });
});

// =======================
// Webhook
// =======================

app.post('/webhook', line.middleware(config), async (req, res) => {
  const results = await Promise.all(req.body.events.map(handleEvent));
  res.json(results);
});

async function handleEvent(event) {
  if (event.type === 'message' && event.message.type === 'text') {
    const text = event.message.text;

    if (text.includes('我要使用優惠券')) {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text:
          '請提供以下資訊：\n1.姓名\n2.電話\n3.地址\n4.公司\n5.統編'
      });
    }
  }

  if (event.type === 'postback') {
    if (event.postback.data === 'action=view_catalog') {
      return client.replyMessage(event.replyToken, [
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
      ]);
    }
  }

  return null;
}

app.listen(process.env.PORT || 3000);
