require("dotenv").config();
const request = require("request");

const NodeCache = require("node-cache");
const cache = new NodeCache();

const { get, put } = require("./db");

const KI_PRE = process.env.KI_PRE;
const KI_SUF = process.env.KI_SUF;
const SE_PRE = process.env.SE_PRE;
const TU_PRE = process.env.TU_PRE;
const TU_SUF = process.env.TU_SUF;
const HOST = process.env.HOST;
const SERVER = process.env.SERVER;

const MAX_AGE = 60 * 60 * 24 * 7;
const LINK_TTL = 60 * 30;

const EPISODE = "EP";
const DUB = "DUB";
const SUB = "SUB";
const MAS = "MAS+";

function search(query) {
  return new Promise((resolve, reject) => {
    request(SE_PRE + query, (e, r, b) => {
      const broken = b.split("category/").slice(1);
      const search = broken.map((x) => {
        const idx = x.indexOf("\\");
        return x.substring(0, idx);
      });

      const arr = [];

      if (search[0] != null) {
        arr.push(search[0]);
        if (search.includes(search[0] + "-dub")) {
          arr.push(search[0] + "-dub");
        }
      }

      resolve(arr);
    });
  });
}

function ki_title(id) {
  return new Promise((resolve, reject) => {
    request(KI_PRE + id + KI_SUF, (e, r, b) => {
      const json = JSON.parse(b);
      const name = json.meta.name;
      const title = name.replace(/[^a-z0-9 ]/gi, " ");
      console.log(title);
      resolve(title);
    });
  });
}

async function get_title(id) {
  return new Promise(async (resolve, reject) => {
    const s_title = await ki_title(id);
    const p = await search(s_title);
    resolve(p);
  });
}

function tunnel(title, ep) {
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
}

function source(tunnel) {
  return new Promise(async (resolve, reject) => {
    request(tunnel, (e, r, b) => {
      const json = JSON.parse(b);
      const stream = json.source[0].file;
      resolve(stream);
    });
  });
}

async function stream(title, e) {
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
}

async function get_stream(media, id, ep) {
  return new Promise(async (resolve, reject) => {
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

      console.log(t);

      const links = await Promise.all(
        t.map(async (x) => {
          return {
            name: MAS,
            title: `${ep ? `${EPISODE} ${ep}` : ``} ${
              x.includes("dub") ? DUB : SUB
            }`,
            url: await stream(x, ep),
          };
        })
      );

      cache.set(media, links, LINK_TTL);
    }

    const e = cache.get(media);
    console.log(e);
    resolve(e);
  });
}

module.exports = { get_stream };
