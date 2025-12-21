import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../../firebase";
import { doc, getDoc } from "firebase/firestore";

const PlayerReport = () => {
    const { uid } = useParams();
    const navigate = useNavigate();
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            const userDoc = await getDoc(doc(db, "users", uid));
            if (userDoc.exists()) {
                setUserData(userDoc.data());
            }
            setLoading(false);
        };
        fetchData();
    }, [uid]);

    if (loading) return <div className="section has-text-centered"><button className="button is-loading is-ghost">Loading</button></div>;
    if (!userData) return <div className="notification is-danger">Player not found.</div>;

    // Filter sessions for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const monthlySessions = (userData.sessions || [])
        .filter(s => new Date(s.startTime) >= thirtyDaysAgo)
        .sort((a, b) => new Date(b.startTime) - new Date(a.startTime)); // Newest first

    const totalHours = monthlySessions.reduce((acc, s) => acc + parseFloat(s.duration), 0);

    return (
        <section className="section has-background-white-bis" style={{ minHeight: '100vh' }}>
            <div className="container" style={{ maxWidth: '800px' }}>
                {/* Header Controls */}
                <div className="level is-mobile mb-5">
                    <div className="level-left">
                        <button className="button is-small" onClick={() => navigate(-1)}>← Back</button>
                    </div>
                    <div className="level-right">
                        <button className="button is-small is-dark" onClick={() => window.print()}>Print PDF</button>
                    </div>
                </div>

                <div className="box p-6">
                    {/* Report Header */}
                    <div className="has-text-centered mb-6">
                        <h1 className="title is-3">PLAYER ACTIVITY REPORT</h1>
                        <p className="subtitle is-6 has-text-grey">Last 30 Days Summary</p>
                        <hr />
                    </div>

                    {/* Player Identity */}
                    <div className="columns mb-5">
                        <div className="column">
                            <p className="heading has-text-grey">Player Name</p>
                            <p className="title is-4">{userData.fullName}</p>
                            <p className="is-size-7"><strong>UID:</strong> {userData.uid}</p>
                        </div>
                        <div className="column has-text-right-tablet">
                            <p className="heading has-text-grey">Total Playtime</p>
                            <p className="title is-3 has-text-link">{totalHours} Hours</p>
                        </div>
                    </div>

                    {/* Summary Statistics */}
                    <nav className="level has-background-light p-4" style={{ borderRadius: '8px' }}>
                        <div className="level-item has-text-centered">
                            <div>
                                <p className="heading">School</p>
                                <p className="subtitle is-6">{userData.school || "N/A"}</p>
                            </div>
                        </div>
                        <div className="level-item has-text-centered">
                            <div>
                                <p className="heading">Sessions</p>
                                <p className="subtitle is-6">{monthlySessions.length}</p>
                            </div>
                        </div>
                        <div className="level-item has-text-centered">
                            <div>
                                <p className="heading">Contact</p>
                                <p className="subtitle is-6">{userData.phone || "N/A"}</p>
                            </div>
                        </div>
                    </nav>

                    {/* Detailed Log Table */}
                    <h2 className="title is-5 mt-6">Detailed Activity Log</h2>
                    <table className="table is-fullwidth is-striped is-hoverable">
                        <thead>
                            <tr className="has-background-white-ter">
                                <th>Date</th>
                                <th>Start Time</th>
                                <th>Duration</th>
                            </tr>
                        </thead>
                        <tbody>
                            {monthlySessions.length > 0 ? (
                                monthlySessions.map((s, idx) => {
                                    const dateObj = new Date(s.startTime);
                                    return (
                                        <tr key={idx}>
                                            <td>{dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                            <td>{dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                            <td><span className="tag is-info is-light">{s.duration} hr(s)</span></td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="3" className="has-text-centered py-5 has-text-grey">No activity recorded in the last 30 days.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    <div className="mt-6 has-text-centered border-top pt-5">
                        <p className="is-size-7 has-text-grey">Report generated on {new Date().toLocaleString()}</p>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default PlayerReport;