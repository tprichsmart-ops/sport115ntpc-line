const express = require("express");

const app = express();
app.use(express.json());

const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

app.get("/", (req, res) => {
  res.send("sport115ntpc official bot running");
});

app.post("/webhook", async (req, res) => {

  const events = req.body.events;

  for (const event of events) {

    if (event.type === "message" && event.message.type === "text") {

      const text = event.message.text;

      if (text.includes("為2026全障運選手加油")) {

        await fetch("https://api.line.me/v2/bot/message/reply", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${CHANNEL_ACCESS_TOKEN}`
          },
          body: JSON.stringify({
            replyToken: event.replyToken,
            messages: [
              {
                type: "text",
                text: `謝謝您的一聲加油，成為選手前進的力量！

為了感謝您一起為選手打氣，我們準備了：

EPSON M310DN A4桌上型印表機
買一送一券 🎁

祝所有參賽選手
比賽順利、突破自我 🏅`
              }
            ]
          })
        });

      }

    }

  }

  res.sendStatus(200);

});

const PORT = process.env.PORT || 3000;
app.listen(PORT);
