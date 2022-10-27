const db = require("../firebase.js").firestore;

const createUser = (user, res) => {
	db()
		.collection("users")
		.doc(user.email)
		.set({ name: user.name, picture: user.picture }, { merge: true })
		.then(() => res.status(200).send("User registered successfully"))
		.catch(() => res.status(500).send("An error occurred"));
};

const updateUser = (user, res) => {
	db()
		.collection("users")
		.doc(user.email)
		.update({
			name: user.name,
			picture: user.image,
			[user.tokenType]: db.FieldValue.arrayUnion(user.token),
		})
		.then(() => res.status(200).send("User updated successfully"))
		.catch(() => res.status(500).send({ error: "An error occurred" }));
};

const userFunctions = {
    createUser,
    updateUser,
};

module.exports = userFunctions;