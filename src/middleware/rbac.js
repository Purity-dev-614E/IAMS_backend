const rbac = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user && !req.industrySupervisor) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required.' 
      });
    }

    // Handle industry supervisor access (token-based)
    if (req.industrySupervisor) {
      req.rbac = {
        isIndustrySupervisor: true,
        isAdmin: false,
        isUniSupervisor: false,
        isStudent: false,
        canAccessAllData: false,
        canAccessOwnDataOnly: true
      };
      return next();
    }

    const userRole = req.user.role;
    
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Insufficient permissions.',
        required: allowedRoles,
        current: userRole
      });
    }

    // Add role-based context to request
    req.rbac = {
      isAdmin: userRole === 'admin',
      isUniSupervisor: userRole === 'uni_supervisor',
      isStudent: userRole === 'student',
      isIndustrySupervisor: false,
      canAccessAllData: ['admin', 'uni_supervisor'].includes(userRole),
      canAccessOwnDataOnly: userRole === 'student'
    };

    next();
  };
};


// Predefined role checks for common use cases
const authorize = {
  // Admin only
  admin: () => rbac(['admin']),
  
  // Admin and University Supervisors
  staff: () => rbac(['admin', 'uni_supervisor']),
  
  // University Supervisors only
  uniSupervisor: () => rbac(['uni_supervisor']),
  
  // Students only
  student: () => rbac(['student']),
  
  // Industry supervisors only (token-based)
  industrySupervisor: () => (req, res, next) => {
    if (!req.industrySupervisor) {
      return res.status(401).json({ 
        success: false, 
        message: 'Industry supervisor authentication required.' 
      });
    }
    next();
  },
  
  // Admin and specific user (for self-service)
  selfOrAdmin: (getUserId) => {
    return (req, res, next) => {
      const targetUserId = getUserId ? getUserId(req) : req.params.userId;
      
      if (req.user?.role === 'admin' || req.user?.id == targetUserId) {
        return next();
      }
      
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. You can only access your own data.' 
      });
    };
  },
  
  // Resource ownership checks
  ownResource: (getResourceOwner) => {
    return async (req, res, next) => {
      try {
        const resourceOwnerId = await getResourceOwner(req);
        
        if (req.user?.role === 'admin' || req.user?.id === resourceOwnerId) {
          return next();
        }
        
        return res.status(403).json({ 
          success: false, 
          message: 'Access denied. You do not own this resource.' 
        });
      } catch (error) {
        return res.status(500).json({ 
          success: false, 
          message: 'Error checking resource ownership.' 
        });
      }
    };
  }
};

module.exports = { rbac, authorize };
