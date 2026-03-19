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
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY;

// 靜態檔案
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(express.json());

// 健康檢查
app.get('/health', (req, res) => {
  res.status(200).send('ok');
});

function getSheetsClient() {
  const auth = new google.auth.JWT(
    GOOGLE_SERVICE_ACCOUNT_EMAIL,
    null,
    (GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/spreadsheets']
  );

  return google.sheets({ version: 'v4', auth });
}

async function getLineProfileFromAccessToken(accessToken) {
  const resp = await fetch('https://api.line.me/v2/profile', {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`LINE profile fetch failed: ${resp.status} ${text}`);
  }

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
    requestBody: {
      values: [row]
    }
  });
}

async function updateClaimedByRowIndex(rowIndex, claimedValue) {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: `Sheet1!F${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[claimedValue]]
    }
  });
}

function pickPrize() {
  const random = Math.random() * 100;

  if (random < 70) {
    return {
      prizeKey: 'm310',
      couponUrl: 'https://lin.ee/nOBmzbiP',
      title: '恭喜您抽中：\nEPSON M310DN 印表機應援優惠 🎉',
      desc: '請點下方按鈕回到 LINE 領取優惠券。',
      imageIndex: 2
    };
  }

  return {
    prizeKey: 'toner',
    couponUrl: 'https://lin.ee/yydvi5g',
    title: '恭喜您抽中：\n隨機黑色碳粉匣贈品優惠 🎉',
    desc: '請點下方按鈕回到 LINE 領取優惠券。',
    imageIndex: 1
  };
}

function mapPrize(prizeKey) {
  if (prizeKey === 'm310') {
    return {
      prizeKey: 'm310',
      couponUrl: 'https://lin.ee/nOBmzbiP',
      title: '恭喜您抽中：\nEPSON M310DN 印表機應援優惠 🎉',
      desc: '請點下方按鈕回到 LINE 領取優惠券。',
      imageIndex: 2
    };
  }

  return {
    prizeKey: 'toner',
    couponUrl: 'https://lin.ee/yydvi5g',
    title: '恭喜您抽中：\n隨機黑色碳粉匣贈品優惠 🎉',
    desc: '請點下方按鈕回到 LINE 領取優惠券。',
    imageIndex: 1
  };
}

async function findUserDrawRecord(userId) {
  const rows = await getAllDrawRows();
  if (rows.length <= 1) return null;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowUserId = row[1] || '';
    if (rowUserId === userId) {
      return {
        rowIndex: i + 1,
        timestamp: row[0] || '',
        userId: row[1] || '',
        displayName: row[2] || '',
        prizeKey: row[3] || '',
        couponUrl: row[4] || '',
        claimed: String(row[5] || '').toUpperCase() === 'TRUE'
      };
    }
  }

  return null;
}

// =======================
// LIFF API
// =======================

// 查詢抽獎狀態
app.post('/api/draw/status', async (req, res) => {
  try {
    const { accessToken } = req.body || {};
    if (!accessToken) {
      return res.status(400).json({ error: 'missing accessToken' });
    }

    const profile = await getLineProfileFromAccessToken(accessToken);
    const record = await findUserDrawRecord(profile.userId);

    if (!record) {
      return res.json({
        alreadyDrawn: false
      });
    }

    const prize = mapPrize(record.prizeKey);

    return res.json({
      alreadyDrawn: true,
      claimed: record.claimed,
      prize
    });
  } catch (error) {
    console.error('/api/draw/status error:', error.message || error);
    return res.status(500).json({ error: 'status check failed' });
  }
});

// 執行抽獎
app.post('/api/draw', async (req, res) => {
  try {
    const { accessToken } = req.body || {};
    if (!accessToken) {
      return res.status(400).json({ error: 'missing accessToken' });
    }

    const profile = await getLineProfileFromAccessToken(accessToken);
    const existing = await findUserDrawRecord(profile.userId);

    if (existing) {
      return res.json({
        alreadyDrawn: true,
        claimed: existing.claimed,
        prize: mapPrize(existing.prizeKey)
      });
    }

    const prize = pickPrize();

    await appendDrawRow([
      new Date().toISOString(),
      profile.userId,
      profile.displayName || '',
      prize.prizeKey,
      prize.couponUrl,
      'FALSE'
    ]);

    return res.json({
      alreadyDrawn: false,
      claimed: false,
      prize
    });
  } catch (error) {
    console.error('/api/draw error:', error.message || error);
    return res.status(500).json({ error: 'draw failed' });
  }
});

// 標記已領券
app.post('/api/claim', async (req, res) => {
  try {
    const { accessToken } = req.body || {};
    if (!accessToken) {
      return res.status(400).json({ error: 'missing accessToken' });
    }

    const profile = await getLineProfileFromAccessToken(accessToken);
    const existing = await findUserDrawRecord(profile.userId);

    if (!existing) {
      return res.status(404).json({ error: 'record not found' });
    }

    if (!existing.claimed) {
      await updateClaimedByRowIndex(existing.rowIndex, 'TRUE');
    }

    return res.json({
      ok: true,
      prize: mapPrize(existing.prizeKey)
    });
  } catch (error) {
    console.error('/api/claim error:', error.message || error);
    return res.status(500).json({ error: 'claim failed' });
  }
});

// =======================
// Webhook
// =======================
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

  if (event.type === 'message' && event.message.type === 'text') {
    const userText = (event.message.text || '').trim();

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
          text: '本次應援優惠獎項如下，點擊下方按鈕試試手氣吧 🎁'
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
                  backgroundColor: '#805AD5',
                  paddingAll: '20px',
                  contents: [
                    {
                      type: 'text',
                      text: '🏃‍♂️ 應援活動',
                      size: 'xs',
                      color: '#D6BCFA'
                    },
                    {
                      type: 'text',
                      text: '2026 全障運應援抽獎',
                      weight: 'bold',
                      color: '#FFFFFF',
                      size: 'xl',
                      wrap: true,
                      margin: 'md'
                    },
                    {
                      type: 'text',
                      text: '人人有獎，最高價值 1 萬元',
                      color: '#ECE8F3',
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

    if (userText.includes('我要使用優惠券，請協助我')) {
      return client.replyMessage(event.replyToken, {
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
      });
    }

    return null;
  }

  if (event.type === 'postback') {
    const postbackData = event.postback?.data || '';

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
