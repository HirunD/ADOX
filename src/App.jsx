import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router";
import AOS from "aos";
import AboutPage from "./screens/AboutPage";
import HomePage from "./screens/HomePage";
import LoginPage from "./screens/LoginPage";
import SignUpPage from "./screens/SignUp";
import AdminPanel from "./screens/AdminPanel";
import PlayerReport from "./screens/PlayerReport";
import AnalyticsPage from "./screens/Analytics";
import RevenueDashboard from "./screens/RevenueDashboard/RevenueDashboard";
import Leaderboard from "./screens/Leaderboard/Leaderboard";
import AdminPricing from "./screens/AdminPricing";
import ComingSoon from "./screens/ComingSoon";

// Import your CSS for the loader (or add to your main CSS file)
import "./App.css"; 

const App = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [isFading, setIsFading] = useState(false);

    useEffect(() => {
        AOS.init();

        // Preloader Logic: Show GIF for 2.5 seconds
        const timer = setTimeout(() => {
            setIsFading(true); // Start the fade-out animation
            setTimeout(() => setIsLoading(false), 400); // Remove from DOM after animation
        }, 2500);

        return () => clearTimeout(timer);
    }, []);

    return (
        <>
            {/* PRELOADER SECTION */}
            {isLoading && (
                <div className={`preloader ${isFading ? "fade-out" : ""}`}>
                    <img src="/preloader.gif" alt="Adox Gaming Loading..." />
                </div>
            )}

            {/* MAIN APP CONTENT */}
            <div className={`app-content ${!isLoading ? "content-visible" : ""}`}>
                <BrowserRouter>
                    <Routes>
                        {/* <Route path="/" element={<ComingSoon />} /> */}
                        <Route path="/home" element={<HomePage />} />
                        <Route path="/signup" element={<SignUpPage />} />
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/admin" element={<AdminPanel />} />
                        <Route path="/report/:uid" element={<PlayerReport />} />
                        <Route path="/admin/analytics" element={<AnalyticsPage />} />
                        <Route path="/revenue" element={<RevenueDashboard />} />
                        <Route path="/leaderboard" element={<Leaderboard />} />
                        <Route path="/price" element={<AdminPricing />} />
                    </Routes>
                </BrowserRouter>
            </div>
        </>
    );
};

export default App;