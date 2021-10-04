const db = require('./firebase.js').firestore;
const storage = require('./firebase.js').storage;
const stream = require('stream');

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
	bufferStream.end(new Buffer.from(base64.split('base64,')[1], 'base64'));
	const storageRef = storage().bucket('bahi-book.appspot.com');
	const file = storageRef.file(`receipts/${transRef.id}`);
	bufferStream
		.pipe(
			file.createWriteStream({
				metadata: { contentType: fileType || 'image/*' },
			})
		)
		.on('error', () => {
			res.status(500).send('Error Uploading File');
		})
		.on('finish', (fileRet) => {
			// The file upload is complete.
			console.log(fileRet);
			file?.getSignedUrl(
				{ action: 'read', expires: '01-01-2500' },
				(err, signedUrl) => {
					if (err) {
						res.status(500).send('Error Uploading File');
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
	url = ''
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
			.collection('users')
			.doc(user?.email)
			.update({ sent: db.FieldValue.increment(Math.abs(amt)) });
		// Updating customer's received amount
		db()
			.collection('users')
			.doc(customerId)
			.update({ received: db.FieldValue.increment(Math.abs(amt)) });
	} else {
		// Updating self received amount
		db()
			.collection('users')
			.doc(user.email)
			.update({ received: db.FieldValue.increment(Math.abs(amt)) });
		// Updating customer's sent amount
		db()
			.collection('users')
			.doc(customerId)
			.update({ sent: db.FieldValue.increment(Math.abs(amt)) });
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
			res.status(200).send({ message: 'Request Successful' });
		})
		.catch((err) => console.log(err));
};

const addCustomer = (res, user, id, name) => {
	const lastActivity = db.FieldValue.serverTimestamp();

	// Add customer to user's customers collection
	db()
		.collection('users')
		.doc(user?.email)
		.collection('customers')
		.doc(id)
		.set({ name, balance: 0, lastActivity });

	// Create customer's doc if not exist
	db()
		.collection('users')
		.doc(id)
		.set({ customers: { [user.email]: user.name } }, { merge: true });

	// Add user to customer's customers collection
	db()
		.collection('users')
		.doc(id)
		.collection('customers')
		.doc(user?.email)
		.set({ name: user?.name, balance: 0, lastActivity })
		.then(() => res.status(200).send({ message: 'Request Successful' }))
		.catch(() => res.status(500).send({ error: 'Invalid Error' }));
};

const createUser = (user, res) => {
	db()
		.collection('users')
		.doc(user.email)
		.set({ name: user.name, picture: user.picture }, { merge: true })
		.then(() => res.status(200).send('User registered successfully'))
		.catch(() => res.status(500).send('An error occurred'));
};

const updateUser = (user, res) => {
	db()
		.collection('users')
		.doc(user.email)
		.update({ name: user.name, picture: user.picture })
		.then(() => res.status(200).send('User updated successfully'))
		.catch(() => res.status(500).send({ error: 'An error occurred' }));
};

const editCustomer = (res, user, custId, name) => {
	db()
		.collection('users')
		.doc(user?.email)
		.collection('customers')
		.doc(custId)
		.update({ name })
		.then(() =>
			res.status(200).send({ message: 'Customer edited successfully' })
		)
		.catch((err) =>
			res.status(500).send({ error: err.message || 'Invalid Error' })
		);
};

// realtime firebase functions
const userDoc = (socket, user) => {
	db()
		.collection('users')
		.doc(user.email)
		.onSnapshot((snap) => {
			if (snap.exists) {
				socket.emit('userDoc', { data: snap.data() });
			} else {
				socket.emit('userDoc', { data: false });
			}
		});
};

const customersCol = (socket, user) => {
	db()
		.collection('users')
		.doc(user?.email)
		.collection('customers')
		.orderBy('lastActivity', 'desc')
		.onSnapshot((snap) => {
			const cst = snap.docs.map((doc) => ({
				id: doc?.id,
				name: doc?.data()?.name,
				balance: doc?.data()?.balance,
			}));
			socket.emit('customersCol', { data: cst });
		});
};

const custDoc = (socket, user, custId) => {
	db()
		.collection('users')
		.doc(user?.email)
		.collection('customers')
		.doc(custId)
		.onSnapshot((snap) => {
			if (snap.exists) {
				socket.emit('custDoc', { data: snap.data() });
			}
		});
};

const transactionsCol = (socket, user, custId) => {
	db()
		.collection('users')
		.doc(user?.email)
		.collection('customers')
		.doc(custId)
		.onSnapshot((snapshot) => {
			snapshot.ref
				.collection('transactions')
				.orderBy('timestamp', 'desc')
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
								doc.data().by === ''
									? 'NA'
									: doc.data().by === user?.email
									? user?.name
									: customerName,
						};
					});
					// snap.docs.forEach((doc) => {
					// 	transactions.push({
					// 		id: doc.id,
					// 		amount: doc.data().amount,
					// 		receipt: doc.data().receipt,
					// 		timestamp: doc.data().timestamp,
					// 		desc: doc.data().desc,
					// 		by:
					// 			doc.data().by === ''
					// 				? 'NA'
					// 				: doc.data().by === user?.email
					// 				? user?.name
					// 				: customerName,
					// 	});
					// 	doc.data().amount >= 0
					// 		? (received += Number(doc.data().amount))
					// 		: (sent -= Number(doc.data().amount));
					// });
					socket.emit('transactionsCol', {
						data: { transactions, sent, received },
					});
				});
		});
};

const functions = {
	dbUpdates,
	uploadFile,
	addCustomer,
	userDoc,
	customersCol,
	custDoc,
	transactionsCol,
	createUser,
	updateUser,
	editCustomer,
};

module.exports = functions;
