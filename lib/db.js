require("dotenv").config();
const MongoClient = require("mongodb").MongoClient;

const MONGODB_URI = process.env.MONGODB_URI;

function put(id, title) {
  return new Promise((resolve, reject) => {
    MongoClient.connect(
      MONGODB_URI,
      { useUnifiedTopology: true },
      (err, db) => {
        const dbo = db.db("db");
        dbo
          .collection("title")
          .insertOne({ kid: id, title: title }, (err, res) => {
            db.close();
            resolve(res);
          });
      }
    );
  });
}

function get(id) {
  return new Promise((resolve, reject) => {
    MongoClient.connect(
      MONGODB_URI,
      { useUnifiedTopology: true },
      (err, db) => {
        const dbo = db.db("db");
        dbo.collection("title").findOne({ kid: id }, (err, res) => {
          db.close();
          resolve(res);
        });
      }
    );
  });
}

module.exports = { put, get };
