const express = require("express");
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);

// middleware
const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }

  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.tgrk550.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // await client.connect();
    const usersCollection = client.db("soulBlissDB").collection("users");
    const classCollection = client.db("soulBlissDB").collection("classes");
    const selectedCollection = client.db("soulBlissDB").collection("selected");
    const paymentsCollection = client.db("soulBlissDB").collection("enrolled");

    // generate jwt token
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "7d",
      });
      res.send({ token });
    });

    // warning : use verifyJWT before using verifyAdmin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };

    // // warning : use verifyJWT before using verifyInstructor
    // const verifyInstructor = async (req, res, next) => {
    //   const email = req.decoded.email;
    //   const query = { email: email };
    //   const user = await usersCollection.findOne(query);
    //   if (user?.role !== "instructor") {
    //     return res
    //       .status(403)
    //       .send({ error: true, message: "forbidden message" });
    //   }
    //   next();
    // };

    /*---------------------------
          User Related APIs
     ----------------------------*/

    // get all users
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // post users to database
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exist" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // check user admin or not
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        return res.send({ admin: false });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    // get all instructor
    app.get("/users/instructors/all", async (req, res) => {
      const query = { role: "instructor" };
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });

    // check user instructor or not
    app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        return res.send({ instructor: false });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === "instructor" };
      res.send(result);
    });

    // make user role to admin API
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // make user role to instructor API
    app.patch("/users/instructor/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "instructor",
        },
      };
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // delete a user
    app.delete("/users/delete/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(filter);
      res.send(result);
    });

    /*---------------------------
          class Related APIs
     ----------------------------*/

    app.post("/classes", async (req, res) => {
      const newItem = req.body;
      const result = await classCollection.insertOne(newItem);
      res.send(result);
    });

    app.get("/classes", async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    });

    // get specific instructor class
    app.get("/classes/:email", verifyJWT, async (req, res) => {
      const decodedEmail = req.decoded.email;
      const email = req.params.email;

      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "Forbidden Access" });
      }
      const query = { email: email };
      const result = await classCollection.find(query).toArray();

      res.send(result);
    });

    // get all approved class
    app.get("/classes/approved/all", async (req, res) => {
      const query = { status: "approved" };
      const result = await classCollection.find(query).toArray();
      res.send(result);
    });

    // set selected class
    // app.post("/selected", async (req, res) => {
    //   const selectedClass = req.body;
    //   const result = await selectedCollection.insertOne(selectedClass);
    //   res.send(result);
    // });

    // save a selected class in db
    app.post("/selected", async (req, res) => {
      const selectedClass = req.body;

      // Check if the class is already selected by the user
      const existingSelection = await selectedCollection.findOne(selectedClass);

      if (existingSelection) {
        // If the class is already selected, send an error response
        // res.status(400).json({ error: "Class already selected by the user" });
        return res.status(400).send({ exist: true });
      } else {
        // If the class is not yet selected, insert it into the collection
        const result = await selectedCollection.insertOne(selectedClass);
        res.send(result);
      }
    });

    // delete a selected class
    app.delete("/selected/delete/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await selectedCollection.deleteOne(filter);
      res.send(result);
    });

    // get specific user selected class
    app.get("/selected/:email", verifyJWT, async (req, res) => {
      const decodedEmail = req.decoded.email;
      const email = req.params.email;

      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "Forbidden Access" });
      }
      const query = { buyer_email: email };
      const result = await selectedCollection.find(query).toArray();

      res.send(result);
    });

    // generate client secret
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      if (price) {
        const amount = parseFloat(price) * 100;
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ["card"],
        });
        res.send({ clientSecret: paymentIntent.client_secret });
      }
    });

    // // Save a enrolled in database
    // app.post("/payments", verifyJWT, async (req, res) => {
    //   const payment = req.body;
    //   const query = {
    //     selectedId: payment?.selectedId,
    //     buyer_email: payment?.buyer_email,
    //   };
    //   const exist = await paymentsCollection.findOne(query);
    //   if (exist) {
    //     return res.send({ exist: true });
    //   }

    //   const addPayment = await paymentsCollection.insertOne(payment);

    //   res.send(addPayment);
    // });

    // Save a payment in the database and remove the selected class
    app.post("/payments", verifyJWT, async (req, res) => {
      const payment = req.body;
      const query = {
        selectedId: payment?.selectedId,
        buyer_email: payment?.buyer_email,
      };

      try {
        const exist = await paymentsCollection.findOne(query);
        if (exist) {
          return res.send({ exist: true });
        }

        // Remove the selected class
        const deleteResult = await selectedCollection.findOneAndDelete(query);

        if (deleteResult.value) {
          // Selected class successfully removed
          const addPayment = await paymentsCollection.insertOne(payment);
          res.send(addPayment);
        } else {
          // Selected class not found or not removed
          res.status(404).send({ error: "Selected class not found" });
        }
      } catch (error) {
        res
          .status(500)
          .send({ error: "An error occurred while processing the payment" });
      }
    });

    // TODO:
    // get specific user selected class
    app.get("/enrolled/:email", verifyJWT, async (req, res) => {
      const decodedEmail = req.decoded.email;
      const email = req.params.email;

      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "Forbidden Access" });
      }
      const query = { buyer_email: email };
      const result = await paymentsCollection.find(query).toArray();

      res.send(result);
    });

    //read single class data
    app.get("/selected/single/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectedCollection.findOne(query);
      res.send(result);
    });

    //set approved class
    app.patch("/classes/approved/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: "approved",
        },
      };
      const result = await classCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    //set denied class
    app.patch("/classes/denied/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: "denied",
        },
      };
      const result = await classCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    //read single class data
    app.get("/classes/single/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classCollection.findOne(query);
      res.send(result);
    });

    //set feedback class
    app.patch("/classes/feedback/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };

      const updatedFeedback = req.body;
      const updatedDoc = {
        $set: {
          feedback: updatedFeedback.feedback,
        },
      };
      const result = await classCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    /*---------------------------
          Instructor Related APIs
     ----------------------------*/

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("SoulBliss Server is running..");
});

app.listen(port, () => {
  console.log(`SoulBliss is running on port ${port}`);
});
