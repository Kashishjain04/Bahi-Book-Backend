const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { app, router, server } = require("./api.js");

const PORT = process.env.PORT || 5000;

dotenv.config();
// request payload size limit
app.use('/static', express.static('static'))
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// middleware
app.use(express.json());
app.use(
	cors(
	// 	{
	// 	origin: [
	// 		"https://bahi-book.web.app",
	// 		"https://bahi-book.firebaseapp.com",
	// 		"http://localhost:3000",
	// 	],
	// }
	)
);

app.get("/", (_, res) => {
	res.sendFile(__dirname + '/static/index.html')	
});

app.use("/api", router);

server.listen(PORT, () => {
	console.log(`✅ Server started on port ${PORT}`);
});
