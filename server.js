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

  if (event.type !== 'message') {
    return Promise.resolve(null)
  }

  if (event.message.type === 'text') {

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
                type: 'uri',
                label: '領取 M310 優惠券',
                uri: 'https://lin.ee/nP7OLzc'
              },

              {
                type: 'uri',
                label: '查看 M310 型錄',
                uri: 'https://myppt.cc/TWD9lK'
              }

            ]
          }
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
