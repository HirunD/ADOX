import React, { useState } from "react";
import { auth, db } from "../../firebase"; 
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore"; 
import { useNavigate, Link } from "react-router-dom";

const SignUpPage = () => {
    const [formData, setFormData] = useState({
        fullName: "",
        email: "",
        password: "",
        age: "",
        school: "",
        phone: "",
        isVerified: false
    });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value
        }));
    };

    const handleSignUp = async (e) => {
        e.preventDefault();
        
        // Manual validation check
        if (!formData.fullName || !formData.email || !formData.password || !formData.age) {
            setError("Please fill in all required fields (Name, Email, Password, and Age).");
            return;
        }

        if (!formData.isVerified) return;

        setLoading(true);
        setError("");

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
            const user = userCredential.user;

            await updateProfile(user, { displayName: formData.fullName });

            // Saving to Firestore
            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                fullName: formData.fullName,
                email: formData.email,
                age: Number(formData.age), // Convert age to a number
                school: formData.school,
                phone: formData.phone,
                createdAt: new Date().toISOString()
            });

            navigate("/"); 
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <section className="section">
            <div className="container">
                <div className="columns is-centered">
                    <div className="column is-5">
                        <form className="box p-5" onSubmit={handleSignUp}>
                            <h1 className="title has-text-centered">Create Account</h1>

                            {error && <div className="notification is-danger is-light p-2">{error}</div>}

                            {/* REQUIRED: Full Name */}
                            <div className="field">
                                <label className="label">Full Name *</label>
                                <div className="control">
                                    <input className="input" type="text" name="fullName" onChange={handleChange} required />
                                </div>
                            </div>

                            <div className="columns">
                                <div className="column">
                                    {/* REQUIRED: Age */}
                                    <div className="field">
                                        <label className="label">Age *</label>
                                        <input className="input" type="number" name="age" onChange={handleChange} required />
                                    </div>
                                </div>
                                <div className="column">
                                    {/* OPTIONAL: Phone */}
                                    <div className="field">
                                        <label className="label">Phone</label>
                                        <input className="input" type="tel" name="phone" onChange={handleChange} />
                                    </div>
                                </div>
                            </div>

                            {/* OPTIONAL: School */}
                            <div className="field">
                                <label className="label">School</label>
                                <input className="input" type="text" name="school" onChange={handleChange} />
                            </div>

                            {/* REQUIRED: Email */}
                            <div className="field">
                                <label className="label">Email *</label>
                                <input className="input" type="email" name="email" onChange={handleChange} required />
                            </div>

                            {/* REQUIRED: Password */}
                            <div className="field">
                                <label className="label">Password *</label>
                                <input className="input" type="password" name="password" onChange={handleChange} required minLength="6" />
                            </div>

                            <div className="field mt-4">
                                <div className="control">
                                    <label className="checkbox">
                                        <input 
                                            type="checkbox" 
                                            name="isVerified" 
                                            onChange={handleChange} 
                                            className="mr-2"
                                        />
                                        I verify that this information is correct.
                                    </label>
                                </div>
                            </div>

                            <button 
                                className={`button is-primary is-fullwidth mt-4 ${loading ? 'is-loading' : ''}`} 
                                type="submit"
                                disabled={!formData.isVerified || loading}
                            >
                                Register
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default SignUpPage;