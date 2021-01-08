require("dotenv").config();
var request = require("request");
var express = require("express");
var addon = express();

var MANIFEST = require("./manifest.json");

var NodeCache = require("node-cache");
var cache = new NodeCache();

var KI_PRE = process.env.KI_PRE;
var KI_SUF = process.env.KI_SUF;
var SE_PRE = process.env.SE_PRE;
var TU_PRE = process.env.TU_PRE;
var TU_SUF = process.env.TU_SUF;

const MAX_AGE = 60 * 60 * 24 * 7;
const LINK_TTL = 60 * 30;

var search = (query) => {
  return new Promise((resolve, reject) => {
    request(SE_PRE + query, (e, r, b) => {
      var broken = b.split("category/").slice(1);
      var search = broken.map((x) => {
        var idx = x.indexOf("\\");
        return x.substring(0, idx);
      });

      var arr = [search[0]];
      if (search.includes(search[0] + "-dub")) {
        arr.push(search[0] + "-dub");
      }
      resolve(arr);
    });
  });
};

var ki_title = (id) => {
  return new Promise((resolve, reject) => {
    request(KI_PRE + id + KI_SUF, (e, r, b) => {
      var json = JSON.parse(b);
      var name = json.meta.name;
      var title = name.replace(/[^a-z0-9 ]/gi, " ");
      resolve(title);
    });
  });
};

var get_title = async (id) => {
  return new Promise(async (resolve, reject) => {
    var s_title = await ki_title(id);
    var p = await search(s_title);
    resolve(p);
  });
};

var tunnel = (title, ep) => {
  return new Promise((resolve, reject) => {
    request(TU_PRE + title + TU_SUF + ep, (e, r, b) => {
      var json = JSON.parse(b);
      var source = json.openload;
      var link = source.replace("streaming", "ajax");
      resolve(link);
    });
  });
};

var source = (tunnel) => {
  return new Promise(async (resolve, reject) => {
    request(tunnel, (e, r, b) => {
      var json = JSON.parse(b);
      var stream = json.source[0].file;
      console.log(stream);
      resolve(stream);
    });
  });
};

var stream = async (title, e) => {
  return new Promise(async (resolve, reject) => {
    var ep = e ? e : 1;
    var t = await tunnel(title, ep);
    var s = await source(t);
    resolve(s);
  });
};

var respond = (res, data) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Content-Type", "application/json");
  res.send(data);
};

addon.get("/manifest.json", (req, res) => {
  respond(res, MANIFEST);
});

addon.get("/stream/:type/:media.json", async (req, res, next) => {
  var media = req.params.media;
  var arr = media.split(":");
  var id = arr[1];
  var ep = arr[2];

  if (!cache.get(media)) {
    if (!cache.get(id)) {
      cache.set(id, await get_title(id), MAX_AGE);
    }
    var t = cache.get(id);

    cache.set(
      media,

      await Promise.all(
        t.map(async (x) => {
          return {
            name: "A4U",
            title: x.replace(/[^a-z0-9 ]/gi, " "),
            url: await stream(x, ep),
          };
        })
      ),
      LINK_TTL
    );
  }

  var e = cache.get(media);

  respond(res, {
    streams: e,
  });
});

addon.listen(7000, () => {
  console.log("Add-on Repository URL: http://127.0.0.1:7000/manifest.json");
});
