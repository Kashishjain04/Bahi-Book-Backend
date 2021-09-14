const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const firebase = require("./firebase.js");

const db = firebase.firestore();

const PORT = process.env.PORT || 5000;

// initialize app
const app = express();
dotenv.config();

// request payload size limit
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// middleware
app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  db.doc("/users/test@user.com").onSnapshot((snap) => {
    if (snap.exists) {
      console.log(snap.data());
    }
  });
  res.send("Hello World");
});

app.use("/api", require("./api.js"));

app.listen(PORT, () => {
  console.log(`✅ Server started on port ${PORT}`);
});
