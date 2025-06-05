import React, { useEffect, useState, useCallback } from 'react';
import './App.css';
import './Auth.css';
import { AuthProvider, useAuth } from './AuthContext';
import AuthScreen from './AuthScreen';
import CalorieTracker from './CalorieTracker';
import ProgressTracker from './Progress';
import CalendarHistory from './CalendarHistory';
import Goals from './Goals';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const UserMenu = ({ user, onLogout }) => {
    const [isOpen, setIsOpen] = useState(false);

    const getInitials = (name) => {
        return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
    };

    const handleLogout = () => {
        setIsOpen(false);
        onLogout();
    };

    return (
        <div className="user-menu">
            <button
                className="user-menu-button"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="user-avatar">
                    {getInitials(user.username)}
                </div>
                <span>{user.username}</span>
                <span style={{ fontSize: '12px' }}></span>
            </button>

            {isOpen && (
                <div className="user-menu-dropdown">
                    <div className="user-menu-item">
                        <strong>{user.email}</strong>
                    </div>
                    <button
                        className="user-menu-item danger"
                        onClick={handleLogout}
                    >
                        Sign Out
                    </button>
                </div>
            )}
        </div>
    );
};

const Dashboard = () => {
    const [message, setMessage] = useState('');
    const [currentView, setCurrentView] = useState('dashboard');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [stats, setStats] = useState(null);
    const { user, logout } = useAuth();

    const authenticatedFetch = useCallback(async (url, options = {}) => {
        const token = localStorage.getItem('authToken');
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(url, {
            ...options,
            headers
        });

        if (response.status === 401) {
            logout();
            throw new Error('Authentication expired');
        }

        return response;
    }, [logout]);

    const fetchAppData = useCallback(async () => {
        try {
            setLoading(true);

            const [messageRes, statsRes] = await Promise.all([
                fetch(`${API_BASE_URL}/`),
                authenticatedFetch(`${API_BASE_URL}/stats/summary?days=7`)
            ]);

            if (messageRes.ok) {
                const messageData = await messageRes.json();
                setMessage(messageData.message);
            } else {
                setMessage('Tracking Your Goals to Stay Fit');
            }

            if (statsRes.ok) {
                const statsData = await statsRes.json();
                setStats(statsData);
            }

            setError(null);
        } catch (err) {
            if (err.message !== 'Authentication expired') {
                setError('Failed to load app data');
                setMessage('Tracking Your Goals to Stay Fit');
                console.error('Error fetching app data:', err);
            }
        } finally {
            setLoading(false);
        }
    }, [authenticatedFetch]);

    useEffect(() => {
        fetchAppData();
    }, [fetchAppData]);

    const navigationItems = [
        { id: 'dashboard', label: 'Dashboard'},
        { id: 'goals', label: 'Goals'},
        { id: 'history', label: 'History'}
    ];

    const renderCurrentView = () => {
        switch (currentView) {
            case 'goals':
                return <Goals />;
            case 'history':
                return <CalendarHistory />;
            case 'dashboard':
            default:
                return (
                    <>
                        <div className="content-row">
                            <div className="content-left">
                                <CalorieTracker />
                            </div>
                            <div className="content-right">
                                <ProgressTracker />
                            </div>
                        </div>

                        {stats && (
                            <div className="goals-section">
                                <h3>Weekly Summary</h3>
                                <div className="flex" style={{ flexWrap: 'wrap', gap: '20px' }}>
                                    <div className="totals" style={{ flex: 1, minWidth: '200px' }}>
                                        <h4>Nutrition</h4>
                                        <p><strong>Avg Daily Calories:</strong> {stats.nutrition.avg_daily_calories.toFixed(0)} kcal</p>
                                        <p><strong>Total Entries:</strong> {stats.entries_count}</p>
                                        <p><strong>Total Protein:</strong> {stats.nutrition.total_protein.toFixed(0)}g</p>
                                    </div>

                                    {stats.latest_progress && (
                                        <div className="totals" style={{ flex: 1, minWidth: '200px' }}>
                                            <h4>Latest Progress</h4>
                                            <p><strong>Weight:</strong> {stats.latest_progress.person_weight} lbs</p>
                                            <p><strong>Bench:</strong> {stats.latest_progress.bench} lbs</p>
                                            <p><strong>Total Lift:</strong> {(stats.latest_progress.bench + stats.latest_progress.squat + stats.latest_progress.dead_lift)} lbs</p>
                                        </div>
                                    )}

                                    <div className="totals" style={{ flex: 1, minWidth: '200px' }}>
                                        <h4>Activity</h4>
                                        <p><strong>Food Entries:</strong> {stats.entries_count}</p>
                                        <p><strong>Workout Logs:</strong> {stats.progress_entries_count}</p>
                                        <p><strong>Period:</strong> {stats.period}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                );
        }
    };

    return (
        <div className="app">
            <div className="navbar">
                <div className="logo">Fitnessify</div>
                <h1 className="header-title">{message}</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div className="date">
                        {new Date().toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        })}
                    </div>
                    <UserMenu user={user} onLogout={logout} />
                </div>
            </div>

            <div className="goals-section" style={{ padding: '15px 20px', margin: '0 20px 20px 20px' }}>
                <div className="flex gap-10">
                    {navigationItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setCurrentView(item.id)}
                            className={currentView === item.id ? 'btn-primary' : 'btn-secondary'}
                            style={{
                                padding: '10px 20px',
                                fontSize: '14px',
                                fontWeight: currentView === item.id ? 'bold' : 'normal'
                            }}
                        >
                            {item.label}
                        </button>
                    ))}

                    <button
                        onClick={fetchAppData}
                        className="btn-secondary"
                        disabled={loading}
                        style={{ marginLeft: 'auto' }}
                    >
                        {loading ? 'Loading...' : 'Refresh'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="error" style={{ margin: '0 20px 20px 20px' }}>
                    {error}
                </div>
            )}

            {loading && !stats ? (
                <div className="loading" style={{ minHeight: '200px' }}>
                    Loading your fitness data...
                </div>
            ) : (
                renderCurrentView()
            )}

            <div className="goals-section" style={{ margin: '20px', padding: '20px' }}>
                <h3>Quick Actions</h3>
                <div className="flex gap-10" style={{ flexWrap: 'wrap' }}>
                    <button
                        onClick={() => setCurrentView('dashboard')}
                        className="btn-secondary btn-small"
                        disabled={currentView === 'dashboard'}
                    >
                        View Dashboard
                    </button>
                    <button
                        onClick={() => setCurrentView('goals')}
                        className="btn-secondary btn-small"
                        disabled={currentView === 'goals'}
                    >
                        Set Goals
                    </button>
                    <button
                        onClick={() => setCurrentView('history')}
                        className="btn-secondary btn-small"
                        disabled={currentView === 'history'}
                    >
                        View History
                    </button>
                    <button
                        onClick={() => window.location.reload()}
                        className="btn-secondary btn-small"
                    >
                        Reset App
                    </button>
                </div>

                <div className="flex-between mt-20">
                    <p className="goal-text">
                        Welcome back, {user.username}! Keep tracking to stay on target! ?
                    </p>
                    <p className="goal-text">
                        Built with heart for your fitness journey
                    </p>
                </div>
            </div>
        </div>
    );
};

function App() {
    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    );
}

const AppContent = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="app">
                <div className="loading" style={{ minHeight: '100vh' }}>
                    Loading Fitnessify...
                </div>
            </div>
        );
    }

    return user ? <Dashboard /> : <AuthScreen />;
};

export default App;