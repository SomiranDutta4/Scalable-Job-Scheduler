import { useEffect, useState } from "react";

const API_URL = "http://localhost:3000/api";
const WS_URL = "ws://localhost:3000/ws";

function Home() {
    const [jobs, setJobs] = useState([]);
    const [description, setDescription] = useState("");
    const [task, setTask] = useState("");
    const [scheduledFor, setScheduledFor] = useState("");
    const [timeoutMs, setTimeoutMs] = useState(0);
    const [loading, setLoading] = useState(false);
    const [priority, setPriority] = useState(2);

    const token = localStorage.getItem("token");
    const userId = localStorage.getItem("userId");

    const fetchJobs = async () => {
        try {
            const response = await fetch(`${API_URL}/jobs`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (!response.ok) {
                console.error(data.message);
                return;
            }

            setJobs(data.jobs);
            console.log(data.jobs);
        } catch (error) {
            console.error("Fetch jobs error:", error);
        }
    };

    const createJob = async () => {
        if (!task.trim()) {
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(`${API_URL}/job/new`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    description,
                    task,
                    scheduledFor: scheduledFor || undefined,
                    timeoutMs: Number(timeoutMs),
                    priority
                })
            });

            const data = await response.json();

            if (!response.ok) {
                alert(data.message || "Failed to create job");
                return;
            }

            setJobs(prev => [data.job, ...prev]);

            setDescription("");
            setTask("");
            setScheduledFor("");
            setTimeoutMs(0);
        } catch (error) {
            console.error("Create job error:", error);
        } finally {
            setLoading(false);
        }
    };

    const cancelJob = async jobId => {
        try {
            const response = await fetch(
                `${API_URL}/job/cancel/${jobId}`,
                {
                    method: "PUT",
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if (!response.ok) {
                alert(data.message || "Failed to cancel job");
                return;
            }

            setJobs(prev =>
                prev.map(job =>
                    job.id === jobId ? data.job : job
                )
            );
        } catch (error) {
            console.error("Cancel job error:", error);
        }
    };

    const retryJob = async jobId => {
        try {
            const response = await fetch(
                `${API_URL}/job/retry/${jobId}`,
                {
                    method: "PUT",
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if (!response.ok) {
                alert(data.message || "Failed to retry job");
                return;
            }

            setJobs(prev =>
                prev.map(job =>
                    job.id === jobId ? data.job : job
                )
            );
        } catch (error) {
            console.error("Retry job error:", error);
        }
    };

    useEffect(() => {
        fetchJobs();
    }, []);

    useEffect(() => {
        const socket = new WebSocket(WS_URL);

        socket.onopen = () => {
            console.log("WebSocket connected");
        };

        socket.onmessage = message => {
            try {
                const event = JSON.parse(message.data);

                if (event.userId === userId) {
                    setJobs(prev =>
                        prev.map(job =>
                            job.id === event.jobId
                                ? {
                                    ...job,
                                    status: event.status,
                                    ...(event.attempt !== undefined && {
                                        attempts: event.attempt
                                    })
                                }
                                : job
                        )
                    );
                }
            } catch (error) {
                console.error(
                    "Invalid WebSocket message:",
                    error
                );
            }
        };

        socket.onerror = error => {
            console.error("WebSocket error:", error);
        };

        socket.onclose = () => {
            console.log("WebSocket disconnected");
        };

        return () => {
            socket.close();
        };
    }, [userId]);

    return (
        <div className="app">
            <nav className="navbar">
                <h2>Distributed Job Scheduler</h2>

                <div className="user-info">
                    User: <strong>{userId}</strong>
                </div>
            </nav>

            <main className="container">
                <section className="create-card">
                    <h2>Create New Task</h2>

                    <div className="form">
                        <input
                            type="text"
                            placeholder="Task title"
                            value={description}
                            onChange={e =>
                                setDescription(e.target.value)
                            }
                        />

                        <input
                            type="text"
                            placeholder="Task description"
                            value={task}
                            onChange={e =>
                                setTask(e.target.value)
                            }
                        />

                        <input
                            type="datetime-local"
                            value={scheduledFor}
                            onChange={e =>
                                setScheduledFor(e.target.value)
                            }
                        />

                        <input
                            type="number"
                            placeholder="e.g. 5000"
                            value={timeoutMs}
                            onChange={e =>
                                setTimeoutMs(e.target.value)
                            }
                        />

                        <select
                            value={priority}
                            onChange={e =>
                                setPriority(Number(e.target.value))
                            }
                        >
                            <option value={3}>
                                High Priority
                            </option>

                            <option value={2}>
                                Normal Priority
                            </option>

                            <option value={1}>
                                Low Priority
                            </option>
                        </select>

                        <button
                            className="primary-btn full"
                            onClick={createJob}
                            disabled={loading}
                        >
                            {loading
                                ? "Creating..."
                                : "Create Task"}
                        </button>
                    </div>
                </section>

                <section>
                    <h2>My Tasks</h2>

                    <div className="jobs">
                        {jobs.length === 0 ? (
                            <div className="empty">
                                No tasks yet.
                            </div>
                        ) : (
                            jobs.map(job => (
                                <div
                                    className="job-card"
                                    key={job.id}
                                >
                                    <div className="job-top">
                                        <h3>
                                            {job.description ||
                                                "Untitled Job"}
                                        </h3>

                                        <span
                                            className={`status ${job.status}`}
                                        >
                                            {job.status}
                                        </span>
                                    </div>

                                    <p className="job-task">
                                        {job.task}
                                    </p>

                                    <div className="job-meta">
                                        <span>
                                            Priority:{" "}
                                            {job.priority === 3
                                                ? "High"
                                                : job.priority === 1
                                                    ? "Low"
                                                    : "Normal"}
                                        </span>

                                        <span>
                                            Attempts:{" "}
                                            {job.attempts}
                                        </span>

                                        <span>
                                            Scheduled:{" "}
                                            {new Date(
                                                job.scheduledFor
                                            ).toLocaleString()}
                                        </span>
                                    </div>

                                    <div className="actions">
                                        {(
                                            job.status === "pending" ||
                                            job.status === "retrying" ||
                                            job.status === "queued"
                                        ) && (
                                            <button
                                                className="action-btn"
                                                onClick={() =>
                                                    cancelJob(job.id)
                                                }
                                            >
                                                Cancel
                                            </button>
                                        )}

                                        {(
                                            job.status === "failed" ||
                                            job.status === "cancelled"
                                        ) && (
                                            <button
                                                className="action-btn"
                                                onClick={() =>
                                                    retryJob(job.id)
                                                }
                                            >
                                                Retry
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>
            </main>
        </div>
    );
}

export default Home;