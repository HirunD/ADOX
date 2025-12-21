import React, { useState, useEffect } from "react";
import { auth, db } from "../../firebase";
import { onAuthStateChanged, signOut, updateProfile } from "firebase/auth";
import { doc, onSnapshot, updateDoc, collection, query, where } from "firebase/firestore";
import QRCode from "react-qr-code";
import { Link } from "react-router-dom";

const HomePage = () => {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [points, setPoints] = useState(0);
    const [showSettings, setShowSettings] = useState(false);
    const [occupiedMachines, setOccupiedMachines] = useState(0);
    const TOTAL_MACHINES = 3;

    const avatars = ["1.png", "2.png", "3.png", "4.png", "5.png", "6.png"];

    // --- NEW: LOGIC TO CALCULATE ACTIVE USERS ---
    useEffect(() => {
        const usersRef = collection(db, "users");
        // We listen to all users to see who is currently playing
        const unsubscribe = onSnapshot(usersRef, (snapshot) => {
            let activeCount = 0;
            const now = new Date();

            snapshot.forEach((userDoc) => {
                const data = userDoc.data();
                if (data.sessions && data.sessions.length > 0) {
                    // Get the very last session added
                    const lastSession = data.sessions[data.sessions.length - 1];
                    const startTime = new Date(lastSession.startTime);
                    const durationHours = parseFloat(lastSession.duration);
                    const endTime = new Date(startTime.getTime() + durationHours * 60 * 60 * 1000);

                    // If current time is before the end of their session, they are occupying a machine
                    if (now < endTime) {
                        activeCount++;
                    }
                }
            });
            setOccupiedMachines(activeCount > TOTAL_MACHINES ? TOTAL_MACHINES : activeCount);
        });
        return () => unsubscribe();
    }, []);

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

    const changeAvatar = async (imgName) => {
        if (!user) return;
        try {
            await updateDoc(doc(db, "users", user.uid), { avatar: imgName });
            await updateProfile(user, { photoURL: `/avatars/${imgName}` });
            setShowSettings(false);
        } catch (err) { console.error(err); }
    };

    const handleLogout = () => signOut(auth);

    const containerStyle = { background: '#050505', minHeight: '100vh' };
    const cardStyle = { background: '#121212', border: '1px solid #222', borderRadius: '24px', color: 'white' };
    
    // --- UI COMPONENTS ---
    const MachineStatus = () => (
        <div className="box mb-5" style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '20px' }}>
            <div className="level is-mobile mb-0">
                <div className="level-item has-text-centered">
                    <div>
                        <p className="heading has-text-grey">Live Station Availability</p>
                        <p className={`title is-3 ${occupiedMachines < TOTAL_MACHINES ? 'has-text-success' : 'has-text-danger'}`}>
                            {TOTAL_MACHINES - occupiedMachines} / {TOTAL_MACHINES}
                        </p>
                        <p className="is-size-7 has-text-grey-light">Machines Available Now</p>
                    </div>
                </div>
            </div>
            {/* Visual machine dots */}
            <div className="mt-3 is-flex is-justify-content-center">
                {[...Array(TOTAL_MACHINES)].map((_, i) => (
                    <div key={i} style={{
                        width: '12px', height: '12px', borderRadius: '50%', margin: '0 5px',
                        background: i < occupiedMachines ? '#ff3860' : '#00d1b2',
                        boxShadow: i < occupiedMachines ? '0 0 8px #ff3860' : '0 0 8px #00d1b2'
                    }}></div>
                ))}
            </div>
        </div>
    );

    if (!user) {
        return (
            <section className="section" style={containerStyle}>
                <div className="container mt-6">
                    <div className="columns is-centered">
                        <div className="column is-4">
                            <MachineStatus />
                            <div className="box has-text-centered" style={{ background: '#121212', border: '1px solid #333', color: 'white' }}>
                                <p className="subtitle has-text-grey-light">Join ADOX Gaming</p>
                                <Link to="/login" className="button is-primary is-fullwidth">Login to your Pass</Link>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="section" style={containerStyle}>
            <div className="container">
                <div className="columns is-centered">
                    <div className="column is-4">
                        
                        <MachineStatus />

                        {/* PROFILE HEADER */}
                        <div className="mb-6 has-text-centered">
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                                <figure className="image is-96x96 mb-3">
                                    <img className="is-rounded" src={userData?.avatar ? `/avatars/${userData.avatar}` : "/avatars/1.png"} alt="Avatar" style={{ border: '3px solid #00d1b2', padding: '3px', background: '#121212' }} />
                                </figure>
                                <button onClick={() => setShowSettings(!showSettings)} className="button is-primary is-small is-rounded" style={{ position: 'absolute', bottom: '15px', right: '-5px', height: '28px', width: '28px', border: '2px solid #050505' }}>✎</button>
                            </div>
                            <h1 className="title is-4 has-text-white mb-1">Welcome, {userData?.fullName?.split(' ')[0] || "Player"}</h1>
                        </div>

                        {showSettings && (
                            <div className="box mb-5" style={{ background: '#1a1a1a', border: '1px solid #00d1b2' }}>
                                <p className="label has-text-white is-size-7 mb-3">SELECT CHARACTER</p>
                                <div className="columns is-multiline is-mobile">
                                    {avatars.map((img) => (
                                        <div key={img} className="column is-4">
                                            <img src={`/avatars/${img}`} className="is-rounded" style={{ cursor: 'pointer' }} onClick={() => changeAvatar(img)} />
                                        </div>
                                    ))}
                                </div>
                                <button className="button is-dark is-fullwidth is-small mt-2" onClick={() => setShowSettings(false)}>Cancel</button>
                            </div>
                        )}
                        
                        {!showSettings && (
                            <>
                                <div className="card mb-5" style={cardStyle}>
                                    <div className="card-content has-text-centered">
                                        <div className="mb-4">
                                            <span className="tag is-dark" style={{ background: '#252525', letterSpacing: '2px' }}>GAMER ID</span>
                                        </div>
                                        <div style={{ background: 'white', padding: '12px', display: 'inline-block', borderRadius: '12px' }}>
                                            <QRCode value={JSON.stringify({ uid: user.uid })} size={200} level="H" />
                                        </div>
                                        <div className="mt-5 has-text-left">
                                            <div className="columns is-mobile is-vcentered">
                                                <div className="column">
                                                    <p className="is-size-7 has-text-grey">FULL NAME</p>
                                                    <p className="is-size-6 has-text-weight-bold has-text-white">{userData?.fullName || "..."}</p>
                                                </div>
                                                <div className="column has-text-right">
                                                    <p className="is-size-7 has-text-grey">ID TAG</p>
                                                    <p className="is-size-6 has-text-weight-bold has-text-white">#{user.uid.substring(0, 5).toUpperCase()}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="box" style={{ background: 'linear-gradient(145deg, #1a1a1a, #0a0a0a)', border: '1px solid #00d1b244', borderRadius: '20px' }}>
                                    <div className="level is-mobile mb-0">
                                        <div className="level-item has-text-centered">
                                            <div>
                                                <p className="heading has-text-grey-light">Total Adox Points</p>
                                                <p className="title is-2 has-text-white mb-1">{points}</p>
                                                <div className="is-size-7 has-text-primary">Play more to earn rewards</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        <button className="button is-text is-fullwidth has-text-grey mt-5" onClick={handleLogout}>Sign Out</button>

                    </div>
                </div>
            </div>
        </section>
    );
};

export default HomePage;