const signup = async (req, res) => {
    try {
        const { id } = req.body;

        if (!id) {
            return res.status(400).json({
                message: "User ID is required"
            });
        }

        const existingUser = await User.findOne({ id });

        if (existingUser) {
            return res.status(409).json({
                message: "User already exists"
            });
        }

        const user = await User.create({
            id,
            name: id,
            email: `${id}@local`,
            passwordHash: "not-used"
        });

        return res.status(201).json({
            message: "User created successfully",
            user: {
                id: user.id
            }
        });
    } catch (error) {
        console.error("Signup error:", error);

        return res.status(500).json({
            message: "Internal server error"
        });
    }
};