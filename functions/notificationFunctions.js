const db = require("./firebase.js").firestore;
const messaging = require("./firebase.js").messaging;
const axios = require("axios").default;
const expoPushUrl = "https://exp.host/--/api/v2/push/send";

const expoPush = ({ tokens, title, body, data }) => {
	let msgs = [];
	tokens.forEach((token) => {
		msgs.push({
			to: token,
			title,
			body,
			data,
		});
	});
	return axios({
		url: expoPushUrl,
		method: "POST",
		data: msgs,
		headers: {
			accept: "application/json",
			"content-type": "application/json",
		},
	})
		.then(() => ({ message: "success" }))
		.catch((err) => console.log(err));
};

const fcmPush = async ({ tokens, title, body, data, link, userId }) => {
	if (!tokens || !tokens.length) {
		return { error: "no tokens to send notifications" };
	}
	const payload = {
		notification: {
			title,
			body,
			click_action: link,
		},
		data,
	};

	const res = await messaging().sendToDevice(tokens, payload);

	res.results.forEach((result, index) => {
		const error = result.error;
		if (error) {
			// Cleanup the tokens who are not registered anymore.
			if (
				error.code === "messaging/invalid-registration-token" ||
				error.code === "messaging/registration-token-not-registered"
			) {
				db()
					.collection("users")
					.doc(userId)
					.update({
						fcmTokens: db.FieldValue.arrayRemove(tokens[index]),
					});
			}
		}
	});

	return { message: "success" };
};

const sendNotifs = (data) => {
	const expoPayload = {
		tokens: data.expoTokens,
		title: data.title,
		body: data.body,
		data: data.data,
	};
	expoPush(expoPayload);
	const fcmPayload = {
		tokens: data.fcmTokens,
		title: data.title,
		body: data.body,
		data: data.data,
		link: data.link,
		userId: data.userId,
	};
	fcmPush(fcmPayload);
};

const notificationFunctions = {
    sendNotifs
};

module.exports = notificationFunctions;