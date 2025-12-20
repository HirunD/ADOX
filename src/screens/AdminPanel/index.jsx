import React, { useState, useEffect, useRef } from "react";
import QrScanner from "qr-scanner"; 
import { db } from "../../firebase";
import { doc, getDoc } from "firebase/firestore";

const AdminPanel = () => {
    const [isAdmin, setIsAdmin] = useState(false);
    const [password, setPassword] = useState("");
    const [userData, setUserData] = useState(null);
    const [error, setError] = useState("");
    
    const videoRef = useRef(null);
    const scannerRef = useRef(null);

    // 1. Check Admin Password
    const handleLogin = (e) => {
        e.preventDefault();
        if (password === import.meta.env.VITE_ADMIN_PASSWORD) {
            setIsAdmin(true);
        } else {
            setError("Incorrect password");
        }
    };

    // 2. Start/Stop Scanner
    useEffect(() => {
        if (isAdmin && videoRef.current) {
            scannerRef.current = new QrScanner(
                videoRef.current,
                (result) => handleScan(result.data),
                { 
                    highlightScanRegion: true, // Draws a yellow box over the QR
                    highlightCodeOutline: true 
                }
            );
            scannerRef.current.start();
        }

        return () => {
            if (scannerRef.current) {
                scannerRef.current.stop();
                scannerRef.current.destroy();
            }
        };
    }, [isAdmin]);

    const handleScan = async (data) => {
        try {
            const parsed = JSON.parse(data);
            const userDoc = await getDoc(doc(db, "users", parsed.uid));
            if (userDoc.exists()) {
                setUserData(userDoc.data());
                setError("");
            }
        } catch (err) {
            console.error("Scan error:", err);
        }
    };

    if (!isAdmin) {
        return (
            <div className="section">
                <form className="box" style={{maxWidth: '400px', margin: 'auto'}} onSubmit={handleLogin}>
                    <h1 className="title">Admin Login</h1>
                    <input className="input mb-3" type="password" onChange={(e) => setPassword(e.target.value)} />
                    <button className="button is-primary is-fullwidth">Login</button>
                    {error && <p className="help is-danger">{error}</p>}
                </form>
            </div>
        );
    }

    return (
        <div className="section">
            <div className="container">
                <div className="columns">
                    <div className="column is-6">
                        <div className="box">
                            <h2 className="subtitle">Scanner</h2>
                            {/* The Scanner needs a raw video element */}
                            <video ref={videoRef} style={{ width: '100%', borderRadius: '8px' }}></video>
                        </div>
                    </div>
                    <div className="column is-6">
                        {userData ? (
                            <div className="box has-background-primary-light">
                                <h2 className="title is-4">{userData.fullName}</h2>
                                <p><strong>Age:</strong> {userData.age}</p>
                                <p><strong>School:</strong> {userData.school}</p>
                                <p><strong>Phone:</strong> {userData.phone}</p>
                                <button className="button is-small mt-3" onClick={() => setUserData(null)}>Clear</button>
                            </div>
                        ) : (
                            <p className="notification">Awaiting QR scan...</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminPanel;