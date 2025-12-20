import React, {useEffect} from "react";
import { BrowserRouter, Routes, Route } from "react-router";
import AOS from "aos";
import AboutPage from "./screens/AboutPage";
import HomePage from "./screens/HomePage";
import LoginPage from "./screens/LoginPage";
import SignUpPage from "./screens/SignUp";
import AdminPanel from "./screens/AdminPanel";

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
            </Routes>
        </BrowserRouter>
    );
};

export default App;
