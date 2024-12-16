// import {createUser} from "../controllers/users.js"
import { Router } from "express";
import { asyncErrorHandler } from "../libs/AsyncErrorHandler.js";

const router = Router();
router.post(
  "/",
  asyncErrorHandler(async (req, res) => {
    // createUser(req,res)
    res.status(201).json({ message: "User created successfully" });
  })
);

export default router;
