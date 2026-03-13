const express = require("express");
const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>sport115ntpc</title>
      </head>
      <body style="font-family: Arial; padding: 40px;">
        <h1>sport115ntpc 專案已啟動</h1>
        <p>這是 Render 上的第一個測試頁。</p>
      </body>
    </html>
  `);
});

app.get("/health", (req, res) => {
  res.json({ ok: true, project: "sport115ntpc-line" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
