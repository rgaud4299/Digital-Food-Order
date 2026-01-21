// File: validators/userListValidator.js


const { handleValidation,
    ListValidation, optionalStringRule,
    optionalNumericRule } = require("./commonValidators");

const userListValidation = [
    ...ListValidation, // offset, limit, status validation
    optionalStringRule("searchValue", "Search must be a string"),
    optionalStringRule("name", "Name must be a string"),
    optionalStringRule("email", "Email must be a string"),
    optionalNumericRule("mobile_no", "Mobile number must be a string"),
    optionalStringRule("company_name", "Company name must be a string"),
    handleValidation, // final middleware for error handling
];

module.exports = {
    userListValidation,
};
