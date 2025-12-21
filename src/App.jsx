import React, {useEffect} from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router";
import AOS from "aos";
import AboutPage from "./screens/AboutPage";
import HomePage from "./screens/HomePage";
import LoginPage from "./screens/LoginPage";
import SignUpPage from "./screens/SignUp";
import AdminPanel from "./screens/AdminPanel";
import PlayerReport from "./screens/PlayerReport";
import AnalyticsPage from "./screens/Analytics";
import RevenueDashboard from "./screens/RevenueDashboard/RevenueDashboard";

const App = () => {

    useEffect(() => {
        AOS.init();
    }, []);
    
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/signup" element={<SignUpPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/admin" element={<AdminPanel />} />
                <Route path="/report/:uid" element={<PlayerReport />} />
                <Route path="/admin/analytics" element={<AnalyticsPage />} />
                <Route path="/revenue" element={<RevenueDashboard />} />
            </Routes>
        </BrowserRouter>
    );
};

export default App;
