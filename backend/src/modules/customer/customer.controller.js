import ApiError from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import Customer from "./customer.model.js";
import User from "../user/user.model.js";

const checkIsMerchant = async (tenantId, username) => {
  return Boolean(
    await User.exists({
      tenantId,
      username: username.toLowerCase(),
      role: { $in: ["ADMIN", "ECO"] },
      isActive: { $ne: false },
    }),
  );
};

const registerCustomer = asyncHandler(async (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");
  const browserId = String(req.body.browserId || "").trim();

  if (!/^[\p{L}\p{N}_. -]{2,40}$/u.test(username)) {
    throw new ApiError(400, "Enter a valid username (2-40 characters)");
  }
  if (!password || password.length < 6) {
    throw new ApiError(400, "Password must be at least 6 characters");
  }
  if (password.length > 128) {
    throw new ApiError(400, "Password cannot exceed 128 characters");
  }

  const existingCustomer = await Customer.findOne({
    tenantId: req.store._id,
    usernameLower: username.toLowerCase(),
  });

  if (existingCustomer) {
    throw new ApiError(409, "An account with this username already exists. Please sign in.");
  }

  const customer = new Customer({
    tenantId: req.store._id,
    username,
    usernameLower: username.toLowerCase(),
    password,
    browserId: browserId || undefined,
    lastSeenAt: new Date(),
  });
  await customer.save();

  const isMerchant = await checkIsMerchant(req.store._id, customer.username);
  const token = customer.generateToken();

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        _id: customer._id,
        username: customer.username,
        isMerchant,
        token,
      },
      "Account created successfully",
    ),
  );
});

const loginCustomer = asyncHandler(async (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");
  const browserId = String(req.body.browserId || "").trim();

  if (!username) {
    throw new ApiError(400, "Username is required");
  }
  if (!password) {
    throw new ApiError(400, "Password is required");
  }

  const customer = await Customer.findOne({
    tenantId: req.store._id,
    usernameLower: username.toLowerCase(),
  }).select("+password");

  if (!customer) {
    throw new ApiError(401, "Invalid username or password");
  }

  if (customer.password) {
    const isCorrect = await customer.isPasswordCorrect(password);
    if (!isCorrect) {
      throw new ApiError(401, "Invalid username or password");
    }
  } else {
    // If the customer record was previously created as a guest, secure it with this password now
    customer.password = password;
  }

  customer.lastSeenAt = new Date();
  if (browserId) {
    customer.browserId = browserId;
  }
  await customer.save();

  const isMerchant = await checkIsMerchant(req.store._id, customer.username);
  const token = customer.generateToken();

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        _id: customer._id,
        username: customer.username,
        isMerchant,
        token,
      },
      "Signed in successfully",
    ),
  );
});

const signInCustomer = asyncHandler(async (req, res, next) => {
  const action = String(req.body.action || "").toLowerCase().trim();
  if (action === "signup" || action === "register") {
    return registerCustomer(req, res, next);
  }
  if (action === "signin" || action === "login") {
    return loginCustomer(req, res, next);
  }

  const username = String(req.body.username || "").trim();
  const password = req.body.password !== undefined ? String(req.body.password) : null;
  const browserId = String(req.body.browserId || "").trim();

  if (password !== null && password !== "") {
    const existing = await Customer.findOne({
      tenantId: req.store._id,
      usernameLower: username.toLowerCase(),
    });
    if (existing) {
      return loginCustomer(req, res, next);
    }
    return registerCustomer(req, res, next);
  }

  // Legacy guest login for backward compatibility
  if (
    !/^[\p{L}\p{N}_. -]{2,40}$/u.test(username) ||
    !/^[a-zA-Z0-9-]{16,100}$/.test(browserId)
  ) {
    throw new ApiError(400, "Enter a valid username");
  }

  const customer = await Customer.findOneAndUpdate(
    { tenantId: req.store._id, browserId },
    { $set: { username, usernameLower: username.toLowerCase(), lastSeenAt: new Date() } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  const isMerchant = await checkIsMerchant(req.store._id, customer.username);
  const token = customer.generateToken ? customer.generateToken() : null;

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        _id: customer._id,
        username: customer.username,
        isMerchant,
        token,
      },
      "Customer identity saved",
    ),
  );
});

const getSignedCustomers = asyncHandler(async (req, res) =>
  res.json(
    new ApiResponse(
      200,
      await Customer.find({ tenantId: req.store._id })
        .select("username createdAt lastSeenAt")
        .sort({ lastSeenAt: -1 })
        .limit(500),
      "Signed customers fetched",
    ),
  ),
);

export { signInCustomer, loginCustomer, registerCustomer, getSignedCustomers };

