import { body } from "express-validator";

export const registerValidator = [
  body("phone")
    .notEmpty()
    .withMessage("phone is required")
    .matches(/^[0-9]+$/)
    .withMessage("phone must be a number"),
];
export const verifyValidator = [
  body("phone")
    .notEmpty()
    .withMessage("phone is required")
    .matches(/^[0-9]+$/)
    .withMessage("phone must be a number"),
  body("otp")
    .trim()
    .notEmpty()
    .withMessage("otp is required")
    .matches(/^[0-9]+$/)
    .isLength({ min: 6, max: 6 })
    .withMessage("OTP must be 6 digits").escape(),
  body("rememberToken")
    .trim()
    .notEmpty()
    .withMessage("rememberToken is required")
    .escape(),
];

export const confirmPasswordValidation = [
  body("phone")
    .notEmpty()
    .withMessage("phone is required")
    .matches(/^[0-9]+$/)
    .withMessage("phone must be a number"),
  body("password")
    .trim()
    .notEmpty()
    .isLength({ min: 6, max: 15 })
    .withMessage("min 6 and max 15").escape(),
  body("rememberToken")
    .trim()
    .notEmpty()
    .withMessage("rememberToken is required")
    .escape(),
];

export const loginValidation = [
  body("phone")
    .notEmpty()
    .withMessage("phone is required")
    .matches(/^[0-9]+$/)
    .withMessage("phone must be a number"),
  body("password")
    .trim()
    .notEmpty()
    .isLength({ min: 6, max: 15 })
    .withMessage("min 6 and max 15"),
];

export const maintenanceValidator = [
  body("mode")
    .notEmpty()
    .withMessage("mode is required")
    .isBoolean()
    .withMessage("mode must be true or false"),
];
