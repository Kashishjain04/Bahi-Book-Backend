const db = require("../firebase.js").firestore;
const userFunctions = require('./userFunctions.js');
const transactionFunctions = require('./transactionFunctions.js');
const friendFunctions = require('./friendFunctions.js');

// realtime firebase functions
const userDoc = (socket, user) => {
	db()
		.collection("users")
		.doc(user.email)
		.onSnapshot((snap) => {
			if (snap.exists) {
				socket.emit("userDoc", { data: snap.data() });
			} else {
				socket.emit("userDoc", { data: false });
			}
		});
};

const customersCol = (socket, user) => {
	db()
		.collection("users")
		.doc(user?.email)
		.collection("customers")
		.orderBy("lastActivity", "desc")
		.onSnapshot((snap) => {
			const cst = snap.docs.map((doc) => ({
				id: doc?.id,
				name: doc?.data()?.name,
				balance: doc?.data()?.balance,
				lastActivity: doc?.data()?.lastActivity,
			}));
			socket.emit("customersCol", { data: cst });
		});
};

const realtimeCustDoc = (socket, user, custId) => {
	db()
		.collection("users")
		.doc(user?.email)
		.collection("customers")
		.doc(custId)
		.onSnapshot((snap) => {
			if (snap.exists) {
				socket.emit("custDoc", { data: snap.data() });
			}
		});
};

const transactionsCol = (socket, user, custId) => {
	db()
		.collection("users")
		.doc(user?.email)
		.collection("customers")
		.doc(custId)
		.onSnapshot((snapshot) => {
			snapshot.ref
				.collection("transactions")
				.orderBy("timestamp", "desc")
				.onSnapshot(async (snap) => {
					const customerName = await snapshot.ref
						.get()
						.then((doc) => doc.data().name);
					let sent = 0,
						received = 0;
					const transactions = snap.docs.map((doc) => {
						doc.data().amount >= 0
							? (received += Number(doc.data().amount))
							: (sent -= Number(doc.data().amount));
						return {
							id: doc.id,
							amount: doc.data().amount,
							receipt: doc.data().receipt,
							timestamp: doc.data().timestamp,
							desc: doc.data().desc,
							by:
								doc.data().by === ""
									? "NA"
									: doc.data().by === user?.email
									? user?.name
									: customerName,
						};
					});					
					socket.emit("transactionsCol", {
						data: { transactions, sent, received },
					});
				});
		});
};

const functions = {
	dbUpdates: transactionFunctions.dbUpdates,
	uploadFile: transactionFunctions.uploadFile,
	createUser: userFunctions.createUser,
	updateUser: userFunctions.updateUser,
	addCustomer: friendFunctions.addCustomer,
	editCustomer: friendFunctions.editCustomer,
	getCustDoc: friendFunctions.getCustDoc,
	userDoc,
	customersCol,
	realtimeCustDoc,
	transactionsCol,
};

module.exports = functions;
