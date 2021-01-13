const express = require("express");
const addon = express();

const { get_stream } = require("./lib/functions");

const MANIFEST = require("./manifest.json");

function respond(res, data) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Content-Type", "application/json");
  res.send(data);
}

addon.get("/manifest.json", (req, res) => {
  respond(res, MANIFEST);
});

addon.param("type", (req, res, next, val) => {
  if (MANIFEST.types.includes(val)) {
    next();
  } else {
    next("Unsupported type " + val);
  }
});

addon.get("/stream/:type/:media.json", async (req, res, next) => {
  const media = req.params.media;
  const arr = media.split(":");
  const id = arr[1];
  const ep = arr[2];

  const e = await get_stream(media, id, ep);

  respond(res, {
    streams: e,
  });
});

addon.get("/", (req, res) => {
  res.send("Hey there!");
});

addon.listen(process.env.PORT || 7000, () => {
  console.log("Add-on Repository URL: http://127.0.0.1:7000/manifest.json");
});