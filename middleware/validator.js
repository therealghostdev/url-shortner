const { z } = require("zod");

const validateUrl = (req, res, next) => {
  const result = z.string().url().safeParse(req.body?.url);
  if (!result.success) {
    return res.status(400).json({
      message: "invalid or missing request body",
      error: result.error.issues,
    });
  }
  next();
};

module.exports = { validateUrl };
