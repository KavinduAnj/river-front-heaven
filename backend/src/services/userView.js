function publicUser(u) {
    return {
        id: u.id,
        username: u.username,
        fullName: u.fullName,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        mustChangePassword: u.mustChangePassword,
        createdAt: u.createdAt,
    };
}

module.exports = { publicUser };