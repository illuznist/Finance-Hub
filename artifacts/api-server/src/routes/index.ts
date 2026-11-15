import { Router, type IRouter } from "express";
import healthRouter from "./health";
import accountRouter from "./account";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/account", accountRouter);
router.use("/admin", adminRouter);

export default router;
