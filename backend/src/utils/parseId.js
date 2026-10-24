const HttpError = require("./httpError");

// Turns an :id from the URL into a number, or throws a 400
module.exports = (value) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(400, "Invalid id", "VALIDATION_ERROR");
  return id;
};