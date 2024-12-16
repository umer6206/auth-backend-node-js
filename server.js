import express from "express";
import cookieParser from "cookie-parser";
import globalErrorHandler from "./libs/globalErrorHandler.js";
const app = express();

app.use(express.json());
app.use(cookieParser());

// =========================== ALL Imports of Routes  ======================================
import { FirstRoute, UserRoute } from "./routes/index.routes.js";
import CustomError from "./libs/customErrorHandler.js";

// first route
app.use("/first", FirstRoute);
app.use("/user", UserRoute);
app.use("*", (req, res) => {
  throw new CustomError(`${req.url} not found`, 404);
});
// error handler
app.use(globalErrorHandler);

app.listen(4000, () => {
  console.log("Server started on port 4000");
  console.log("Link: http://localhost:4000");
});
