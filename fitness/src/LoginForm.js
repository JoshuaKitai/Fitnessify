import React, { useState } from 'react';
import { useAuth } from './AuthContext';

const LoginForm = ({ onToggleMode }) => {
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login } = useAuth();

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        setError(''); // Clear error when user types
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const result = await login(formData.email, formData.password);

        if (!result.success) {
            setError(result.error);
        }

        setLoading(false);
    };

    return (
        <div className="auth-form">
            <h2>Welcome Back!</h2>
            <p className="auth-subtitle">Sign in to continue your fitness journey</p>

            {error && <div className="error">{error}</div>}

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Email Address</label>
                    <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="Enter your email"
                        required
                        disabled={loading}
                    />
                </div>

                <div className="form-group">
                    <label>Password</label>
                    <input
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="Enter your password"
                        required
                        disabled={loading}
                        minLength="6"
                    />
                </div>

                <button
                    type="submit"
                    className="btn-primary auth-button"
                    disabled={loading}
                >
                    {loading ? 'Signing In...' : 'Sign In'}
                </button>
            </form>

            <div className="auth-switch">
                <p>Don't have an account?
                    <button
                        type="button"
                        className="link-button"
                        onClick={onToggleMode}
                        disabled={loading}
                    >
                        Sign Up
                    </button>
                </p>
            </div>
        </div>
    );
};

export default LoginForm;