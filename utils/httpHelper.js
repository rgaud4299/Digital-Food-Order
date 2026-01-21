// const axios = require("axios");
// const https = require("https");
// const JSONbig = require('json-bigint');

// async function makeAxiosRequest(
//   requestUrl,
//   params = {},
//   requestMethod = "GET",
//   extra = {},
//   timeoutSeconds = 10,
//   token = null,
//   contentType = "",
// ) {
//   try {
//     // Validate URL
//     try {
//       new URL(requestUrl); // will throw if invalid
//     } catch {
//       throw new Error(`Invalid URL: ${requestUrl}`);
//     }

//     // SSL verify toggle
//     const httpsAgent = extra?.insecure
//       ? new https.Agent({ rejectUnauthorized: false })
//       : undefined;

//     // Base headers
//     const headers = {
//       ...(token ? { Authorization: `Bearer ${token}` } : {}),
//       ...(contentType ? { "Content-Type": contentType } : {}),
//       ...(extra?.headers || {}),
//     };

//     // Axios config
//     const config = {
//       url: requestUrl,
//       method: requestMethod.toUpperCase(),
//       timeout: Math.max(1, Math.floor(timeoutSeconds * 1000)),
//       headers,
//       httpsAgent,
//       maxRedirects: 5,
//       validateStatus: () => true, // <-- let all statuses pass, handle manually
//     };

//     // Attach params/data
//     if (config.method === "GET") {
//       config.params = params;
//     } else {
//       if ((contentType || "").toLowerCase() === "application/json") {
//         config.data = params; // auto JSON
//       } else if (
//         (contentType || "").toLowerCase() ===
//         "application/x-www-form-urlencoded"
//       ) {
//         const body = new URLSearchParams();
//         Object.entries(params || {}).forEach(([k, v]) =>
//           body.append(k, v ?? "")
//         );
//         config.data = body.toString();
//       } else {
//         config.headers["Content-Type"] = "application/json";
//         config.data = params;
//       }
//     }

//     // Request
//     const axiosResponse = await axios.request(config);

//     return {
//       success: axiosResponse.status >= 200 && axiosResponse.status < 300,
//       http_code: axiosResponse.status,
//       response:
//         typeof axiosResponse.data === "string"
//           ? axiosResponse.data
//           : JSONbig.stringify(axiosResponse.data),
//     };
//   } catch (error) {
//     if (error.response) {
//       const { status, headers, data } = error.response;
//       const ct = (headers?.["content-type"] || "").toLowerCase();
//       const bodyString =
//         typeof data === "string" ? data : JSONbig.stringify(data);

//       return {
//         success: false,
//         http_code: status,
//         response: ct.includes("application/json") ||
//           ct.includes("application/xml") ||
//           ct.includes("text/")
//           ? bodyString
//           : `HTTP Error: ${status}`,
//       };
//     } else if (error.request) {
//       return { success: false, http_code: 0, response: "HTTP Error: No Response" };
//     } else {
//       return { success: false, http_code: 0, response: error.message };
//     }
//   }
// }
// module.exports = { makeAxiosRequest };












const axios = require("axios");
const https = require("https");
const JSONbig = require("json-bigint");

async function makeAxiosRequest(
  requestUrl,
  params = {},
  requestMethod = "GET",
  extra = {},
  timeoutSeconds = 10,
  token = null,
  contentType = "",
) {
  try {
    // Validate URL
    try {
      new URL(requestUrl);
    } catch {
      throw new Error(`Invalid URL: ${requestUrl}`);
    }

    // SSL verify toggle
    const httpsAgent = extra?.insecure
      ? new https.Agent({ rejectUnauthorized: false })
      : undefined;

    // Base headers
    const headers = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(contentType ? { "Content-Type": contentType } : {}),
      ...(extra?.headers || {}),
    };

    // Axios config
    const config = {
      url: requestUrl,
      method: requestMethod.toUpperCase(),
      timeout: Math.max(1, Math.floor(timeoutSeconds * 1000)),
      headers,
      httpsAgent,
      maxRedirects: 5,
      validateStatus: () => true, // let all statuses pass, handle manually
    };

    // Attach params/data
    if (config.method === "GET") {
      config.params = params;
    } else {
      if ((contentType || "").toLowerCase() === "application/json") {
        config.data = params;
      } else if ((contentType || "").toLowerCase() === "application/x-www-form-urlencoded") {
        const body = new URLSearchParams();
        Object.entries(params || {}).forEach(([k, v]) =>
          body.append(k, v ?? "")
        );
        config.data = body.toString();
      } else {
        config.headers["Content-Type"] = "application/json";
        config.data = params;
      }
    }

    // Request
    const axiosResponse = await axios.request(config);

    // ✅ Response handling: JSON object ही return करना
    let parsedResponse = axiosResponse.data;
    if (typeof parsedResponse === "string") {
      try {
        parsedResponse = JSONbig.parse(parsedResponse);
      } catch {
        // अगर parse fail हुआ तो string ही रहने दो
      }
    }

    return {
      success: axiosResponse.status >= 200 && axiosResponse.status < 300,
      http_code: axiosResponse.status,
      response: parsedResponse,
    };
  } catch (error) {
    if (error.response) {
      const { status, headers, data } = error.response;
      const ct = (headers?.["content-type"] || "").toLowerCase();

      let parsedError = data;
      if (typeof parsedError === "string" && ct.includes("application/json")) {
        try {
          parsedError = JSONbig.parse(parsedError);
        } catch {
          // parsing fail → string रहने दो
        }
      }

      return {
        success: false,
        http_code: status,
        response: parsedError,
      };
    } else if (error.request) {
      return { success: false, http_code: 0, response: "HTTP Error: No Response" };
    } else {
      return { success: false, http_code: 0, response: error.message };
    }
  }
}

module.exports = { makeAxiosRequest };
