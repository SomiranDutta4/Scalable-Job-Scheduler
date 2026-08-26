import { useState } from "react";
import Home from "./components/Home";
import "./App.css";

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
        <div className="landing">
            <div className="landing-card">
                <div className="brand">
                    <div className="brand-icon">JS</div>

                    <div>
                        <h1>Distributed Job Scheduler</h1>
                        <p>Reliable background job processing</p>
                    </div>
                </div>

                <div className="divider"></div>

                <div className="content">
                    <h2>Manage your jobs</h2>

                    <p>
                        Create, schedule and monitor background jobs
                        across distributed workers.
                    </p>

                    <button
                        onClick={enter}
                        disabled={loading}
                    >
                        {loading ? "Connecting..." : "Enter Dashboard"}
                    </button>
                </div>

                <div className="features">
                    <div>
                        <strong>Priority Queues</strong>
                        <span>High, Normal & Low</span>
                    </div>

                    <div>
                        <strong>Retries</strong>
                        <span>Exponential backoff</span>
                    </div>

                    <div>
                        <strong>Distributed Workers</strong>
                        <span>Redis powered</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default App;