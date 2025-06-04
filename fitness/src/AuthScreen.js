import React, { useState } from 'react';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';

const AuthScreen = () => {
    const [isLoginMode, setIsLoginMode] = useState(true);

    const toggleMode = () => {
        setIsLoginMode(!isLoginMode);
    };

    return (
        <div className="auth-screen">
            <div className="auth-container">
                <div className="auth-header">
                    <div className="logo-large">Fitnessify</div>
                    <p className="tagline">Your Personal Fitness Companion</p>
                </div>

                <div className="auth-content">
                    {isLoginMode ? (
                        <LoginForm onToggleMode={toggleMode} />
                    ) : (
                        <RegisterForm onToggleMode={toggleMode} />
                    )}
                </div>

                <div className="auth-footer">
                    <p>© 2025 Fitnessify. Built with heart for your health.</p>
                </div>
            </div>

            {/* Background decoration */}
            <div className="auth-background">
                <div className="auth-circle auth-circle-1"></div>
                <div className="auth-circle auth-circle-2"></div>
                <div className="auth-circle auth-circle-3"></div>
            </div>
        </div>
    );
};

export default AuthScreen;