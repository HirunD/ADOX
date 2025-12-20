import React, { useState, useEffect } from "react";
import { auth } from "../../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import QRCode from "react-qr-code";

const HomePage = () => {
    const [user, setUser] = useState(null);

    // 1. Listen for the logged-in user
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });
        return () => unsubscribe(); // Cleanup
    }, []);

    const handleLogout = () => signOut(auth);

    if (!user) {
        return (
            <section className="section has-text-centered">
                <p className="subtitle">Please log in to see your QR Code.</p>
                <a href="/login" className="button is-primary">Go to Login</a>
            </section>
        );
    }

    // 2. Prepare the data for the QR Code
    // You can stringify an object to store multiple pieces of info
    const qrData = JSON.stringify({
        uid: user.uid,
        email: user.email,
        name: user.displayName || "Anonymous"
    });

    return (
        <section className="section">
            <div className="container">
                <div className="columns is-centered">
                    <div className="column is-4">
                        <div className="card">
                            <div className="card-content has-text-centered">
                                <h2 className="title is-4">Your Digital ID</h2>
                                
                                {/* 3. Generate the QR Code */}
                                <div style={{ background: 'white', padding: '16px', display: 'inline-block' }}>
                                    <QRCode 
                                        value={qrData} 
                                        size={200}
                                        level="H" // High error correction
                                    />
                                </div>

                                <div className="mt-4">
                                    <p><strong>ID:</strong> {user.uid.substring(0, 8)}...</p>
                                    <p><strong>Email:</strong> {user.email}</p>
                                </div>

                                <button 
                                    className="button is-danger is-light is-fullwidth mt-5" 
                                    onClick={handleLogout}
                                >
                                    Log Out
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default HomePage;