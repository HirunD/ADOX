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

const AdminReservations = () => {
    const [booking, setBooking] = useState({
        customerName: "",
        phone: "",
        date: new Date().toISOString().split('T')[0],
        startTime: "13:00",
        duration: "1",
        machine: "Sim Rig",
        userId: null // Stores the UID if they are in your database
    });
    const [existingBookings, setExistingBookings] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);

    const MACHINES = ["Sim Rig", "PS4 #1", "PS4 #2"];

    // 1. Fetch bookings for the selected date to prevent overlaps
    useEffect(() => {
        const q = query(collection(db, "reservations"), where("date", "==", booking.date));
        const unsub = onSnapshot(q, (snap) => {
            const list = [];
            snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
            setExistingBookings(list.sort((a, b) => a.startTime.localeCompare(b.startTime)));
        });
        return () => unsub();
    }, [booking.date]);

    // 2. Search your existing user database by phone
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

        // Conflict check: Same machine, same time
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

    return (
        <section className="section" style={{ background: "#050505", minHeight: "100vh", color: "white" }}>
            <div className="container" style={{ maxWidth: "600px" }}>
                <h1 className="title is-4 has-text-white">Phone-in Reservations</h1>
                
                <div className="box" style={{ background: "#1a1a1a", border: "1px solid #333" }}>
                    {/* PHONE SEARCH (Triggers Number Pad) */}
                    <div className="field">
                        <label className="label has-text-grey-light">Search Customer Phone</label>
                        <div className="field has-addons">
                            <div className="control is-expanded">
                                <input 
                                    className="input is-dark" 
                                    type="tel" 
                                    inputMode="numeric" 
                                    name="phone" 
                                    placeholder="Enter number..." 
                                    value={booking.phone} 
                                    onChange={handleInput} 
                                />
                            </div>
                            <div className="control">
                                <button 
                                    type="button" 
                                    className={`button is-info ${searchLoading ? 'is-loading' : ''}`}
                                    onClick={searchUserDatabase}
                                >
                                    Search DB
                                </button>
                            </div>
                        </div>
                    </div>

                    <form onSubmit={saveReservation}>
                        <div className="field">
                            <label className="label has-text-grey-light">Customer Name</label>
                            <input 
                                className="input is-dark" 
                                name="customerName" 
                                required 
                                value={booking.customerName} 
                                onChange={handleInput} 
                                placeholder={booking.userId ? "" : "Enter name if guest"}
                            />
                        </div>

                        <div className="columns is-mobile">
                            <div className="column">
                                <label className="label is-size-7 has-text-grey-light">Date</label>
                                <input className="input is-dark is-small" type="date" name="date" value={booking.date} onChange={handleInput} />
                            </div>
                            <div className="column">
                                <label className="label is-size-7 has-text-grey-light">Start Time</label>
                                <input className="input is-dark is-small" type="time" name="startTime" value={booking.startTime} onChange={handleInput} />
                            </div>
                        </div>

                        <div className="columns is-mobile">
                            <div className="column">
                                <label className="label is-size-7 has-text-grey-light">Machine</label>
                                <div className="select is-dark is-fullwidth is-small">
                                    <select name="machine" value={booking.machine} onChange={handleInput}>
                                        {MACHINES.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="column">
                                <label className="label is-size-7 has-text-grey-light">Hrs</label>
                                <input className="input is-dark is-small" type="number" name="duration" step="0.5" value={booking.duration} onChange={handleInput} />
                            </div>
                        </div>

                        <button className={`button is-primary is-fullwidth mt-4 ${loading ? 'is-loading' : ''}`}>
                            CONFIRM RESERVATION
                        </button>
                    </form>
                </div>

                {/* TODAY'S SCHEDULE LIST */}
                <div className="mt-6">
                    <h3 className="subtitle is-6 has-text-grey">Bookings for {booking.date}</h3>
                    {existingBookings.length === 0 ? <p className="has-text-grey-dark">Clear for today.</p> : (
                        existingBookings.map(res => (
                            <div key={res.id} className="box mb-2 p-3" style={{ background: "#111", border: "1px solid #222" }}>
                                <div className="is-flex is-justify-content-between is-align-items-center">
                                    <div>
                                        <b className="has-text-primary">{res.startTime}</b> - {res.customerName}
                                        <p className="is-size-7 has-text-grey">{res.phone} | {res.machine}</p>
                                    </div>
                                    <button className="button is-danger is-small is-outlined" onClick={() => deleteReservation(res.id)}>
                                        <span className="icon is-small">✕</span>
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </section>
    );
};

export default AdminReservations;