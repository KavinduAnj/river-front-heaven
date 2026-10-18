const HttpError = require("../utils/httpError");

module.exports = function validate(schema, source = "body") {
    return (req, _res, next) => {
        const result = schema.safeParse(req[source]);
        if (!result.success) {
            const message = result.error.issues
                .map((i) => `${i.path.join(".") || source}: ${i.message}`)
                .join("; ");
            return next(new HttpError(400, message, "VALIDATION_ERROR"));
        }
        req[source] = result.data;
        next();
    };
};