const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { app, router, server } = require("./api.js");

const PORT = process.env.PORT || 5000;

dotenv.config();
// request payload size limit
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// middleware
app.use(express.json());
app.use(cors());

app.get("/", (_, res) => {  
  res.send(`<div style="height: 100%; display: grid; place-items: center;"><p>404 | This website is for API Use Only.</p></div>`);
});

app.use("/api", router);

server.listen(PORT, () => {
  console.log(`✅ Server started on port ${PORT}`);
});
