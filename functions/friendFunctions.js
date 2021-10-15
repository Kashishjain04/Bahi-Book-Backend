const db = require("../firebase.js").firestore;
const notificationFunctions = require('./notificationFunctions.js');

const addCustomer = (res, user, id, name) => {
	const lastActivity = db.FieldValue.serverTimestamp();

	// Add customer to user's customers collection
	db()
		.collection("users")
		.doc(user?.email)
		.collection("customers")
		.doc(id)
		.set({ name, balance: 0, lastActivity });

	db()
		.collection("users")
		.doc(user.email)
		.set({ customers: { [id]: name } }, { merge: true });
	// Create customer's doc if not exist
	db()
		.collection("users")
		.doc(id)
		.set({ customers: { [user.email]: user.name } }, { merge: true });

	// Add user to customer's customers collection
	db()
		.collection("users")
		.doc(id)
		.get()
		.then((doc) => {
			doc.ref
				.collection("customers")
				.doc(user?.email)
				.set({ name: user?.name, balance: 0, lastActivity })
				.then(() => {
					const notifData = {
						expoTokens: doc.data().expoPushTokens,
						fcmTokens: doc.data().fcmTokens,
						title: "Friend Added",
						body: user.name + " added you as their friend.",
						data: {
							type: "friend",
							friendId: user.email,
						},
						link: `/customer/${user.email}`,
						userId: id,
					};
					notificationFunctions.sendNotifs(notifData);					
				});
		})
		.catch(() => res.status(500).send({ error: "Invalid Error" }));
};

const getCustDoc = (res, user, custId) => {
	db()
		.collection("users")
		.doc(user?.email)
		.collection("customers")
		.doc(custId)
		.get()
		.then((doc) => {
			if (doc.exists) {
				res.status(200).send({ message: "success", data: doc.data() });
			} else {
				res.status(500).send({ error: "ivalid friend id", data: null });
			}
		})
		.catch((err) => {
			res.status(500).send({ error: err || "ivalid error", data: null });
		});
};

const editCustomer = (res, user, custId, name) => {
	db()
		.collection("users")
		.doc(user.email)
		.set({ customers: { [custId]: name } }, { merge: true })
		.catch((err) =>
			res.status(500).send({ error: err.message || "Invalid Error" })
		);
	db()
		.collection("users")
		.doc(user?.email)
		.collection("customers")
		.doc(custId)
		.update({ name })
		.then(() =>
			res.status(200).send({ message: "Customer edited successfully" })
		)
		.catch((err) =>
			res.status(500).send({ error: err.message || "Invalid Error" })
		);
};

const friendFunctions = {
    addCustomer,
    getCustDoc,
    editCustomer,
}

module.exports = friendFunctions;