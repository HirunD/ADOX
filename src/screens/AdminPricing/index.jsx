import React, { useState, useEffect } from "react";
import { db } from "../../firebase";
import { doc, updateDoc, onSnapshot } from "firebase/firestore";

const AdminPricing = () => {
    const [config, setConfig] = useState(null);
    const [editConfig, setEditConfig] = useState(null); // Local state for typing
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const unsub = onSnapshot(doc(db, "settings", "pricing"), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setConfig(data);
                setEditConfig(data); // Sync local edit state with DB
            }
            setLoading(false);
        });
        return () => unsub();
    }, []);

    // Toggle Peak Mode instantly
    const togglePeak = async () => {
        const newStatus = !config.isPeak;
        await updateDoc(doc(db, "settings", "pricing"), { isPeak: newStatus });
    };

    // Handle typing in inputs (updates local state only)
    const handleInputChange = (type, hours, val) => {
        setEditConfig({
            ...editConfig,
            [type]: {
                ...editConfig[type],
                [hours]: Number(val)
            }
        });
    };

    // Save local state to Firestore
    const saveToDatabase = async () => {
        setIsSaving(true);
        try {
            await updateDoc(doc(db, "settings", "pricing"), editConfig);
            alert("Pricing updated successfully!");
        } catch (err) {
            console.error(err);
            alert("Error updating pricing");
        }
        setIsSaving(false);
    };

    if (loading) return (
        <div className="section has-text-centered">
            <div className="button is-loading is-ghost">Loading...</div>
        </div>
    );

    return (
        <div className="section" style={{ background: '#050505', minHeight: '100vh', padding: '1rem' }}>
            <div className="container" style={{ maxWidth: '800px' }}>
                
                {/* HEADER CARD */}
                <div className="box" style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '15px' }}>
                    <div className="level is-mobile">
                        <div className="level-left">
                            <div>
                                <h1 className="title is-4 has-text-white mb-1">Global Pricing</h1>
                                <p className="is-size-7 has-text-grey">Control rates and peak status</p>
                            </div>
                        </div>
                        <div className="level-right">
                            <button 
                                className={`button is-medium is-rounded ${config.isPeak ? 'is-danger' : 'is-success'}`}
                                onClick={togglePeak}
                                style={{ boxShadow: config.isPeak ? '0 0 15px rgba(255, 56, 96, 0.4)' : 'none' }}
                            >
                                <span>{config.isPeak ? "🔥 PEAK ACTIVE" : "🟢 STANDARD"}</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* EDITING GRID */}
                <div className="columns is-multiline">
                    {/* STANDARD RATES */}
                    <div className="column is-6">
                        <div className="box" style={{ background: '#141414', border: '1px solid #222', height: '100%' }}>
                            <h2 className="title is-6 has-text-primary mb-4">Standard Rates (Rs.)</h2>
                            {editConfig.standard && Object.keys(editConfig.standard).map(h => (
                                <div className="field is-horizontal mb-4" key={h}>
                                    <div className="field-label is-small" style={{ flexGrow: 2, textAlign: 'left' }}>
                                        <label className="label has-text-grey-light">{h} Hour(s)</label>
                                    </div>
                                    <div className="field-body">
                                        <div className="control">
                                            <input 
                                                className="input is-dark is-small" 
                                                type="number" 
                                                value={editConfig.standard[h]} 
                                                onChange={(e) => handleInputChange('standard', h, e.target.value)} 
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* PEAK RATES */}
                    <div className="column is-6">
                        <div className="box" style={{ background: '#141414', border: '1px solid #222', height: '100%' }}>
                            <h2 className="title is-6 has-text-danger mb-4">Peak Rates (Rs.)</h2>
                            {editConfig.peak && Object.keys(editConfig.peak).map(h => (
                                <div className="field is-horizontal mb-4" key={h}>
                                    <div className="field-label is-small" style={{ flexGrow: 2, textAlign: 'left' }}>
                                        <label className="label has-text-grey-light">{h} Hour(s)</label>
                                    </div>
                                    <div className="field-body">
                                        <div className="control">
                                            <input 
                                                className="input is-dark is-small" 
                                                type="number" 
                                                value={editConfig.peak[h]} 
                                                onChange={(e) => handleInputChange('peak', h, e.target.value)} 
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* SAVE ACTION */}
                <div className="mt-5">
                    <button 
                        className={`button is-primary is-fullwidth is-large ${isSaving ? 'is-loading' : ''}`}
                        style={{ borderRadius: '12px', fontWeight: 'bold' }}
                        onClick={saveToDatabase}
                        disabled={JSON.stringify(config) === JSON.stringify(editConfig)}
                    >
                        {JSON.stringify(config) === JSON.stringify(editConfig) ? "NO CHANGES DETECTED" : "SAVE ALL CHANGES"}
                    </button>
                    <p className="has-text-centered is-size-7 has-text-grey mt-3">
                        Manual Peak Override is currently: <b>{config.isPeak ? 'ENABLED' : 'DISABLED'}</b>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AdminPricing;