// frontend/src/App.tsx

import { useState, useEffect } from "react";

// WHY interface? TypeScript interfaces define the "shape" of data
// This tells TypeScript exactly what our API response looks like
interface ApiResponse {
  message: string;
  timestamp: string;
  status: string;
}

function App() {
  // WHY <ApiResponse | null>? The data is either ApiResponse or null (before loading)
  // This is called a "Union Type" — one of the most powerful TS features!
  const [data, setData] = useState<ApiResponse | null>(null);

  // WHY <boolean>? TypeScript knows loading is always true or false
  const [loading, setLoading] = useState<boolean>(true);

  // WHY <string>? Error messages are always strings
  const [error, setError] = useState<string>("");

  useEffect(() => {
    // WHY async function inside useEffect?
    // useEffect can't be async directly — this is the correct pattern
    const fetchData = async (): Promise<void> => {
      try {
        const response = await fetch("http://localhost:3000");

        // WHY check response.ok? fetch() doesn't throw on 404/500 errors!
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        // WHY <ApiResponse>? Tells TypeScript what shape the JSON will be
        const result: ApiResponse = await response.json();
        setData(result);
      } catch (err) {
        // WHY instanceof Error? TypeScript requires type checking on catch
        if (err instanceof Error) {
          setError(err.message);
        }
      } finally {
        // WHY finally? Runs whether success or failure — stops the loader
        setLoading(false);
      }
    };

    fetchData();
  }, []); // Empty array = run once when component loads

  // ─── RENDER ───────────────────────────────────────────
  return (
    <div
      style={{
        fontFamily: "Arial",
        maxWidth: "600px",
        margin: "50px auto",
        padding: "20px",
      }}
    >
      <h1>🚀 My MERN TypeScript App</h1>

      {/* Conditional rendering based on state */}
      {loading && <p>⏳ Connecting to backend...</p>}

      {error && (
        <div style={{ color: "red", padding: "10px", border: "1px solid red" }}>
          ❌ Error: {error}
          <br />
          <small>Make sure your backend is running on port 5000!</small>
        </div>
      )}

      {data && (
        <div
          style={{
            padding: "20px",
            background: "#f0f9ff",
            borderRadius: "8px",
            border: "1px solid #0ea5e9",
          }}
        >
          <h2>✅ Backend Connected!</h2>
          {/* TypeScript knows data.message is a string — safe to use! */}
          <p>
            <strong>Message:</strong> {data.message}
          </p>
          <p>
            <strong>Status:</strong> {data.status}
          </p>
          <p>
            <strong>Time:</strong> {data.timestamp}
          </p>
        </div>
      )}
    </div>
  );
}

export default App;
