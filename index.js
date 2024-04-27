const { MongoClient, ServerApiVersion } = require("mongodb");
const express = require("express");
const cors = require("cors");
const PORT = process.env.PORT || 3000;
require("dotenv").config(); // Load environment variables from .env file

const app = express();

// Enable CORS
app.use(cors());
app.use(express.json());
// Other middleware and routes...
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
    app.get("/products", async (req, res) => {
      const query = {};
      const result = await productsCollection.find(query).toArray();
      console.log(result);
      res.send(result);
    });
    app.get("/products/:category", async (req, res) => {
      const category = req.params.category;
      try {
        const products = await productsCollection.find({ category });
        res.json(products);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
      }
    });
    //add to cart api
    app.post("/carts", async (req, res) => {
      const item = req.body;
      const result = await cartsCollection.insertOne(item);
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
