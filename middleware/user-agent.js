const UAParser = require("ua-parser-js");

function userAgentMiddleware(req, res, next) {
  const uaString = req.headers["user-agent"];
  const parser = new UAParser(uaString);
  const result = parser.getResult();

  req.clientInfo = {
    browser: result.browser.name,   // Chrome, Safari, Firefox, Edge...
    version: result.browser.version,
    os: result.os.name,             // Windows, iOS, Android...
    device: result.device.type || "desktop" // mobile, tablet, desktop
  };

  console.log("Client Info:", req.clientInfo);

  next();
}

module.exports=userAgentMiddleware;