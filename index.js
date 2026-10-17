const express = require("express");
const crypto = require("node:crypto");
const prisma = require("./lib/prisma");
const redis = require("./lib/redis");
const { validateUrl } = require("./middleware/validator");

const app = express();

app.use(express.json());

const port = process.env.PORT || 3000;

const startServer = async () => {
  await redis.connect();

  app.listen(port, () => {
    console.log(`Application started at port: ${port}`);
  });
};

app.get("/:code", async (req, res) => {
  const { code } = req.params;
  const cache_key = `url_${code}`;

  const cache = await redis.get(cache_key);

  if (cache) {
    const parsed = JSON.parse(cache);
    return res.redirect(parsed.url);
  }

  const query = await prisma.urls.findUnique({
    where: {
      code,
    },
  });

  if (!query) {
    return res.status(404).json({ message: "item not found!" });
  }

  const duration = 5 * 60 * 60;

  console.log({
    cache_key,
    query,
    serializedQuery: JSON.stringify(query),
    duration,
  });

  await redis.set(cache_key, JSON.stringify(query), { EX: duration });
  const gottenUrl = query.url;
  res.redirect(gottenUrl);
});

app.post("/", validateUrl, async (req, res) => {
  const { url } = req.body;

  const found = await prisma.urls.findFirst({
    where: {
      url,
    },
  });

  const uuid = crypto.randomUUID();
  const obj = { code: uuid, url };
  if (!found) {
    const created = await prisma.urls.create({ data: obj });

    return res.status(201).json({
      message: "new item created",
      code: created.code,
    });
  }

  res.status(200).json({
    message: "item already exists",
    code: found.code,
  });
});

startServer();
