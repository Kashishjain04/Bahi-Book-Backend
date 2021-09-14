const db = require("./firebase.js").firestore;
const storage = require("./firebase.js").storage;
const stream = require("stream");

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
    .pipe(file.createWriteStream({ metadata: { contentType: fileType } }))
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
      .update({ received: db.FieldValue.increment(Math.abs(amt)) });
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
      res.status(200).send("Request Successful");
    })
    .catch((err) => console.log(err));
};

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
    .doc(user?.email)
    .update({
      customers: { [id]: name },
    });

  // Create customer's doc if not exist
  db()
    .collection("users")
    .doc(id)
    .set({ customers: { [user.email]: user.name } }, { merge: true });

  // Add user to customer's customers collection
  db()
    .collection("users")
    .doc(id)
    .collection("customers")
    .doc(user?.email)
    .set({ name: user?.name, balance: 0, lastActivity })
    .then(() => res.status(200).send("Request Successful"))
    .catch((err) => console.log(err.message));
};

const functions = { dbUpdates, uploadFile, addCustomer };

module.exports = functions;
