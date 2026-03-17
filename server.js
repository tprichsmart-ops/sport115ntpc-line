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
          text: '小編已幫您準備好 Epson M310 專屬優惠券 🎁\n\nhttps://raw.githubusercontent.com/tprichsmart-ops/sport115ntpc-line/main/assets/EPSON%20AL-M310DN%20%E5%9E%8B%E9%8C%84.pdf'
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
