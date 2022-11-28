import React, { useState, useEffect } from "react";
import SignUp from "./SignUp";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Hello from "./Hello";
import Login from "./Login";

function App() {
  const [storedToken, setStoredToken] = useState(localStorage.getItem("token"));
  useEffect(() => {
    console.log(storedToken);
  }, [storedToken]);

  return (
    <div>
      <Router>
        <Routes>
          {storedToken ? (
            <Route
              path="/"
              element={<Hello setStoredToken={setStoredToken} />}
            />
          ) : (
            <Route
              path="/"
              element={<SignUp setStoredToken={setStoredToken} />}
            />
          )}
          <Route
            path="/login"
            element={<Login setStoredToken={setStoredToken} />}
          />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
