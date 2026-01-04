import React, { useState, useEffect } from "react";
import { db } from "../../firebase"; // Use two dots to exit 'AdminPricing' AND 'screens'
import { doc, updateDoc, onSnapshot } from "firebase/firestore";

const AdminPricing = () => {
    // 1. Initialize with empty objects to prevent Object.keys error
    const [config, setConfig] = useState({
        isPeak: false,
        standard: {},
        peak: {}
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onSnapshot(doc(db, "settings", "pricing"), (docSnap) => {
            if (docSnap.exists()) {
                setConfig(docSnap.data());
            }
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const togglePeak = async () => {
        await updateDoc(doc(db, "settings", "pricing"), { isPeak: !config.isPeak });
    };

    const updateRates = async (type, hours, val) => {
        const newConfig = { ...config };
        newConfig[type][hours] = Number(val);
        await updateDoc(doc(db, "settings", "pricing"), newConfig);
    };

    if (loading) return (
        <div className="section has-text-centered">
            <p className="has-text-white">Loading Pricing Config...</p>
        </div>
    );

    return (
        <div className="section" style={{ background: '#050505', minHeight: '100vh' }}>
            <div className="container" style={{ maxWidth: '600px' }}>
                <div className="box" style={{ background: '#1a1a1a', border: '1px solid #333' }}>
                    <div className="level is-mobile">
                        <div className="level-left">
                            <h1 className="title is-4 has-text-white">Price Management</h1>
                        </div>
                        <div className="level-right">
                            <button 
                                className={`button is-rounded has-text-weight-bold ${config.isPeak ? 'is-danger' : 'is-success'}`}
                                onClick={togglePeak}
                            >
                                {config.isPeak ? "🔥 PEAK MODE ON" : "🟢 STANDARD MODE"}
                            </button>
                        </div>
                    </div>

                    <div className="columns mt-4">
                        {/* STANDARD COLUMN */}
                        <div className="column">
                            <h2 className="subtitle is-6 has-text-primary mb-3">Standard Rates</h2>
                            {Object.keys(config.standard || {}).length > 0 ? Object.keys(config.standard).map(h => (
                                <div className="field" key={h}>
                                    <label className="label is-size-7 has-text-grey">{h} Hour(s)</label>
                                    <div className="control">
                                        <input 
                                            className="input is-small is-dark" 
                                            type="number" 
                                            value={config.standard[h]} 
                                            onChange={(e) => updateRates('standard', h, e.target.value)} 
                                        />
                                    </div>
                                </div>
                            )) : <p className="is-size-7 has-text-grey">No standard rates found.</p>}
                        </div>

                        {/* PEAK COLUMN */}
                        <div className="column" style={{ borderLeft: '1px solid #333' }}>
                            <h2 className="subtitle is-6 has-text-danger mb-3">Peak Rates</h2>
                            {Object.keys(config.peak || {}).length > 0 ? Object.keys(config.peak).map(h => (
                                <div className="field" key={h}>
                                    <label className="label is-size-7 has-text-grey">{h} Hour(s)</label>
                                    <div className="control">
                                        <input 
                                            className="input is-small is-dark" 
                                            type="number" 
                                            value={config.peak[h]} 
                                            onChange={(e) => updateRates('peak', h, e.target.value)} 
                                        />
                                    </div>
                                </div>
                            )) : <p className="is-size-7 has-text-grey">No peak rates found.</p>}
                        </div>
                    </div>
                    
                    <p className="is-size-7 has-text-grey-dark mt-4 has-text-centered">
                        Changes are saved instantly to the database.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AdminPricing;