const express = require('express');
// const pusher = require("./pusher.js");
const db = require('./firebase.js').firestore;
const functions = require('./functions');
const http = require('http');
const { Server } = require('socket.io');

// initialize app
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
	cors: { origin: '*', methods: ['GET', 'POST'] },
});

// initialize Router
const router = express.Router();

// listen to socket events
io.on('connection', (socket) => {
	socket.on('disconnect', () => {
		// console.log("user disconnected");
	});

	socket.on('userDoc', async ({ user }, callback) => {
		if (!user) {
			return callback('Invalid user');
		}
		functions.userDoc(socket, user);
	});

	socket.on('customersCol', async ({ user }, callback) => {
		if (!user) {
			return callback('Invalid user');
		}
		functions.customersCol(socket, user);
	});

	socket.on('custDoc', async ({ user, custId }, callback) => {
		if (!user || !custId) {
			return callback('Invalid user');
		}
		functions.custDoc(socket, user, custId);
	});

	socket.on('transactionsCol', async ({ user, custId }, callback) => {
		if (!user || !custId) {
			return callback('Invalid user');
		}
		functions.transactionsCol(socket, user, custId);
	});
});

router.post('/createUser', (req, res) => {
	const { user } = req.body;
	if (!user) {
		return res.status(400).send('Invalid user');
	}
	functions.createUser(user, res);
});

router.post('/addCustomer', (req, res) => {
	const { id, name, user } = req.body;
	if (!id || !name || !user) {
		return res.status(400).send('Invalid data');
	}
	if (id === user.email) {
		return res.status(400).send('Invalid data');
	}
	db()
		.collection('users')
		.doc(user?.email)
		.collection('customers')
		.doc(id)
		.get()
		.then((doc) => {
			if (doc.exists) {
				return res.status(500).send({ error: 'Customer already exists' });
			} else {
				functions.addCustomer(res, user, id, name);
			}
		});
});

router.post('/editCustomer', (req, res) => {
	const {custId, name, user} = req.body;
	if(!custId || !name || !user) {
		return res.status(400).send('Invalid data');
	}
	functions.editCustomer(res, user, custId, name);
})

router.post('/addTransaction', (req, res) => {
	const {
		user,
		customerId,
		isGiving,
		amount,
		desc,
		url = '',
		fileType,
	} = req.body;
	if (!user || !customerId || isGiving === null || !amount) {
		return res.status(400).send('Invalid data');
	}
	const custRef = db()
			.collection('users')
			.doc(user?.email)
			.collection('customers')
			.doc(customerId),
		transRef = custRef.collection('transactions').doc(),
		selfRef = db()
			.collection('users')
			.doc(customerId)
			.collection('customers')
			.doc(user.email),
		selfTransRef = selfRef.collection('transactions').doc(transRef.id);

	if (url === '') {
		functions.dbUpdates(
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
			url
		);
	} else
		functions.uploadFile(
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
			url
		);
});

module.exports = { app, router, server };
