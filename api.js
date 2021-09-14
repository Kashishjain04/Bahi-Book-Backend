const express = require("express");
const pusher = require("./pusher.js");
const db = require("./firebase.js").firestore;
const functions = require("./functions");

// initialize Router
const router = express.Router();

router.post("/userDoc", (req, res) => {
  const { user } = req.body;
  if (!user) {
    return res.status(401).send("Invalid user");
  }
  const unsubscribe = db()
    .collection("users")
    .doc(user.email)
    .onSnapshot((snap) => {
      if (snap.exists) {
        pusher.trigger("userDoc", "update", { data: snap.data() });
      } else {
        pusher.trigger("userDoc", "update", { data: false });
      }
    });
  res.status(200).send("Request Successful");
  return unsubscribe;
});

router.post("/customersCol", (req, res) => {
  const { user } = req.body;
  if (!user) {
    return res.status(401).send("Invalid user");
  }
  const unsubscribe = db()
    .collection("users")
    .doc(user?.email)
    .collection("customers")
    .orderBy("lastActivity", "desc")
    .onSnapshot((snap) => {
      let cst = [];
      snap.forEach((doc) => {
        cst.push({
          id: doc?.id,
          name: doc?.data()?.name,
          balance: doc?.data()?.balance,
        });
      });
      pusher.trigger("customersCol", "update", { data: cst });
    });
  res.status(200).send("Request Successful");
  return unsubscribe;
});

router.post("/custDoc", (req, res) => {
  const { user, custId } = req.body;
  if (!user || !custId) {
    return res.status(401).send("Invalid details");
  }
  const unsubscribe = db()
    .collection("users")
    .doc(user?.email)
    .collection("customers")
    .doc(custId)
    .onSnapshot((snap) => {
      if (snap.exists) {
        pusher.trigger("custDoc", "update", { data: snap.data() });
      }
    });
  res.status(200).send("Request Successful");
  return unsubscribe;
});

router.post("/transactionsCol", async (req, res) => {
  const { user, custId } = req.body;
  if (!user) {
    return res.status(401).send("Invalid user");
  }
  const unsubscribe = db()
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
          let transactions = [],
            sent = 0,
            received = 0;
          snap.docs.forEach((doc) => {
            transactions.push({
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
            });
            doc.data().amount >= 0
              ? (received += Number(doc.data().amount))
              : (sent -= Number(doc.data().amount));
          });
          pusher.trigger("transactionsCol", "update", {
            data: { transactions, sent, received },
          });
        });
    });
  res.status(200).send("Request Successful");
  return unsubscribe;
});

router.post("/addCustomer", (req, res) => {
  const { id, name, user } = req.body;
  if (!id || !name || !user) {
    return res.status(400).send("Invalid data");
  }
  if (id === user.email) {
    return res.status(400).send("Invalid data");
  }
  db()
    .collection("users")
    .doc(user?.email)
    .collection("customers")
    .doc(id)
    .get()
    .then((doc) => {
      if (doc.exists) {
        return res.status(400).send("Customer already exists");
      } else {
        functions.addCustomer(res, user, id, name);
      }
    });
});

router.post("/addTransaction", (req, res) => {
  const {
    user,
    customerId,
    isGiving,
    amount,
    desc,
    url = "",
    fileType,
  } = req.body;
  if (!user || !customerId || isGiving === null || !amount) {
    return res.status(400).send("Invalid data");
  }
  const custRef = db()
      .collection("users")
      .doc(user?.email)
      .collection("customers")
      .doc(customerId),
    transRef = custRef.collection("transactions").doc(),
    selfRef = db()
      .collection("users")
      .doc(customerId)
      .collection("customers")
      .doc(user.email),
    selfTransRef = selfRef.collection("transactions").doc(transRef.id);

  if (url === "") {
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

module.exports = router;
