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

// 靜態檔案
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// 只讓 /api 使用 JSON parser，避免影響 LINE webhook 驗簽
app.use('/api', express.json());

// 健康檢查
app.get('/health', (req, res) => {
  res.status(200).send('ok');
});

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

async function updateClaimedByUserId(userId, claimedValue) {
  const rows = await getAllDrawRows();

  if (rows.length <= 1) return false;

  const sheets = getSheetsClient();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowUserId = row[1] || '';

    if (rowUserId === userId) {
      const rowIndex = i + 1;
      await sheets.spreadsheets.values.update({
        spreadsheetId: GOOGLE_SHEET_ID,
        range: `Sheet1!F${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[claimedValue]]
        }
      });
      return true;
    }
  }

  return false;
}

function pickPrize() {
  const random = Math.random() * 100;

  if (random < 70) {
    return {
      prizeKey: 'm310',
      couponUrl: 'https://lin.ee/NlDXfDT',
      title: '恭喜您抽中：\nEPSON M310DN 雙機應援優惠 🎉',
      desc: '請點下方按鈕回 LINE 領取優惠券。',
      imageIndex: 2
    };
  }

  return {
    prizeKey: 'toner',
    couponUrl: 'https://lin.ee/R6jCME4',
    title: '恭喜您抽中：\n加碼贈黑色碳粉匣乙支優惠 🎉',
    desc: '請點下方按鈕回 LINE 領取優惠券。',
    imageIndex: 1
  };
}

function mapPrize(prizeKey) {
  if (prizeKey === 'm310') {
    return {
      prizeKey: 'm310',
      couponUrl: 'https://lin.ee/NlDXfDT',
      title: '恭喜您抽中：\nEPSON M310DN 雙機應援優惠 🎉',
      desc: '請點下方按鈕回 LINE 領取優惠券。',
      imageIndex: 2
    };
  }

  return {
    prizeKey: 'toner',
    couponUrl: 'https://lin.ee/R6jCME4',
    title: '恭喜您抽中：\n加碼贈黑色碳粉匣乙支優惠 🎉',
    desc: '請點下方按鈕回 LINE 領取優惠券。',
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
    console.error(
      '/api/draw/status error:',
      error?.response?.data || error?.errors || error?.message || error
    );

    return res.status(500).json({ error: 'status check failed' });
  }
});

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
    console.error(
      '/api/draw error:',
      error?.response?.data || error?.errors || error?.message || error
    );

    return res.status(500).json({ error: 'draw failed' });
  }
});

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
      await updateClaimedByUserId(profile.userId, 'TRUE');
    }

    return res.json({
      ok: true,
      prize: mapPrize(existing.prizeKey)
    });
  } catch (error) {
    console.error(
      '/api/claim error:',
      error?.response?.data || error?.errors || error?.message || error
    );

    return res.status(500).json({ error: 'claim failed' });
  }
});

app.post('/api/push-after-draw', async (req, res) => {
  try {
    const { accessToken } = req.body || {};

    if (!accessToken) {
      return res.status(400).json({ error: 'missing accessToken' });
    }

    const profile = await getLineProfileFromAccessToken(accessToken);
    const existing = await findUserDrawRecord(profile.userId);

    if (!existing) {
      return res.status(404).json({ error: 'draw record not found' });
    }

    const prize = mapPrize(existing.prizeKey);

    const flexMessage = {
      type: 'flex',
      altText: 'EPSON M310DN 應援專案',
      contents: {
        type: 'bubble',
        size: 'mega',
        header: {
          type: 'box',
          layout: 'vertical',
          backgroundColor: '#6B46C1',
          paddingAll: '20px',
          contents: [
            {
              type: 'text',
              text: 'EPSON M310DN 應援專案',
              weight: 'bold',
              color: '#FFFFFF',
              size: 'xl',
              wrap: true
            },
            {
              type: 'text',
              text: '查看設備資訊，或讓我們協助您使用優惠',
              color: '#E9D8FD',
              size: 'sm',
              margin: 'md',
              wrap: true
            }
          ]
        },
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'md',
          paddingAll: '20px',
          contents: [
            {
              type: 'text',
              text: prize.title,
              weight: 'bold',
              size: 'md',
              wrap: true,
              color: '#111111'
            },
            {
              type: 'text',
              text: '您可以先查看設備型錄，或直接讓我們協助您使用這次優惠。',
              size: 'sm',
              color: '#666666',
              wrap: true
            }
          ]
        },
        footer: {
  type: 'box',
  layout: 'vertical',
  spacing: 'sm',
  contents: [
    {
      type: 'button',
      style: 'secondary',
      action: {
        type: 'postback',
        label: '設備型錄',
        data: 'action=view_catalog'
      }
    },
    {
      type: 'button',
      style: 'secondary',
      action: {
        type: 'uri',
        label: '查看我的優惠券',
        uri: prize.couponUrl
      }
    },
    {
      type: 'button',
      style: 'primary',
      color: '#6B46C1',
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

    const messages = [
      {
        type: 'text',
        text:
          '您已經完成抽獎，恭喜獲得優惠券🎉\n' +
          '趕快在購買Epson M310時使用吧！\n\n' +
          '若想了解設備資訊，\n' +
          '或想直接使用這次優惠，\n' +
          '都可以點下方按鈕，我來協助您 😊'
      },
      flexMessage,
      {
        type: 'text',
        text:
          '也歡迎留下\n' +
          '您的【服務單位】與【大名】\n' +
          '之後若有設備或優惠資訊，\n' +
          '我可以更精準協助您'
      }
    ];

    await client.pushMessage(profile.userId, messages);

    return res.json({ ok: true });
  } catch (error) {
    console.error(
      '/api/push-after-draw error:',
      error?.response?.data || error?.errors || error?.message || error
    );

    return res.status(500).json({ error: 'push after draw failed' });
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
    console.error('Webhook Error:', error?.response?.data || error?.message || error);
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
            '【2026 全障運賽事的贊助與支持】\n\n' +
            '讓我們一起為選手加油吧 💪\n\n' +
            '🎯 您已獲得應援抽獎資格\n' +
            '點擊下方按鈕即可開始抽獎'
        },
        {
          type: 'text',
          text: '本次抽獎獎項如下，快試試手氣吧🎁'
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
                  url: 'https://sport115ntpc-line.onrender.com/assets/GET_M310_V5.jpg',
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
                      text: '加碼贈EPSON M310DN 印表機 1 台',
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
                  url: 'https://sport115ntpc-line.onrender.com/assets/GET_toner_V5.jpg',
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
                      text: '加碼贈黑色碳粉匣 1 支',
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
                  url: 'https://sport115ntpc-line.onrender.com/assets/GET_0_V5.jpg',
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
          '好的，我來協助您使用應援優惠 😊\n\n' +
          '請回覆以下資訊，接下來交給我~\n\n' +
          '1. 裝機窗口姓名\n' +
          '2. 聯絡電話\n' +
          '3. 安裝地址\n' +
          '4. 服務單位名稱\n' +
          '5. 統編\n\n' +
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
