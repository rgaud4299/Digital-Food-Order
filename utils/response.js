const { RESPONSE_CODES } = require('./helper');



function success(res, message, data = null, statusCode = 1) {
  return res.status(200).json({
    success: true,
    statusCode,
    message,
    ...(data !== null ? { data } : {})
  });
}

function error(res, message, statusCode = 0, httpCode = 500) {
  return res.status(httpCode).json({
    success: false,
    statusCode,
    message
  });
}

function successGetAll(res, message, data = [], total = 0, filteredCount = 0, extras = {}) {
  return res.status(200).json({
    success: true,
    statusCode: RESPONSE_CODES?.SUCCESS??1,
    message,
    recordsTotal: total,
    recordsFiltered: filteredCount,
    ...extras, // <-- ✅ merge all extra fields dynamically
    data,
  });
}


module.exports = { success, error, successGetAll };
