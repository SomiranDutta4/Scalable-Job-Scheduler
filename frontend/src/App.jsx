import { useState } from "react";
import Home from "./components/Home";

function App() {
    const [loggedIn, setLoggedIn] = useState(
        !!localStorage.getItem("token")
    );
    const [loading, setLoading] = useState(false);

    const enter = async () => {
        setLoading(true);

        try {
            const response = await fetch(
                "http://localhost:3000/api/user/test",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            );

            const data = await response.json();

            if (!response.ok) {
                alert(data.message || "Failed to enter");
                return;
            }

            localStorage.setItem("token", data.token);
            localStorage.setItem("userId", data.user.id);

            setLoggedIn(true);
        } catch (error) {
            console.error("Enter error:", error);
            alert("Could not connect to server");
        } finally {
            setLoading(false);
        }
    };

    if (loggedIn) {
        return <Home />;
    }

    return (
        <div>
            <h1>Distributed Job Scheduler</h1>

            <button
                onClick={enter}
                disabled={loading}
            >
                {loading ? "Entering..." : "Enter"}
            </button>
        </div>
    );
}

export default App;