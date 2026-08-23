import React, { useState, useEffect } from "react";
import { db } from "../../firebase";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  onSnapshot,
  deleteDoc,
  doc
} from "firebase/firestore";
import { MACHINE_NAMES } from "../../config/stations";

const AdminReservations = () => {
    // --- ADMIN LOCK STATE ---
    // Checks localStorage first so you stay logged in on your device
    const [isAuthenticated, setIsAuthenticated] = useState(localStorage.getItem("adminAuth") === "true");
    const [pin, setPin] = useState("");
    
    // Pulling password from your .env file
    const ADMIN_PIN = import.meta.env.VITE_ADMIN_PASSWORD;

    const [booking, setBooking] = useState({
        customerName: "",
        phone: "",
        date: new Date().toISOString().split('T')[0],
        startTime: "13:00",
        duration: "1",
        machine: "Simulator",
        userId: null 
    });
    const [existingBookings, setExistingBookings] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);

    const MACHINES = MACHINE_NAMES;

    useEffect(() => {
        if (!isAuthenticated) return;
        const q = query(collection(db, "reservations"), where("date", "==", booking.date));
        const unsub = onSnapshot(q, (snap) => {
            const list = [];
            snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
            setExistingBookings(list.sort((a, b) => a.startTime.localeCompare(b.startTime)));
        });
        return () => unsub();
    }, [booking.date, isAuthenticated]);

    // --- PIN CHECK LOGIC ---
    const handleLogin = (e) => {
        e.preventDefault();
        if (pin === ADMIN_PIN) {
            setIsAuthenticated(true);
            localStorage.setItem("adminAuth", "true"); // Remember this device
        } else {
            alert("Access Denied: Incorrect Password");
            setPin("");
        }
    };

    const handleLogout = () => {
        setIsAuthenticated(false);
        localStorage.removeItem("adminAuth");
    };

    const searchUserDatabase = async () => {
        if (!booking.phone) return;
        setSearchLoading(true);
        try {
            const q = query(collection(db, "users"), where("phone", "==", booking.phone));
            const snap = await getDocs(q);
            if (!snap.empty) {
                const userData = snap.docs[0].data();
                setBooking(prev => ({ 
                    ...prev, 
                    customerName: userData.fullName, 
                    userId: snap.docs[0].id 
                }));
            } else {
                alert("New customer (not in database). Booking as Guest.");
                setBooking(prev => ({ ...prev, userId: "GUEST" }));
            }
        } catch (err) {
            console.error("Database search error:", err);
        } finally {
            setSearchLoading(false);
        }
    };

    const handleInput = (e) => {
        setBooking({ ...booking, [e.target.name]: e.target.value });
    };

    const deleteReservation = async (id) => {
        if (window.confirm("Cancel this booking?")) {
            await deleteDoc(doc(db, "reservations", id));
        }
    };

    const saveReservation = async (e) => {
        e.preventDefault();
        setLoading(true);

        const isConflict = existingBookings.some(b => 
            b.machine === booking.machine && b.startTime === booking.startTime
        );

        if (isConflict) {
            alert("⚠️ Machine already booked for this time!");
            setLoading(false);
            return;
        }

        try {
            await addDoc(collection(db, "reservations"), {
                ...booking,
                createdAt: new Date().toISOString(),
                status: "booked"
            });
            alert("✅ Reservation Saved!");
            setBooking({ ...booking, customerName: "", phone: "", userId: null });
        } catch (err) {
            alert("Error saving reservation");
        }
        setLoading(false);
    };

    // --- 1. RENDER LOCK SCREEN ---
    if (!isAuthenticated) {
        return (
            <div style={{ background: "#050505", height: "100vh", display: "flex", justifyContent: "center", alignItems: "center", padding: "20px" }}>
                <div style={{ background: "#161616", padding: "30px", borderRadius: "20px", border: "1px solid #222", width: "100%", maxWidth: "350px", textAlign: "center" }}>
                    <h2 className="title is-5 has-text-white mb-5">Admin Login</h2>
                    <form onSubmit={handleLogin}>
                        <input 
                            className="input is-dark has-text-centered mb-4" 
                            type="password" 
                            placeholder="Enter Admin Password" 
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                            autoFocus
                        />
                        <button className="button is-primary is-fullwidth has-text-weight-bold">UNLOCK PANEL</button>
                    </form>
                </div>
            </div>
        );
    }

    // --- 2. RENDER MAIN PAGE ---
    return (
        <section style={{ 
            background: "#050505", 
            minHeight: "100vh", 
            color: "white", 
            display: "block", 
            width: "100%",
            padding: "20px 10px"
        }}>
            <div style={{ maxWidth: "450px", margin: "0 auto" }}>
                
                {/* HEADER */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "25px" }}>
                    <div>
                        <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", color: "white", margin: "0" }}>Bookings</h1>
                        <p style={{ fontSize: "0.85rem", color: "#888" }}>Manage phone-in reservations</p>
                    </div>
                    <button 
                        className="button is-dark is-small" 
                        onClick={handleLogout}
                        style={{ borderRadius: '8px' }}
                    >
                        Logout
                    </button>
                </div>

                {/* FORM BOX */}
                <div style={{ 
                    background: "#161616", 
                    padding: "20px", 
                    borderRadius: "15px", 
                    border: "1px solid #222",
                    marginBottom: "30px" 
                }}>
                    <div className="field">
                        <label className="label is-size-7 has-text-grey-light">Search Customer Phone</label>
                        <div className="field has-addons">
                            <div className="control is-expanded">
                                <input className="input is-dark" type="tel" name="phone" placeholder="07..." value={booking.phone} onChange={handleInput} />
                            </div>
                            <div className="control">
                                <button type="button" className={`button is-info ${searchLoading ? 'is-loading' : ''}`} onClick={searchUserDatabase}>SEARCH</button>
                            </div>
                        </div>
                    </div>

                    <form onSubmit={saveReservation}>
                        <div className="field">
                            <label className="label is-size-7 has-text-grey-light">Full Name</label>
                            <input className="input is-dark" name="customerName" required value={booking.customerName} onChange={handleInput} placeholder="Guest name" />
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "15px" }}>
                            <div>
                                <label className="label is-size-7 has-text-grey-light">Date</label>
                                <input className="input is-dark" type="date" name="date" value={booking.date} onChange={handleInput} />
                            </div>
                            <div>
                                <label className="label is-size-7 has-text-grey-light">Start Time</label>
                                <input className="input is-dark" type="time" name="startTime" value={booking.startTime} onChange={handleInput} />
                            </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px", marginBottom: "15px" }}>
                            <div>
                                <label className="label is-size-7 has-text-grey-light">Machine</label>
                                <div className="select is-dark is-fullwidth">
                                    <select name="machine" value={booking.machine} onChange={handleInput}>
                                        {MACHINES.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="label is-size-7 has-text-grey-light">Hrs</label>
                                <input className="input is-dark" type="number" name="duration" step="0.5" value={booking.duration} onChange={handleInput} />
                            </div>
                        </div>

                        <button className={`button is-primary is-fullwidth is-medium has-text-weight-bold ${loading ? 'is-loading' : ''}`} style={{ borderRadius: '10px' }}>
                            CONFIRM BOOKING
                        </button>
                    </form>
                </div>

                {/* SCHEDULE LIST */}
                <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
                        <h3 style={{ fontSize: "0.9rem", color: "#888" }}>Schedule: {booking.date}</h3>
                        <span className="tag is-dark is-rounded">{existingBookings.length}</span>
                    </div>

                    {existingBookings.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "40px 0", border: "2px dashed #222", borderRadius: "15px" }}>
                            <p style={{ color: "#444", fontSize: "0.8rem" }}>No bookings for this date.</p>
                        </div>
                    ) : (
                        existingBookings.map(res => (
                            <div key={res.id} style={{ 
                                background: "#111", 
                                border: "1px solid #222", 
                                borderRadius: "12px", 
                                padding: "12px", 
                                marginBottom: "10px",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center"
                            }}>
                                <div>
                                    <div style={{ display: "flex", alignItems: "center", marginBottom: "2px" }}>
                                        <b style={{ color: "white", fontSize: "0.95rem" }}>{res.startTime}</b>
                                        <span style={{ margin: "0 8px", color: "#333" }}>|</span>
                                        <span style={{ color: "#00d1b2", fontSize: "0.8rem", fontWeight: "bold" }}>{res.machine}</span>
                                    </div>
                                    <p style={{ fontSize: "0.8rem", color: "#aaa", margin: "0" }}>
                                        {res.customerName} <span style={{ color: "#555" }}>• {res.phone}</span>
                                    </p>
                                </div>
                                <button className="button is-danger is-light is-small" onClick={() => deleteReservation(res.id)}>✕</button>
                            </div>
                        ))
                    )}
                </div>
            </div>
            <div style={{ height: "60px" }}></div>
        </section>
    );
};

export default AdminReservations;