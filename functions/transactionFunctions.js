const db = require("../firebase.js").firestore;
const storage = require("../firebase.js").storage;
const stream = require("stream");
const notificationFunctions = require("./notificationFunctions.js");

const uploadFile = (
	res,
	custRef,
	transRef,
	selfRef,
	selfTransRef,
	user,
	customerId,
	isGiving,
	amount,
	desc,
	fileType,
	base64
) => {
	const bufferStream = new stream.PassThrough();
	bufferStream.end(new Buffer.from(base64.split("base64,")[1], "base64"));
	const storageRef = storage().bucket("bahi-book.appspot.com");
	const file = storageRef.file(`receipts/${transRef.id}`);
	bufferStream
		.pipe(
			file.createWriteStream({
				metadata: { contentType: fileType || "image/*" },
			})
		)
		.on("error", () => {
			res.status(500).send("Error Uploading File");
		})
		.on("finish", (fileRet) => {
			// The file upload is complete.
			console.log(fileRet);
			file?.getSignedUrl(
				{ action: "read", expires: "01-01-2500" },
				(err, signedUrl) => {
					if (err) {
						res.status(500).send("Error Uploading File");
					} else {
						dbUpdates(
							res,
							custRef,
							transRef,
							selfRef,
							selfTransRef,
							user,
							customerId,
							isGiving,
							amount,
							desc,
							signedUrl
						);
					}
				}
			);
		});
};

const dbUpdates = (
	res,
	custRef,
	transRef,
	selfRef,
	selfTransRef,
	user,
	customerId,
	isGiving,
	amount,
	desc,
	url = ""
) => {
	let amt = 0;
	if (isGiving) {
		amt = -1 * Number(amount);
	} else {
		amt = Number(amount);
	}
	const lastActivity = db.FieldValue.serverTimestamp();

	// Adding transaction in customer's transactions collection
	transRef.set({
		timestamp: lastActivity,
		amount: amt,
		desc,
		receipt: url,
		by: user.email,
	});

	// Adding transaction in self transactions collection
	selfTransRef.set({
		timestamp: lastActivity,
		amount: -1 * amt,
		desc,
		receipt: url,
		by: user.email,
	});
	if (isGiving) {
		// Updating self sent amount
		db()
			.collection("users")
			.doc(user?.email)
			.update({ sent: db.FieldValue.increment(Math.abs(amt)) });
		// Updating customer's received amount
		db()
			.collection("users")
			.doc(customerId)
			.get()
			.then(async (doc) => {
				doc.ref.update({ received: db.FieldValue.increment(Math.abs(amt)) });
				const notifData = {
					expoTokens: doc.data().expoPushTokens,
					fcmTokens: doc.data().fcmTokens,
					title:
						(doc.data().customers[user.email] || user.name) +
						" added a transaction with you",
					body: "You got ₹" + Math.abs(amt),
					data: {
						type: "transaction",
						friendId: user.email,
						transactionId: transRef.id,
						amount: Math.abs(amt).toString(),
					},
					link: `/customer/${user.email}`,
					userId: customerId,
				};
				notificationFunctions.sendNotifs(notifData);
			});
	} else {
		// Updating self received amount
		db()
			.collection("users")
			.doc(user.email)
			.update({ received: db.FieldValue.increment(Math.abs(amt)) });
		// Updating customer's sent amount
		db()
			.collection("users")
			.doc(customerId)
			.get()
			.then(async (doc) => {
				doc.ref.update({ sent: db.FieldValue.increment(Math.abs(amt)) });
				const notifData = {
					expoTokens: doc.data().expoPushTokens,
					fcmTokens: doc.data().fcmTokens,
					title:
						(doc.data().customers[user.email] || user.name) +
						" added a transaction with you",
					body: "You gave ₹" + Math.abs(amt),
					data: {
						type: "transaction",
						friendId: user.email,
						transactionId: transRef.id,
						amount: Math.abs(amt).toString(),
					},
					link: `/customer/${user.email}`,
					userId: customerId,
				};
				notificationFunctions.sendNotifs(notifData);
			});
	}
	// Updating customer's balance and activity
	custRef.update({
		balance: db.FieldValue.increment(amt),
		lastActivity,
	});
	// Updating self balance and activity
	selfRef
		.update({
			balance: db.FieldValue.increment(-1 * amt),
			lastActivity,
		})
		.then(() => {
			res.status(200).send({ message: "Request Successful" });
		})
		.catch((err) => console.log(err));
};

const deleteTransaction = async (res, user, custId, transId) => {
	// gave -> -ve
	// got -> +ve
	// balance -= amount
	const userDocRef = db().collection("users").doc(user.email);
	const custDocRef = db().collection("users").doc(custId);
	const userCustRef = db()
		.collection("users")
		.doc(user.email)
		.collection("customers")
		.doc(custId);
	const custUserRef = db()
		.collection("users")
		.doc(custId)
		.collection("customers")
		.doc(user.email);
	const userTransRef = db()
		.collection("users")
		.doc(user.email)
		.collection("customers")
		.doc(custId)
		.collection("transactions")
		.doc(transId);
	const custTransRef = db()
		.collection("users")
		.doc(custId)
		.collection("customers")
		.doc(user.email)
		.collection("transactions")
		.doc(transId);

	// get amount of transaction
	const amount = await userTransRef
		.get()
		.then((doc) => Number(doc.data().amount));
	try {
		// update total sent & recieved on user & customer documents
		if (amount < 0) {
			await userDocRef.update({
				sent: db.FieldValue.increment(amount),
			});
			custDocRef.update({
				received: db.FieldValue.increment(amount),
			});
		} else {
			await userDocRef.update({
				received: db.FieldValue.increment(-1 * amount),
			});
			custDocRef.update({
				sent: db.FieldValue.increment(-1 * amount),
			});
		}
		// update customer balance on user & customer documents
		await userCustRef.update({
			balance: db.FieldValue.increment(-1 * amount),
		});
		custUserRef.update({
			balance: db.FieldValue.increment(amount),
		});
		// delete transaction from user & customer documents
		await userTransRef.delete();
		custTransRef.delete().then(() => {
			res.status(200).send({ message: "success" });
		});
	} catch (error) {
		res.status(500).send({ error: error.message || "Invalid Error" });
	}
};

const transactionFunctions = {
	uploadFile,
	dbUpdates,
	deleteTransaction,
};

module.exports = transactionFunctions;
