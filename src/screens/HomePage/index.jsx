import React, { useState, useEffect } from "react";
import { auth, db } from "../../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import QRCode from "react-qr-code";
import { Link } from "react-router";

const HomePage = () => {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [points, setPoints] = useState(0);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (user) {
            const userRef = doc(db, "users", user.uid);
            const unsubscribe = onSnapshot(userRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setUserData(data); 
                    
                    const sessions = data.sessions || [];
                    const totalHours = sessions.reduce((acc, s) => acc + (parseFloat(s.duration) || 0), 0);
                    setPoints(totalHours * 2);
                }
            });
            return () => unsubscribe();
        }
    }, [user]);

    const handleLogout = () => signOut(auth);

    // Style for the background image
    const backgroundStyle = {
        backgroundImage: 'url("/wallpaper.jpg")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        minHeight: '100vh',
    };

    // Glassmorphism effect for dark theme cards
    const glassCard = {
        background: 'rgba(20, 20, 20, 0.37)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '20px',
        color: 'white'
    };

    if (!user) {
        return (
            <section className="section has-text-centered" style={backgroundStyle}>
                <div className="box" style={{maxWidth: '400px', margin: 'auto', background: 'rgba(0,0,0,0.7)', color: 'white'}}>
                    <p className="subtitle has-text-white">Please log in to see your Pass.</p>
                    <Link to="/login" className="button is-primary">Go to Login</Link>
                </div>
            </section>
        );
    }

    const qrData = JSON.stringify({ uid: user.uid });

    return (
        <section className="section" style={backgroundStyle}>
            <div className="container">
                <div className="columns is-centered">
                    <div className="column is-4">
                        
                        {/* WELCOME HEADER (Dark Mode) */}
                        <div className="mb-5 has-text-centered">
                            <h1 className="title is-3 has-text-white">Welcome to ADOX</h1>
                            <p className="subtitle is-5 has-text-primary has-text-weight-bold">
                                {userData ? userData.fullName : "Player"}
                            </p>
                        </div>
                        
                        {/* MAIN QR CARD (Dark Mode) */}
                        <div className="card mb-4" style={glassCard}>
                            <div className="card-content has-text-centered">
                                <h2 className="heading has-text-grey-light mb-4">YOUR DIGITAL PASS</h2>
                                
                                <div style={{ background: 'white', padding: '12px', display: 'inline-block', borderRadius: '15px' }}>
                                    <QRCode 
                                        value={qrData} 
                                        size={220}
                                        level="H"
                                    />
                                </div>

                                <div className="mt-5 has-text-left">
                                    <div className="columns is-mobile is-vcentered">
                                        <div className="column">
                                            <p className="is-size-7 has-text-grey-light">PLAYER NAME</p>
                                            <p className="is-size-6 has-text-weight-bold has-text-white">{userData?.fullName || "..."}</p>
                                        </div>
                                        <div className="column has-text-right">
                                            <p className="is-size-7 has-text-grey-light">UID</p>
                                            <p className="is-size-6 has-text-weight-bold has-text-white">{user.uid.substring(0, 8).toUpperCase()}</p>
                                        </div>
                                    </div>
                                    <div className="mt-2">
                                        <p className="is-size-7 has-text-grey-light">EMAIL ADDRESS</p>
                                        <p className="is-size-6 has-text-white">{user.email}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* SEPARATE POINTS BOX (Brilliant Contrast) */}
                        <div className="box shadow" style={{ 
                            background: 'linear-gradient(135deg, #000000ff 0%, #272727ff 100%)',
                            border: 'none',
                            borderRadius: '20px' 
                        }}>
                            <nav className="level is-mobile">
                                <div className="level-item has-text-centered">
                                    <div>
                                        <p className="heading has-text-white" style={{ opacity: 0.9 }}>Current Balance</p>
                                        <p className="title is-1 has-text-white">{points}</p>
                                        <p className="subtitle is-6 has-text-white has-text-weight-bold">ADOX POINTS</p>
                                    </div>
                                </div>
                            </nav>
                        </div>

                        {/* LOGOUT BUTTON */}
                        <button 
                            className="button is-ghost is-fullwidth has-text-grey-light mt-2" 
                            onClick={handleLogout}
                        >
                            Sign Out
                        </button>

                    </div>
                </div>
            </div>
        </section>
    );
};

export default HomePage;