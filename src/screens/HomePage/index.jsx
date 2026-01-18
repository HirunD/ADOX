import React, { useState, useEffect } from "react";
import { auth, db } from "../../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot, collection, query, where } from "firebase/firestore";
import QRCode from "react-qr-code";
import { Link } from "react-router-dom";

const customStyles = `
  body { background-color: #080808; margin: 0; padding: 0; }
  
  .scroll-container {
    height: 100vh;
    overflow-y: auto;
    padding: 20px 15px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .scroll-container::-webkit-scrollbar { display: none; }

  .interface-box {
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    width: 100%;
    max-width: 400px;
    margin-bottom: 12px;
    padding: 20px;
    box-sizing: border-box;
  }

  .stat-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    width: 100%;
    max-width: 400px;
    margin-bottom: 12px;
  }

  .stat-box {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    padding: 15px;
    text-align: center;
  }

  .action-btn {
    width: 100%;
    border: none;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    text-decoration: none;
  }

  .booking-row {
    padding: 8px 0;
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }
  .booking-row:last-child { border-bottom: none; }
`;

const HomePage = () => {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [points, setPoints] = useState(0);
    const [occupiedMachines, setOccupiedMachines] = useState(0);
    const [authLoading, setAuthLoading] = useState(true);
    
    // Activity States
    const [activeSession, setActiveSession] = useState(null);
    const [allReservations, setAllReservations] = useState([]);
    
    const TOTAL_MACHINES = 3;

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setAuthLoading(false);
        });
        return () => unsubscribeAuth();
    }, []);

    useEffect(() => {
        if (!user) return;

        // 1. User Profile & Personal Active Session
        const unsubUser = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setUserData(data); 
                const hrs = (data.sessions || []).reduce((acc, s) => acc + (parseFloat(s.duration) || 0), 0);
                setPoints(hrs * 2);

                const now = new Date();
                const live = (data.sessions || []).find(s => {
                    const start = new Date(s.startTime);
                    const end = new Date(start.getTime() + (parseFloat(s.duration) * 60 * 60 * 1000));
                    return now >= start && now < end;
                });
                setActiveSession(live || null);
            }
        });

        // 2. Global Reservations (Show to EVERYONE)
        const today = new Date().toISOString().split('T')[0];
        const qRes = query(collection(db, "reservations"), where("date", "==", today));
        const unsubRes = onSnapshot(qRes, (snap) => {
            const list = [];
            snap.forEach(d => list.push(d.data()));
            // Sort by time
            setAllReservations(list.sort((a,b) => a.startTime.localeCompare(b.startTime)));
        });

        // 3. Global Occupancy (Live Machine Count)
        const unsubGlobal = onSnapshot(collection(db, "users"), (snapshot) => {
            let activeCount = 0;
            const now = new Date();
            snapshot.forEach((userDoc) => {
                const data = userDoc.data();
                if (data.sessions) {
                    data.sessions.forEach(s => {
                        const start = new Date(s.startTime);
                        const end = new Date(start.getTime() + (parseFloat(s.duration) * 60 * 60 * 1000));
                        if (now >= start && now < end) activeCount++;
                    });
                }
            });
            setOccupiedMachines(activeCount > TOTAL_MACHINES ? TOTAL_MACHINES : activeCount);
        });

        return () => { unsubUser(); unsubRes(); unsubGlobal(); };
    }, [user]);

    if (authLoading) {
        return (
            <div className="scroll-container">
                <style>{customStyles}</style>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                    <div className="has-text-centered">
                        <i className="fas fa-spinner fa-spin has-text-primary" style={{ fontSize: '2rem' }}></i>
                        <p className="has-text-grey mt-3">Loading...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="scroll-container">
                <style>{customStyles}</style>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', padding: '20px' }}>
                    <img src="/logo.png" alt="Logo" style={{ width: "120px", marginBottom: '20px' }} />
                    <p className="has-text-grey mb-4">Please log in to access your dashboard</p>
                    <Link to="/login" className="button is-primary">Go to Login</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="scroll-container">
            <style>{customStyles}</style>

            <div className="has-text-centered mb-5">
                <img src="/logo.png" alt="Logo" style={{ width: "120px" }} />
            </div>

            {/* USER PROFILE BOX */}
            <div className="interface-box is-flex is-align-items-center is-justify-content-between">
                <div>
                    <p className="has-text-grey is-size-7 is-uppercase mb-1">Active Pilot</p>
                    <h1 className="title is-5 has-text-white mb-0">{userData?.fullName?.split(' ')[0] || 'Guest'}</h1>
                    <p className="is-size-7 has-text-primary">ID: #{user.uid.substring(0, 5).toUpperCase()}</p>
                </div>
                <figure className="image is-48x48">
                    <img className="is-rounded" src={userData?.avatar ? `/avatars/${userData.avatar}` : "/avatars/1.png"} style={{ border: '2px solid #00d1b2' }} alt="profile" />
                </figure>
            </div>

            {/* STATS ROW */}
            <div className="stat-grid">
                <div className="stat-box">
                    <p className="is-size-7 has-text-grey-light mb-1">FREE SLOTS</p>
                    <p className="is-size-3 has-text-weight-bold has-text-success">{TOTAL_MACHINES - occupiedMachines}</p>
                </div>
                <div className="stat-box">
                    <p className="is-size-7 has-text-grey-light mb-1">XP POINTS</p>
                    <p className="is-size-3 has-text-weight-bold has-text-white">{points}</p>
                </div>
            </div>

            {/* TRACK ACTIVITY BOX (SCHEDULE) */}
            <div className="interface-box">
                <p className="is-size-7 has-text-grey is-uppercase mb-3">Today's Schedule</p>
                
                {/* 1. Show User's Personal Active Session first if they are playing */}
                {activeSession && (
                    <div className="notification is-success is-light p-2 mb-3" style={{ borderRadius: '12px' }}>
                        <p className="is-size-7 has-text-centered"><b>YOU ARE LIVE ⚡</b> {activeSession.machine}</p>
                    </div>
                )}

                {/* 2. Show all reservations so users know when machines are taken */}
                {allReservations.length > 0 ? (
                    allReservations.map((res, i) => {
                        const isMine = userData?.phone === res.phone;
                        return (
                            <div key={i} className="is-flex is-justify-content-between is-align-items-center booking-row">
                                <div>
                                    <p className={`is-size-7 ${isMine ? 'has-text-primary has-text-weight-bold' : 'has-text-white'}`}>
                                        {res.startTime} - {isMine ? "Your Booking" : "Reserved"}
                                    </p>
                                    <p className="is-size-7 has-text-grey">{res.machine}</p>
                                </div>
                                <span className={`tag is-rounded is-small ${isMine ? 'is-primary' : 'is-dark'}`}>
                                    {res.duration} Hr
                                </span>
                            </div>
                        );
                    })
                ) : (
                    <p className="is-size-7 has-text-grey">No reservations for today. Machines available!</p>
                )}
            </div>

            {/* MEMBER QR BOX */}
            <div className="interface-box has-text-centered">
                <p className="is-size-7 has-text-grey is-uppercase mb-3">Identity Pass</p>
                <div style={{ background: 'white', padding: '10px', display: 'inline-block', borderRadius: '12px' }}>
                    <QRCode value={JSON.stringify({ uid: user.uid })} size={140} />
                </div>
            </div>

            {/* LEADERBOARD LINK */}
            <Link to="/leaderboard" className="interface-box action-btn" style={{ background: 'rgba(0, 209, 178, 0.05)' }}>
                <div>
                    <p className="title is-6 has-text-white mb-1">Global Rankings</p>
                    <p className="is-size-7 has-text-primary">Tap to view leaderboard</p>
                </div>
                <i className="fas fa-chevron-right has-text-grey"></i>
            </Link>

            {/* SIGN OUT */}
            <div className="interface-box action-btn" onClick={() => signOut(auth)} style={{ cursor: 'pointer', border: '1px solid rgba(255, 56, 96, 0.2)' }}>
                <div>
                    <p className="title is-6 has-text-danger mb-1">SIGN OUT</p>
                </div>
                <i className="fas fa-sign-out-alt has-text-danger" style={{ opacity: 0.5 }}></i>
            </div>
            
            <div style={{ height: '40px' }}></div>
        </div>
    );
};

export default HomePage;