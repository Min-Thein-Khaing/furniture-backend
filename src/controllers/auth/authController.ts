import bcrypt from "bcrypt";
import { NextFunction, Request, Response } from "express";
import dayjs from "dayjs";
import jwt from "jsonwebtoken";
import {
  createOtp,
  createUser,
  getNumberId,
  getNumberPhone,
  getNumberPhoneOtp,
  updateOtp,
  updateUser,
} from "../../services/auth.js";
import {
  checkErrorIfSameDate,
  checkOtpRow,
  checkUserErrorIfSameDate,
  checkUserExist,
  checkUserNotExist,
} from "../../utils/userExist.js";
import { generateOtp, generateToken } from "../../utils/generateOtp.js";
import { validationFunction } from "../../utils/validationFunction.js";
import { ResponseError } from "../../utils/responseError.js";

export const registerController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (validationFunction(req, res, next)) return;
  let { phone } = req.body;
  if (phone.slice(0, 2) == "09") {
    phone = phone.substring(2, phone.length);
  }
  const opt = "123456";
  // const opt = generateOtp();
  const salt = await bcrypt.genSalt(10);
  const hashOtp = await bcrypt.hash(opt, salt);
  const token = generateToken();

  let user = await getNumberPhone(phone);
  checkUserExist(user);
  const optRow = await getNumberPhoneOtp(phone);
  if (!optRow) {
    const dataOfOtp = {
      phone,
      otp: hashOtp,
      rememberToken: token,
      count: 1,
    };
    const result = await createOtp(dataOfOtp);
  } else {
    const latestUpdateDate = new Date(optRow.updatedAt)
      .toISOString()
      .split("T")[0];
    const currentDate = new Date().toISOString().split("T")[0];
    const isSameDate = latestUpdateDate === currentDate;
    checkErrorIfSameDate(isSameDate, optRow.error);
    if (!isSameDate) {
      const dataOfOtp = {
        otp: hashOtp,
        rememberToken: token,
        count: 1,
        error: 0,
      };
      const result = await updateOtp(optRow.id, dataOfOtp);
    } else {
      if (optRow.count === 3) {
        // const error: any = new Error("error limit Count.Try again Tomorrow");
        // error.status = 405;
        // error.code = "error not found";
        // throw error;
        throw new ResponseError(
          "error limit Count.Try again Tomorrow",
          405,
          "error not found",
        );
      } else {
        const dataOfOtp = {
          otp: hashOtp,
          rememberToken: token,
          count: { increment: 1 },
        };
        const result = await updateOtp(optRow.id, dataOfOtp);
      }
    }
  }

  return res.status(201).json({
    message: "User created successfully",
    data: {
      phone: phone,
      rememberToken: token,
      otp: opt,
    },
  });
};
export const verifyOtpController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (validationFunction(req, res, next)) return;
  let { phone, otp, rememberToken } = req.body;
  const user = await getNumberPhone(phone);
  checkUserExist(user);
  const otpRow = await getNumberPhoneOtp(phone);
  checkOtpRow(otpRow);
  const latestUpdateDate = new Date(otpRow!.updatedAt).toLocaleDateString();
  const currentDate = new Date().toLocaleDateString();
  const isSameDate = latestUpdateDate === currentDate;
  checkErrorIfSameDate(isSameDate, otpRow!.error);
  if (otpRow?.rememberToken !== rememberToken) {
    const optErrorCount = {
      error: 5,
    };
    await updateOtp(otpRow!.id, optErrorCount);
    throw new ResponseError("rememberToken not found", 400, "error not found");
  }
  //otp expires
  const isExpired = dayjs().isAfter(dayjs(otpRow!.updatedAt).add(2, "minute"));
  if (isExpired) {
    throw new ResponseError("otp expired", 403, "error not found");
  }
  const isMatchOtp = await bcrypt.compare(otp, otpRow!.otp);
  if (!isMatchOtp) {
    if (!isSameDate) {
      const optErrorCount = {
        error: 1,
      };
      await updateOtp(otpRow!.id, optErrorCount);
    } else {
      const optErrorCount = {
        error: { increment: 1 },
      };
      await updateOtp(otpRow!.id, optErrorCount);
    }
    throw new ResponseError("otp not match", 400, "error not found");
  }
  const verifyToken = generateToken();
  const dataOfOtp = {
    verifyToken,
    error: 0,
    count: 1,
  };
  const result = await updateOtp(otpRow!.id, dataOfOtp);
  return res.status(201).json({
    message: "User created successfully",
    data: {
      phone: result.phone,
      otp: otp,
      verifyToken: result.verifyToken,
    },
  });
};

export const confirmPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (validationFunction(req, res, next)) return;
  const { firstName,lastName, phone, password, rememberToken } = req.body;
  const user = await getNumberPhone(phone);
  checkUserExist(user);
  const otpRow = await getNumberPhoneOtp(phone);
  checkOtpRow(otpRow);
  if (otpRow?.error === 5) {
    const error: any = new Error("error limit Count.Try again Tomorrow");
    error.status = 400;
    error.code = "error not found";
    throw error;
  }

  if (otpRow!.verifyToken !== rememberToken) {
    const optErrorCount = {
      error: 5,
    };
    await updateOtp(otpRow!.id, optErrorCount);
    throw new ResponseError("rememberToken not found", 400, "error not found");
  }
  const isExpired = dayjs().isAfter(dayjs(otpRow!.updatedAt).add(5, "minutes"));
  if (isExpired) {
    throw new ResponseError("otp expired", 403, "error not found");
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  const randToken = "I will replace Refresh Token here";

  const dataOfUser = {
    firstName,
    lastName,
    phone,
    password: hashedPassword,
    randToken,
  };
  const newUser = await createUser(dataOfUser);

  const accessTokenPayload = { id: newUser.id };
  const refreshTokenPayload = { id: newUser.id, phone: newUser.phone };
  const accessToken = jwt.sign(
    accessTokenPayload,
    process.env.ACCESS_TOKEN_SECRET!,
    {
      expiresIn: "15m",
    },
  );
  const refreshToken = jwt.sign(
    refreshTokenPayload,
    process.env.REFRESH_TOKEN_SECRET!,
    {
      expiresIn: "30d",
    },
  );

  const userUpdateData = {
    randToken: refreshToken,
  };
  await updateUser(userUpdateData, newUser.id);

  return res
    .cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: "/",
    })
    .cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: "/",
    })
    .status(200)
    .json({
      message: "User created successfully",
      data: {
        userId: newUser.id,
        newUser:{
          omit:password
        }
      },
    });
};
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (validationFunction(req, res, next)) return;

  let { phone, password } = req.body;

  if (phone.startsWith("09")) {
    phone = phone.substring(2);
  }

  const user = await getNumberPhone(phone);
  if (!user) {
    throw new ResponseError("User does not exist", 400, "user_not_found");
  }

  if (user.status === "FREEZED") {
    throw new ResponseError(
      "Your account is temporarily frozen. Please contact support.",
      403,
      "account_frozen",
    );
  }

  const isPasswordCorrect = await bcrypt.compare(password, user.password);

  if (!isPasswordCorrect) {
    const today = new Date().toISOString().split("T")[0]; // "2025-02-11"
    const lastFailedDay = new Date(user.updatedAt).toISOString().split("T")[0];

    let newErrorCount = user.errorLoginCount + 1;
    if (today !== lastFailedDay) {
      newErrorCount = 1;
    }

    await updateUser(
      {
        errorLoginCount: newErrorCount,
        updatedAt: new Date(),
      },
      user.id,
    );

    if (newErrorCount >= 3) {
      await updateUser(
        {
          status: "FREEZED",
          errorLoginCount: 0,
          updatedAt: new Date(),
        },
        user.id,
      );

      throw new ResponseError(
        "Too many failed login attempts. Your account has been temporarily frozen.",
        403,
        "account_frozen",
      );
    }

    throw new ResponseError("Incorrect password", 401, "invalid_credentials");
  }

  const accessToken = jwt.sign(
    { id: user.id },
    process.env.ACCESS_TOKEN_SECRET!,
    { expiresIn: "15m" },
  );

  const refreshToken = jwt.sign(
    { id: user.id, phone: user.phone },
    process.env.REFRESH_TOKEN_SECRET!,
    { expiresIn: "30d" },
  );

  await updateUser(
    {
      errorLoginCount: 0,
      randToken: refreshToken,
      updatedAt: new Date(),
    },
    user.id,
  );

  res
    .cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      maxAge: 15 * 60 * 1000,
      path: "/",
    })
    .cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: "/",
    });

  return res.status(200).json({
    message: "User login successfully",
  });
};

export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const refreshToken = req.cookies ? req.cookies.refreshToken : null;
  if (!refreshToken) {
    throw new ResponseError("Unauthorized User", 401, "Unauthorized");
  }
  let decode;
  try {
    decode = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET!) as {
      id: number;
      phone: string;
    };
  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      throw new ResponseError(
        "RefreshToken is Expired",
        401,
        "Error RefreshToken",
      );
    } else {
      throw new ResponseError("RefreshToken is invalid", 401, "Error_Attack");
    }
  }
  const user = await getNumberId(decode.id);
  if (!user) {
    throw new ResponseError("User does not exist", 400, "user_not_found");
  }

  if (user.phone !== decode.phone) {
    throw new ResponseError("Unauthorized User", 401, "Unauthorized");
  }
  await updateUser({ randToken: "" }, decode.id);
  // return res.status(200).json({ message: "User logout successfully" });
  res.clearCookie("accessToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
  });
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
  });

  return res.status(200).json({
    message: "User logout successfully",
  });
};

export const forgetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (validationFunction(req, res, next)) return;
    let { phone } = req.body;

    if (phone.slice(0, 2) === "09") {
      phone = phone.substring(2, phone.length);
    }
    const user = await getNumberPhone(phone);
    checkUserNotExist(user);
    const otpRow = await getNumberPhoneOtp(phone);
    //important
    // Warning - Your app may let users change their phone number.
    // If so, you need to check if phone number exists in Otp table.

    const opt = "123456";
    // const opt = generateOtp();
    const salt = await bcrypt.genSalt(10);
    const hashOtp = await bcrypt.hash(opt, salt);
    const token = generateToken();

    const latestUpdateDate = new Date(otpRow!.updatedAt)
      .toISOString()
      .split("T")[0];
    const currentDate = new Date().toISOString().split("T")[0];
    const isSameDate = latestUpdateDate === currentDate;
    checkErrorIfSameDate(isSameDate, otpRow!.error);
    if (!isSameDate) {
      const dataOfOtp = {
        otp: hashOtp,
        rememberToken: token,
        count: 1,
        error: 0,
      };
      await updateOtp(otpRow!.id, dataOfOtp);
    } else {
      if (otpRow!.count === 3) {
        throw new ResponseError(
          "error limit Count.Try again Tomorrow",
          405,
          "error not found",
        );
      } else {
        const dataOfOtp = {
          otp: hashOtp,
          rememberToken: token,
          count: { increment: 1 },
        };
        await updateOtp(otpRow!.id, dataOfOtp);
      }
    }

    res.status(200).json({
      message: `We are sending OTP to 09${phone} to reset password.`,
      phone: phone,
      rememberToken: token,
    });
  } catch (error) {
    next(error);
  }
};

export const verifyOtpForgetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (validationFunction(req, res, next)) return;
  const { phone, otp, rememberToken } = req.body;
  const user = await getNumberPhone(phone);
  checkUserNotExist(user);

  const otpRow = await getNumberPhoneOtp(phone);
  if (!otpRow) {
    throw new ResponseError("Otp does not exist", 400, "otp_not_found");
  }
  if (otpRow!.rememberToken !== rememberToken) {
    const optErrorCount = {
      error: 5,
    };
    await updateOtp(otpRow!.id, optErrorCount);
    throw new ResponseError("rememberToken not found", 400, "error not found");
  }

  const isExpired = dayjs().isAfter(dayjs(otpRow.updatedAt).add(2, "minute"));
  if (isExpired) {
    throw new ResponseError("Otp is expired", 400, "otp_not_found");
  }
  const isMatched = await bcrypt.compare(otp, otpRow.otp);
  const latestUpdateDate = new Date(otpRow.updatedAt)
    .toISOString()
    .split("T")[0];
  const currentDate = new Date().toISOString().split("T")[0];
  const isSameDate = latestUpdateDate === currentDate;
  checkErrorIfSameDate(isSameDate, otpRow.error);
  if (!isMatched) {
    if (!isSameDate) {
      const optErrorCount = {
        error: 1,
      };
      await updateOtp(otpRow.id, optErrorCount);
    } else {
      const optErrorCount = {
        error: { increment: 1 },
      };
      await updateOtp(otpRow.id, optErrorCount);
    }

    throw new ResponseError("Invalid Otp", 400, "otp_not_found");
  }
  const verifyToken = generateToken();
  const dataOfOtp = {
    verifyToken,
    error: 0,
    count: 1,
  };
  const result = await updateOtp(otpRow!.id, dataOfOtp);
  return res.status(201).json({
    message: "User created successfully",
    data: {
      phone: result.phone,
      verifyToken: result.verifyToken,
    },
  });
};

export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (validationFunction(req, res, next)) return;
  const { phone, rememberToken, password } = req.body;
  const user = await getNumberPhone(phone);
  if (!user) {
    throw new ResponseError("User does not exist", 400, "user_not_found");
  }
  const otpRow = await getNumberPhoneOtp(phone);
  if (otpRow?.verifyToken !== rememberToken) {
    const otpData = {
      error: 5,
    };
    await updateOtp(otpRow!.id, otpData);
    throw new ResponseError("Invalid Token", 400, "otp_not_found");
  }
  if (otpRow?.error === 5) {
    throw new ResponseError(
      "error limit Count.Try again Tomorrow",
      405,
      "error not found",
    );
  }
  const isExpired = dayjs().isAfter(dayjs(otpRow!.updatedAt).add(5, "minute"));
  if (isExpired) {
    throw new ResponseError("Otp is expired", 400, "otp_not_found");
  }
  const salt = await bcrypt.genSalt(10);
  const hashPassword = await bcrypt.hash(password, salt);

  const accessToken = jwt.sign(
    { id: user.id },
    process.env.ACCESS_TOKEN_SECRET!,
    {
      expiresIn: "15m",
    },
  );
  const refreshToken = jwt.sign(
    { id: user.id, phone: user.phone },
    process.env.REFRESH_TOKEN_SECRET!,
    {
      expiresIn: "30d",
    },
  );
  const userUpdateData = {
    randToken: refreshToken,
    password: hashPassword,
  };
  await updateUser(userUpdateData, user.id);

  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    maxAge: 1000 * 60 * 15,
    path: "/",
  });
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    maxAge: 1000 * 60 * 60 * 24 * 30,
    path: "/",
  });

  return res.status(200).json({
    message: "Successfully reset your password.",
  });
};
interface CustomRequest extends Request {
  userId?: number;
  user?: any;
}

export const authCheck = async (req:CustomRequest,res:Response,next:NextFunction)=>{
  try {
    const user = await getNumberId(req.userId!);
    if (!user) {
      throw new ResponseError("User does not exist", 400, "user_not_found");
    }
    return res.status(200).json({
      message: "User is authenticated",
      userId : user.id,
      userName : user.firstName + " " + user.lastName,
      user
    });
  } catch (error) {
    next(error)
  }
}

export const changePassword = async (req:CustomRequest,res:Response,next:NextFunction) => {
  const user = await getNumberId(req.userId!);
   if (!user) {
      throw new ResponseError("User does not exist", 400, "user_not_found");
    }
    const {oldPassword , password } = req.body;
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      throw new ResponseError("Old password is incorrect", 400, "old_password_incorrect");
    }
    const salt = await bcrypt.genSalt(10);
    const hashPassword = await bcrypt.hash(password, salt);
    const userUpdateData = {
      password: hashPassword,
    };
    await updateUser(userUpdateData, user.id);
    return res.status(200).json({
      message: "Successfully change your password.",
    });
}