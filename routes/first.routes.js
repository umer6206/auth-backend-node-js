import { Router } from "express";
import CustomError from "../Errors/customErrorHandler.js";
const router = Router({ mergeParams: true });

const timeLog = (req, res, next) => {
  console.log("Time : ", Date.now());
  next();
};

const Logger = (req, res, next) => {
  console.log("Logger");
  next();
};

const requestTime = function (req, res, next) {
  req.requestTime = Date.now();
  next();
};

async function cookieValidator(cookies) {
  console.log(cookies);
  // Simulated validation function
  if (!cookies.testCookie) {
    throw new Error("Invalid cookies");
  }
}

async function validateCookies(req, res, next) {
  try {
    await cookieValidator(req.cookies);
    next();
  } catch (error) {
    next(error); // Pass the error to the error-handling middleware
  }
}

// router.use(timeLog);
// router.use(Logger);
router.use(requestTime);
// router.use(validateCookies);

// Define the home page route
router.get("/", async (req, res, next) => {
  try {
    throw new CustomError("Invalid user", 404);
  } catch (error) {
    next(error);
  }
});

// Define the about route
router.get("/about", (req, res) => {
  res.send("About birds");
});

// Error handler middleware
// router.use((err, req, res, next) => {
//   res.status(400).send(err.message); // Send error message as response
// });

export default router;
