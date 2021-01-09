const request = require("request");
const express = require("express");
const addon = express();

const NodeCache = require("node-cache");
const cache = new NodeCache();

const { get, put } = require("./lib/db");

require("dotenv").config();
const KI_PRE = process.env.KI_PRE;
const KI_SUF = process.env.KI_SUF;
const SE_PRE = process.env.SE_PRE;
const TU_PRE = process.env.TU_PRE;
const TU_SUF = process.env.TU_SUF;
const HOST = process.env.HOST;
const SERVER = process.env.SERVER;

const MAX_AGE = 60 * 60 * 24 * 7;
const LINK_TTL = 60 * 30;
const MANIFEST = require("./manifest.json");
const EPISODE = "Ep";
const DUB = "dub";
const SUB = "sub";

const search = (query) => {
  return new Promise((resolve, reject) => {
    request(SE_PRE + query, (e, r, b) => {
      const broken = b.split("category/").slice(1);
      const search = broken.map((x) => {
        const idx = x.indexOf("\\");
        return x.substring(0, idx);
      });

      const arr = [search[0]];
      if (search.includes(search[0] + "-dub")) {
        arr.push(search[0] + "-dub");
      }
      console.log(arr);
      resolve(arr);
    });
  });
};

const ki_title = (id) => {
  return new Promise((resolve, reject) => {
    request(KI_PRE + id + KI_SUF, (e, r, b) => {
      const json = JSON.parse(b);
      const name = json.meta.name;
      const title = name.replace(/[^a-z0-9 ]/gi, "");
      console.log(title);
      resolve(title);
    });
  });
};

const get_title = async (id) => {
  return new Promise(async (resolve, reject) => {
    const s_title = await ki_title(id);
    const p = await search(s_title);
    resolve(p);
  });
};

const tunnel = (title, ep) => {
  return new Promise((resolve, reject) => {
    request(TU_PRE + title + TU_SUF + ep, (e, r, b) => {
      if (r.statusCode == 200) {
        const json = JSON.parse(b);
        const source = json.openload;
        const link = source.replace(HOST, SERVER);
        resolve(link);
      } else {
        resolve(null);
      }
    });
  });
};

const source = (tunnel) => {
  return new Promise(async (resolve, reject) => {
    request(tunnel, (e, r, b) => {
      const json = JSON.parse(b);
      const stream = json.source[0].file;
      resolve(stream);
    });
  });
};

const stream = async (title, e) => {
  return new Promise(async (resolve, reject) => {
    const ep = e ? e : 1;
    const t = await tunnel(title, ep);
    if (t == null) {
      resolve(null);
    } else {
      const s = await source(t);
      resolve(s);
    }
  });
};

const check = (streams) => {
  streams.forEach((x) => {
    if (x.url == null) {
      return false;
    }
  });
  return true;
};

const respond = (res, data) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Content-Type", "application/json");
  res.send(data);
};

addon.get("/manifest.json", (req, res) => {
  respond(res, MANIFEST);
});

addon.get("/stream/:type/:media.json", async (req, res, next) => {
  const media = req.params.media;
  const arr = media.split(":");
  const id = arr[1];
  const ep = arr[2];

  if (!cache.get(media)) {
    if (!cache.get(id)) {
      if ((await get(id)) == null) {
        const ts = await get_title(id);
        const p_res = await put(id, ts);
      }
      const res = await get(id);
      cache.set(id, res.title, MAX_AGE);
    }

    const t = cache.get(id);

    const links = await Promise.all(
      t.map(async (x) => {
        return {
          name: "A4U",
          title: `${EPISODE} ${ep} ${x.includes("dub") ? DUB : SUB}`,
          url: await stream(x, ep),
        };
      })
    );

    cache.set(media, check(links) ? links : [], LINK_TTL);
  }

  const e = cache.get(media);

  respond(res, {
    streams: e,
  });
});

addon.get("/", (req, res) => {
  res.send("Hey there!");
});

addon.listen(7000, () => {
  console.log("Add-on Repository URL: http://127.0.0.1:7000/manifest.json");
});
