const express = require("express");
const app = express();
const PORT = 4000;
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const path = require("path");
const mongoose = require("mongoose");
const router = express.Router();
// Multer
const multer = require("multer");
const fs = require("fs");
const bcrypt=require("bcrypt");
const { Customer, Company, Worker, ArchitectHiring,ConstructionProjectSchema } = require("./Models.js");
const jwt = require("jsonwebtoken");

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.json());
app.use(express.static("Final Pages"));
app.use(cors({
  origin: true,
  credentials: true 
}));
// JWT Authentication Middleware
const isAuthenticated = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res.redirect('/signin_up.html'); // Redirect to login if no token
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'cec1dc25cec256e194e609ba68d0e62b7554e7b664468a99d8ca788e0b657ec7');
    req.user = decoded;
    next();
  } catch (error) {
    console.error('JWT verification error:', error);
    res.clearCookie('token');
    return res.redirect('/signin_up.html');
  }
};
// Landing Route
app.get("/", (req, res) => {
  res.render("landing_page");
});
app.get("/signin_up.html", (req, res) => {
  res.render("signin_up_");
});
app.get("/adminpage.html", (req, res) => {
  res.render("adminlogin");
});
// Worker Routes
app.get("/workerdashboard.html", (req, res) => {
  res.render("worker/worker_dashboard");
});
app.get("/workerjobs.html", (req, res) => {
  res.render("worker/worker_jobs");
});
app.get("/workerjoin_company.html",isAuthenticated, async (req, res) => {
  const user=await Worker.findById(req.user.user_id);
  res.render("worker/workers_join_company",{user});
});
app.get("/workersettings.html", isAuthenticated,async (req, res) => {
  const user=await Worker.findById(req.user.user_id);
  res.render("worker/worker_settings",{user});
});
// Logout Route
app.get("/logout", (req, res) => {
  res.render("signin_up_");
});
// Serve Static Files
app.use(express.static("Final Pages"));
app.get("/companydashboard.html", (req, res) => {
  res.render("company/company_dashboard");
});

app.get("/customerdashboard.html", (req, res) => {
  res.render("customer/customer_dashboard");
});

app.get("/workerdashboard.html", (req, res) => {
  res.render("worker/worker_dashboard");
});

app.get("/admindashboard.html", (req, res) => {
  res.render("admin/admin_dashboard");
});

app.get("/platformadmindashboard.html", (req, res) => {
  res.render("platform_admin/platform_admin_dashboard");
});

// Customer Routes 
app.get("/home.html", (req, res) => {
  res.render("customer/customer_dashboard");
});
app.get("/construction_comanies_list.html", (req, res) => {
  res.render("customer/construction_companies_list");
});
app.get("/construction_companies_profile.html", (req, res) => {
  res.render("customer/construction_companies_profile");
});
app.get("/architect.html", (req, res) => {
  res.render("customer/architect");
});
app.get("/interior_designer.html", (req, res) => {
  res.render("customer/interior_design");
});
app.get("/ongoing_projects.html", (req, res) => {
  res.render("customer/ongoing_projects");
});
app.get("/bidspace.html", (req, res) => {
  res.render("customer/bid_space");
});
app.get("/design_ideas.html", (req, res) => {
  res.render("customer/design_ideas");
});
app.get("/architecht_form.html", (req, res) => {
  res.render("customer/architect_form");
});

app.get("/interiordesign_form.html", (req, res) => {
  res.render("customer/interiordesign_form");
});
app.get("/constructionform.html", (req, res) => {
  res.render("customer/construction_form");
});
app.get("/bidform.html", (req, res) => {
  res.render("customer/bid_form");
});
app.get("/customersettings.html", (req, res) => {
  res.render("customer/customer_settings");
});
// Company routes
app.get("/companybids.html", (req, res) => {
  res.render("company/company_bids");
});
app.get("/companyongoing_projects.html", (req, res) => {
  res.render("company/company_ongoing_projects");
});
app.get("/companyclients.html", (req, res) => {
  res.render("company/clients");
});
app.get("/companyrevenue.html", (req, res) => {
  res.render("company/revenue");
});
app.get("/companyhiring.html", (req, res) => {
  res.render("company/hiring");
});
app.get("/companysettings.html", async(req, res) => {
  const user=await Company.findById(req.user.user_id);
  res.render("company/company_settings", { user });
});
app.get("/revenue_form.html", (req, res) => {
  res.render("company/revenue_form");
});

app.get("/addnewproject_form.html", (req, res) => {
  res.render("company/addnewproject_form");
});

app.get("/worker_edit", (req, res) => {
  res.render("worker/worker_profile_edit");
});

module.exports = {
  express,
  app,
  PORT,
  bodyParser,
  cookieParser,
  cors,
  path,
  mongoose,
  router,
  multer,
  fs,
  bcrypt,
  jwt
};

// Start Server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});