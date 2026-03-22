// src/utils/api.js
import axios from "axios";

const configuredBaseURL = process.env.REACT_APP_API_URL?.trim();
const isLocalBackendURL =
  configuredBaseURL === "http://localhost:5000" ||
  configuredBaseURL === "http://127.0.0.1:5000";

// In CRA development, prefer relative API paths so the dev proxy handles routing.
// This avoids CORS mismatches when frontend runs on non-default ports (e.g. 3001).
const baseURL =
  process.env.NODE_ENV === "development" && isLocalBackendURL
    ? "/"
    : configuredBaseURL || "/";

const api = axios.create({
  baseURL,
});

// Attach JWT automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  },
);

export default api;
