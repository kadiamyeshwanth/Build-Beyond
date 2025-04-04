const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const app = express();
const path = require("path");

// Configuration
const PORT = process.env.PORT || 3000;
const MONGODB_URI = "mongodb://localhost:27017";
const DB_NAME = "constructionPaymentsDB";

// Set up EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

// Payment Model
class Payment {
  constructor(data) {
    this.projectId = data.projectId;
    this.totalCost = data.totalCost;
    this.amountPaid = data.amountPaid;
    this.amountPending = data.amountPending || data.totalCost - data.amountPaid;
    this.paymentDate = new Date();
    this.updatedAt = new Date();
    this.status = this.amountPending === 0 ? "paid" : "pending";
  }
}

// Database Service
class PaymentDatabase {
  constructor() {
    this.client = new MongoClient(MONGODB_URI);
    this.db = null;
    this.payments = null;
  }

  async connect() {
    try {
      await this.client.connect();
      this.db = this.client.db(DB_NAME);
      this.payments = this.db.collection("payments");
      console.log("Connected to MongoDB");
    } catch (err) {
      console.error("Error connecting to MongoDB:", err);
      throw err;
    }
  }

  async getPaymentByProjectId(projectId) {
    return await this.payments.findOne({ projectId });
  }

  async createOrUpdatePayment(paymentData) {
    const existingPayment = await this.getPaymentByProjectId(
      paymentData.projectId
    );

    if (existingPayment) {
      const result = await this.payments.updateOne(
        { _id: existingPayment._id },
        {
          $set: {
            totalCost: paymentData.totalCost,
            amountPaid: paymentData.amountPaid,
            amountPending:
              paymentData.amountPending ||
              paymentData.totalCost - paymentData.amountPaid,
            updatedAt: new Date(),
            status:
              paymentData.amountPending === 0 ||
              paymentData.totalCost === paymentData.amountPaid
                ? "paid"
                : "pending",
          },
        }
      );
      return result.modifiedCount > 0;
    } else {
      const payment = new Payment(paymentData);
      const result = await this.payments.insertOne(payment);
      return result.insertedId;
    }
  }

  async seedSampleData() {
    try {
      await this.payments.deleteMany({});

      const samplePayments = [
        new Payment({
          projectId: "proj-1001",
          totalCost: 1250000,
          amountPaid: 650000,
          amountPending: 600000,
        }),
        new Payment({
          projectId: "proj-1002",
          totalCost: 850000,
          amountPaid: 850000,
          amountPending: 0,
        }),
        new Payment({
          projectId: "proj-1003",
          totalCost: 2200000,
          amountPaid: 500000,
          amountPending: 1700000,
        }),
      ];

      await this.payments.insertMany(samplePayments);
      console.log("Sample payment data seeded");
    } catch (err) {
      console.error("Error seeding payment data:", err);
    }
  }
}

// Payment Controller
class PaymentController {
  constructor(dbService) {
    this.db = dbService;
  }

  async renderPaymentForm(req, res) {
    try {
      // Default project ID - in a real app, this would come from URL params
      const projectId = req.query.projectId || "proj-1001";
      const paymentData = (await this.db.getPaymentByProjectId(projectId)) || {
        totalCost: 1250000,
        amountPaid: 650000,
        amountPending: 600000,
      };

      res.render("update-payments", {
        projectId,
        totalCost: paymentData.totalCost,
        amountPaid: paymentData.amountPaid,
        amountPending: paymentData.amountPending,
        status:
          paymentData.status ||
          (paymentData.amountPending === 0 ? "paid" : "pending"),
      });
    } catch (err) {
      console.error("Error rendering payment form:", err);
      res.status(500).send("Internal Server Error");
    }
  }

  async handlePaymentSubmission(req, res) {
    try {
      const { projectId, totalCost, amountPaid } = req.body;
      const amountPending = totalCost - amountPaid;

      await this.db.createOrUpdatePayment({
        projectId,
        totalCost: Number(totalCost),
        amountPaid: Number(amountPaid),
        amountPending: Number(amountPending),
      });

      res.redirect(`/payments?projectId=${projectId}&success=true`);
    } catch (err) {
      console.error("Error processing payment:", err);
      res.status(500).send("Internal Server Error");
    }
  }
}

// Initialize and start the application
async function initializeApp() {
  const dbService = new PaymentDatabase();
  await dbService.connect();
  await dbService.seedSampleData();

  const paymentController = new PaymentController(dbService);

  // Routes
  app.get("/payments", (req, res) =>
    paymentController.renderPaymentForm(req, res)
  );
  app.post("/submit-payment-info", (req, res) =>
    paymentController.handlePaymentSubmission(req, res)
  );

  // Start server
  app.listen(PORT, () => {
    console.log(`Payment server running on http://localhost:${PORT}/payments`);
  });
}

initializeApp().catch((err) => {
  console.error("Failed to initialize payment application:", err);
  process.exit(1);
});
