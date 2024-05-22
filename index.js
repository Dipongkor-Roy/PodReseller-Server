const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require('cors');
const PORT = process.env.PORT || 3000;

const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const jwt = require("jsonwebtoken");
require("dotenv").config(); // Load environment variables from .env file

const app = express();

// Enable CORS
app.use(cors());
app.use(express.json());
// Other middleware and routes..
// Use the PORT environment variable or default to 3000

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.8zviwwt.mongodb.net/?retryWrites=true&w=majority`;

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
    const productsCollection = client
      .db("PodResellerDB")
      .collection("products");
    const cartsCollection = client.db("PodResellerDB").collection("carts");
    const userCollection = client.db("PodResellerDB").collection("users");
    const paymentCollection = client.db("PodResellerDB").collection("payments");

    //jwt
    app.post("/jwt", async (req, res) => {
      // Generate JWT token based on user credentials
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token }); // Send token as an object
    });
    //verifytoken
    const verifyToken = (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "Forbidden Access" });
  }
  const token = req.headers.authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Forbidden Access" });
    }
    req.decoded = decoded;
    next();
  });
};
        // Middleware to verify admin role
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded?.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    }
    //Middleware to verify seller
    const verifySeller = async (req, res, next) => {
  try {
    const email = req.decoded?.email;
    const query = { email: email };
    const user = await userCollection.findOne(query);

    if (!user || !user.seller) {
      return res.status(403).send({ message: 'Forbidden access' });
    }

    next();
  } catch (error) {
    res.status(500).send({ message: 'Server error' });
  }
};
    
    //seller getting
   app.get("/users/seller/:email", verifyToken, async (req, res) => {
  const email = req.params.email;
  if (email !== req.decoded?.email) {
    return res.status(403).send({ message: "Unauthorized access" });
  }
  const query = { email: email };
  const user = await userCollection.findOne(query);
  const seller = user?.seller || false;
  res.send({ seller });
});

    app.get("/products", async (req, res) => {
      const query = {};
      const result = await productsCollection.find(query).toArray();
      res.send(result);
    });
    //find products via seller name
    app.get("/myProducts",verifyToken,verifySeller, async (req, res) => {
      const sellerName = req.query.sellerName;
      // Assuming the sellerName is provided in the query string
      const query = {
        seller_name: sellerName,
      }; // Constructing the query to filter by sellerName
      const result = await productsCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/products/:category", async (req, res) => {
      const category = req.params.category;
      try {
        const { products } = await productsCollection.find({ category });

        res.json(products);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
      }
    });
    //find product id wise
    app.get("/products/:id",verifyToken, async (req, res) => {
      const id = req.params.id;
      console.log(id)
      const filter = { _id: new ObjectId(id) };
      const prod = await productsCollection.find(filter).toArray();
      res.send(prod);
    });


    //add products
    app.post("/products",verifyToken,verifySeller, async (req, res) => {
      const item = req.body;
      const result = await productsCollection.insertOne(item);
      res.send(result);
    });
    //product get via id

    //updateProducts
    app.patch("/products/:id", async (req, res) => {
      const item = req.body;
      const id = req.params.id;

      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          name: item.name,
          resale_price: item.price,
          description: item.description,
          image: item.image,
        },
      };
      const result = await productsCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });
    //delete prodcut
    app.delete("/products/:id", verifyToken,async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productsCollection.deleteOne(query);
      res.send(result);
    });
    //add to cart api
    app.post("/carts", async (req, res) => {
      const item = req.body;
      const result = await cartsCollection.insertOne(item);
      res.send(result);
    });
    //get cart via email
    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      if (!email) {
        return res.send([]);
      }
      const query = { email: email };
      const result = await cartsCollection.find(query).toArray();
      res.send(result);
    });
    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartsCollection.deleteOne(query);
      res.send(result);
    });
    //users api
    app.get("/users", async (req, res) => {
      const query = {};
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });
    //user add
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User Already Exist", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });
    //user delete
    app.delete("/users/:id",verifyToken, verifyAdmin,async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });
    //admin related api
    app.get("/users/admin/:email",verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded?.email) {
        return res.status(403).send({ message: "unauthorized access" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });
    //user to admin
    app.patch("/users/admin/:id",verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    //payment
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
    
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ["card"],
        });
        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      } catch (error) {
        console.error("Error creating payment intent:", error);
        res.status(500).send({ error: "Internal Server Error" });
      }
    });
    
    app.post("/payments", async (req, res) => {
      const payment = req.body;
    
      try {
        const paymentResult = await paymentCollection.insertOne(payment);
        const query = {
          _id: {
            $in: payment.cartIds.map(id => new ObjectId(id)),
          },
        };
        const deleteResult = await cartsCollection.deleteMany(query);
        res.send({ paymentResult, deleteResult });
      } catch (error) {
        console.error("Error saving payment:", error);
        res.status(500).send({ error: "Internal Server Error" });
      }
    });
    
    app.get("/payments/:email", async (req, res) => {
      const query = { email: req.params.email };
      // Assuming you have a method to decode token and attach user email to req.decoded
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
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
  res.send("PodReseller Server Working");
});
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
