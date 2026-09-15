import fs from "fs";
import { prisma } from "./lib/prisma.js"; // Just checking if I need it here, but I don't.
import express from "express"
import morgan from "morgan";
import helmet from "helmet";
import cors, { CorsOptions } from "cors";
import compression from "compression";
import { rateLimiter } from "./middlewares/rateLimiter.js";
import { Response, Request, NextFunction } from "express";
import cookieParser from "cookie-parser";
import i18next from "i18next";
import Backend from "i18next-fs-backend";
import path from "path";
import * as middleware from "i18next-http-middleware";

import authRoute from "./routes/v1/authRoute.js";
import adminRoute from "./routes/v1/admin/adminRoute.js";
import userRoute from "./routes/v1/user/userRoute.js";
import { proxy } from "./middlewares/proxy.js";
import { authorize } from "./middlewares/authorize.js";
import cron from "node-cron";
import { maintenance } from "./middlewares/maintenance.js";
import { createOrUpdateSetting, getSettingStatus } from "./services/setting.js";
import { ResponseError } from "./utils/responseError.js";

const app = express();

const allowedOrigins: string[] = [
  "http://example1.com",
  "http://localhost:5173",
  // 'https://your-production-frontend.com',  ← ဒါကို ထည့်ပါ
  // process.env.FRONTEND_URL || 'http://localhost:5173'  ← env ကနေ ယူချင်ရင် ဒီလို
];

const corsOptions: CorsOptions = {
  origin: allowedOrigins,
  credentials: true, // cookies, Authorization header တွေ ခွင့်ပြု (မင်း auth သုံးနေရင် လိုတယ်)
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"], // လိုအပ်တဲ့ methods တွေ
  allowedHeaders: ["Content-Type", "Authorization"], // လိုအပ်တဲ့ headers
  exposedHeaders: ["Set-Cookie"], // optional: cookie တွေ ပြန်ပြချင်ရင်
  maxAge: 86400, // preflight OPTIONS request ကို ၂၄ နာရီ cache လုပ်ထား
  optionsSuccessStatus: 200, // legacy browsers (IE) အတွက်
};
app.use((req,res,next)=> {
res.setHeader("Cross-Origin-Resource-Policy", "same-site");
next()
})
app.use("/images", express.static("uploads/images"));
app.use("/uploads/optimize", express.static("uploads/optimize"));

app.use(morgan("dev"));
app.use(helmet());
app.use(
  compression({
    level: 3,
    threshold: 2048, //2KB
  }),
);
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

i18next
  .use(Backend)
  .use(middleware.LanguageDetector)
  .init({
    backend: {
      loadPath: path.join(
        process.cwd(),
        "src/locales",
        "{{lng}}",
        "{{ns}}.json",
      ),
    },
    detection: {
      order: ["querystring", "cookie"],
      caches: ["cookie"],
    },
    fallbackLng: "en",
    preload: ["en", "mm"],
  });
app.use(middleware.handle(i18next));
//middleware
app.use(rateLimiter);

//route
app.use("/api/v1", authRoute);
app.use("/api/v1/user", userRoute);
app.use("/api/v1/admin", proxy, authorize(true, "ADMIN"), adminRoute);

// app.use("/api/v1",maintenance, authRoute);
// app.use("/api/v1/user", maintenance, userRoute);
// app.use("/api/v1/admin", proxy, authorize(true, "ADMIN"), adminRoute);

//error handling middleware
// app.use((err: any, req: Request, res: Response, next: NextFunction) => {
//   const status = err.status || 500;
//   const message = err.message || "Something went wrong";
//   const code = err.code || "INTERNAL_SERVER_ERROR";
//   res.status(status).json({ message, code });
// });

// * * * * *
// │ │ │ │ │
// │ │ │ │ └── Day of week (0 - 7)
// │ │ │ └──── Month (1 - 12)
// │ │ └────── Day of month (1 - 31)
// │ └──────── Hour (0 - 23)
// └────────── Minute (0 - 59)

//this is for localization showing middleware
// app.use((err: any, req: Request, res: Response, next: NextFunction) => {
//   const status = err.status || 500;
//   const code = err.code || "INTERNAL_SERVER_ERROR";
     
//    const message = err.messageKey
//     ? req.t(err.messageKey)
//     : req.t("internal_server_error");

//   res.status(status).json({ message, code });
// });
app.use((err: any, req: Request, res: Response, next: NextFunction) => {

  console.error(err); // debug

  const status = err.status || 500;
  const code = err.code || "INTERNAL_SERVER_ERROR";

  const message =
    err.messageKey
      ? req.t(err.messageKey)
      : err.message || req.t("internal_server_error");

  res.status(status).json({
    message,
    code,
  });

});
// cron.schedule("* 1 * 3 0", async () => {
//   console.log("running a task every minute");
//   const setting = await getSettingStatus("maintenance");

//   if (setting?.value === "true") {
//     await createOrUpdateSetting("maintenance", "false");
//     console.log("Maintenance mode is off");
//   }
// });


export default app;
