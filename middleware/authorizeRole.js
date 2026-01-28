const authorizeRole = (allowedRoles = []) => {
  return (req, res, next) => {
    try {
      const userRole = req.user?.role;
      console.log(userRole);
      if (!userRole) {
        return res.status(400).json({ message: "User Role missing in token" });
      }
      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({ message: ` Unauthorized access ,Role must be ${allowedRoles[0]} ` });
      }

      next();
    } catch (err) {
      return res.status(500).json({ message: "Role check failed", error: err.message });
    }
  };
};

module.exports = { authorizeRole };
