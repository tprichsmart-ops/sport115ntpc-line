const express = require('express')
const line = require('@line/bot-sdk')

const app = express()

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
}

const client = new line.Client(config)

app.get('/health', (req, res) => {
  res.send('ok')
})

app.post('/webhook', line.middleware(config), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
})

async function handleEvent(event) {

  if (event.type === 'message' && event.message.type === 'text') {

    if (event.message.text === '我來為2026全障運選手加油了~') {

      const messages = [
        {
          type: 'text',
          text: '嗨～我是小編 😊\n歡迎加入我們的 Line！\n\n今年我們很榮幸參與\n2026 全障運賽事的贊助與支持\n\n一起為努力突破自我的選手們加油 💪'
        },
        {
          type: 'template',
          altText: '領取優惠券',
          template: {
            type: 'buttons',
            text: '為了替選手們應援\n小編準備了一份 Epson M310 專屬優惠券',
            actions: [
              {
                type: 'postback',
                label: '領取 M310 優惠券',
                data: 'action=pg2026_coupon'
              }
            ]
          }
        }
      ]

      return client.replyMessage(event.replyToken, messages)
    }
  }

  if (event.type === 'postback') {

  if (event.postback.data === 'action=pg2026_coupon') {

  const messages = [

    {
      type: 'text',
      text: '小編已幫您準備好 Epson M310 專屬優惠券 🎁'
    },

    {
      type: 'template',
      altText: '開啟優惠券',
      template: {
        type: 'buttons',
        text: '點擊下方按鈕開啟優惠券',
        actions: [
          {
            type: 'uri',
            label: '開啟 M310 優惠券',
            uri: 'https://line.me/R/ch/1654883387?couponId=01KKWNX2DTRQ8G3S9X8YE0E77X'
          }
        ]
      }
    },

    {
      type: 'template',
      altText: '下載型錄',
      template: {
        type: 'buttons',
        text: '需要產品詳細資訊可以下載型錄',
        actions: [
          {
            type: 'uri',
            label: '下載 M310 型錄',
            uri: 'https://myppt.cc/TWD9lK'
          }
        ]
      }
    },

    {
      type: 'text',
      text: '想先認識一下新朋友 😊\n\n請跟小編分享：\n1️⃣ 服務單位\n2️⃣ 您的大名'
    }

  ]

  return client.replyMessage(event.replyToken, messages)
}
  }

  return Promise.resolve(null)
}

const port = process.env.PORT || 3000

app.listen(port, () => {
  console.log(`server running on ${port}`)
})
