import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar, ReferenceLine
} from 'recharts';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const ProgressTracker = React.memo(() => {
    const [formData, setFormData] = useState({
        person_weight: '',
        bench: '',
        squat: '',
        dead_lift: ''
    });

    const [progressEntries, setProgressEntries] = useState([]);
    const [deleteEntryId, setDeleteEntryId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [chartView, setChartView] = useState('line'); // 'line' or 'bar'
    const [timeRange, setTimeRange] = useState('all'); // 'all', '3months', '6months', '1year'

    const getAuthHeaders = useCallback(() => {
        const token = localStorage.getItem('authToken');
        return {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        };
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const fetchProgressEntries = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API_BASE_URL}/progress`, {
                headers: getAuthHeaders()
            });
            if (!res.ok) throw new Error('Failed to fetch progress entries');
            const data = await res.json();
            setProgressEntries(data);
            setError(null);
        } catch (err) {
            setError('Failed to load progress entries. Please try again.');
            console.error('Error fetching progress:', err);
        } finally {
            setLoading(false);
        }
    }, [getAuthHeaders]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validate form data
        const numericFields = ['person_weight', 'bench', 'squat', 'dead_lift'];
        const values = {};

        for (const field of numericFields) {
            const value = parseFloat(formData[field]);
            if (isNaN(value) || value <= 0) {
                setError(`Please enter a valid positive number for ${field.replace('_', ' ')}`);
                return;
            }
            values[field] = value;
        }

        try {
            setLoading(true);
            const res = await fetch(`${API_BASE_URL}/progress`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(values)
            });

            const responseData = await res.json();

            if (!res.ok) {
                throw new Error(responseData.error || 'Failed to add progress entry');
            }

            setFormData({ person_weight: '', bench: '', squat: '', dead_lift: '' });
            await fetchProgressEntries();
            setSuccess('Progress entry added successfully!');
        } catch (err) {
            setError(err.message || 'Failed to add progress entry');
        } finally {
            setLoading(false);
        }
    };

    const confirmDelete = async (id) => {
        try {
            setLoading(true);
            const res = await fetch(`${API_BASE_URL}/progress/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Failed to delete entry');
            }

            await fetchProgressEntries();
            setSuccess('Progress entry deleted successfully!');
        } catch (err) {
            setError(err.message || 'Failed to delete entry');
        } finally {
            setLoading(false);
            setDeleteEntryId(null);
        }
    };

    useEffect(() => {
        fetchProgressEntries();
    }, [fetchProgressEntries]);

    // Auto-clear messages
    useEffect(() => {
        if (success) {
            const timer = setTimeout(() => setSuccess(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [success]);

    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [error]);

    // Filter entries based on time range
    const filteredEntries = useMemo(() => {
        if (timeRange === 'all') return progressEntries;

        const now = new Date();
        const cutoffDate = new Date();

        switch (timeRange) {
            case '3months':
                cutoffDate.setMonth(now.getMonth() - 3);
                break;
            case '6months':
                cutoffDate.setMonth(now.getMonth() - 6);
                break;
            case '1year':
                cutoffDate.setFullYear(now.getFullYear() - 1);
                break;
            default:
                return progressEntries;
        }

        return progressEntries.filter(entry => new Date(entry.date) >= cutoffDate);
    }, [progressEntries, timeRange]);

    const sortedEntries = useMemo(() => {
        return [...filteredEntries].sort((a, b) => new Date(a.date) - new Date(b.date));
    }, [filteredEntries]);

    // Calculate progress statistics
    const progressStats = useMemo(() => {
        if (sortedEntries.length < 2) return null;

        const latest = sortedEntries[sortedEntries.length - 1];
        const earliest = sortedEntries[0];

        const weightChange = latest.person_weight - earliest.person_weight;
        const benchProgress = latest.bench - earliest.bench;
        const squatProgress = latest.squat - earliest.squat;
        const deadliftProgress = latest.dead_lift - earliest.dead_lift;

        const totalProgress = benchProgress + squatProgress + deadliftProgress;
        const daysBetween = Math.ceil((new Date(latest.date) - new Date(earliest.date)) / (1000 * 60 * 60 * 24));

        return {
            weightChange,
            benchProgress,
            squatProgress,
            deadliftProgress,
            totalProgress,
            daysBetween,
            latest,
            earliest
        };
    }, [sortedEntries]);

    // Calculate personal records
    const personalRecords = useMemo(() => {
        if (progressEntries.length === 0) return null;

        return {
            maxBench: Math.max(...progressEntries.map(e => e.bench)),
            maxSquat: Math.max(...progressEntries.map(e => e.squat)),
            maxDeadlift: Math.max(...progressEntries.map(e => e.dead_lift)),
            minWeight: Math.min(...progressEntries.map(e => e.person_weight)),
            maxWeight: Math.max(...progressEntries.map(e => e.person_weight))
        };
    }, [progressEntries]);

    // Format data for chart display
    const chartData = useMemo(() => {
        return sortedEntries.map(entry => ({
            ...entry,
            date: new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            total_lift: entry.bench + entry.squat + entry.dead_lift
        }));
    }, [sortedEntries]);

    const StatCard = ({ title, value, change, unit = '', positive = true }) => (
        <div className="totals" style={{ margin: '10px', flex: 1, minWidth: '150px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#ffb347' }}>{title}</h4>
            <p style={{ fontSize: '1.5rem', margin: '0', fontWeight: 'bold' }}>
                {value}{unit}
            </p>
            {change !== undefined && (
                <p style={{
                    margin: '5px 0 0 0',
                    fontSize: '0.9rem',
                    color: change > 0 ? (positive ? '#48bb78' : '#ff6b6b') : (positive ? '#ff6b6b' : '#48bb78')
                }}>
                    {change > 0 ? '+' : ''}{change.toFixed(1)}{unit}
                    {progressStats && ` (${progressStats.daysBetween} days)`}
                </p>
            )}
        </div>
    );

    return (
        <div className='progress-tracker'>
            <h2>Gym Progress Tracker</h2>

            {error && <div className="error">{error}</div>}
            {success && <div className="success">{success}</div>}

            {/* Progress Entry Form */}
            <div className="progress-form">
                <h3>Log Today's Progress</h3>
                <form onSubmit={handleSubmit}>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Body Weight (lbs)</label>
                            <input
                                type="number"
                                name="person_weight"
                                placeholder="150.5"
                                value={formData.person_weight}
                                onChange={handleChange}
                                step="0.1"
                                min="50"
                                max="500"
                                required
                                disabled={loading}
                            />
                        </div>
                        <div className="form-group">
                            <label>Bench Press (lbs)</label>
                            <input
                                type="number"
                                name="bench"
                                placeholder="135"
                                value={formData.bench}
                                onChange={handleChange}
                                min="0"
                                max="1000"
                                required
                                disabled={loading}
                            />
                        </div>
                        <div className="form-group">
                            <label>Squat (lbs)</label>
                            <input
                                type="number"
                                name="squat"
                                placeholder="225"
                                value={formData.squat}
                                onChange={handleChange}
                                min="0"
                                max="1000"
                                required
                                disabled={loading}
                            />
                        </div>
                        <div className="form-group">
                            <label>Deadlift (lbs)</label>
                            <input
                                type="number"
                                name="dead_lift"
                                placeholder="315"
                                value={formData.dead_lift}
                                onChange={handleChange}
                                min="0"
                                max="1000"
                                required
                                disabled={loading}
                            />
                        </div>
                    </div>
                    <button
                        type="submit"
                        className="btn-primary"
                        disabled={loading}
                    >
                        {loading ? 'Adding Progress...' : 'Log Progress'}
                    </button>
                </form>
            </div>

            {/* Progress Statistics */}
            {progressStats && (
                <div>
                    <h3>Progress Summary</h3>
                    <div className="flex" style={{ flexWrap: 'wrap', gap: '0' }}>
                        <StatCard
                            title="Weight Change"
                            value={progressStats.latest.person_weight}
                            change={progressStats.weightChange}
                            unit=" lbs"
                            positive={false}
                        />
                        <StatCard
                            title="Bench Progress"
                            value={progressStats.latest.bench}
                            change={progressStats.benchProgress}
                            unit=" lbs"
                        />
                        <StatCard
                            title="Squat Progress"
                            value={progressStats.latest.squat}
                            change={progressStats.squatProgress}
                            unit=" lbs"
                        />
                        <StatCard
                            title="Deadlift Progress"
                            value={progressStats.latest.dead_lift}
                            change={progressStats.deadliftProgress}
                            unit=" lbs"
                        />
                    </div>
                </div>
            )}

            {/* Personal Records */}
            {personalRecords && (
                <div className="totals">
                    <h3>Personal Records</h3>
                    <div className="flex gap-20" style={{ flexWrap: 'wrap' }}>
                        <span><strong>Max Bench:</strong> {personalRecords.maxBench} lbs</span>
                        <span><strong>Max Squat:</strong> {personalRecords.maxSquat} lbs</span>
                        <span><strong>Max Deadlift:</strong> {personalRecords.maxDeadlift} lbs</span>
                        <span><strong>Weight Range:</strong> {personalRecords.minWeight} - {personalRecords.maxWeight} lbs</span>
                    </div>
                </div>
            )}

            {/* Chart Controls */}
            <div className="flex-between mb-20">
                <div className="flex gap-10">
                    <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
                        <option value="all">All Time</option>
                        <option value="3months">Last 3 Months</option>
                        <option value="6months">Last 6 Months</option>
                        <option value="1year">Last Year</option>
                    </select>

                    <select value={chartView} onChange={(e) => setChartView(e.target.value)}>
                        <option value="line">Line Chart</option>
                        <option value="bar">Bar Chart</option>
                    </select>
                </div>

                <button
                    onClick={fetchProgressEntries}
                    className="btn-secondary"
                    disabled={loading}
                >
                    {loading ? 'Refreshing...' : 'Refresh Data'}
                </button>
            </div>

            {/* Progress Entries Table */}
            <h3>Progress History ({filteredEntries.length} entries)</h3>
            {loading && progressEntries.length === 0 ? (
                <div className="loading">Loading progress entries...</div>
            ) : filteredEntries.length === 0 ? (
                <p>No progress entries yet. Log your first workout above!</p>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Weight (lbs)</th>
                                <th>Bench (lbs)</th>
                                <th>Squat (lbs)</th>
                                <th>Deadlift (lbs)</th>
                                <th>Total Lift</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredEntries.slice().reverse().map(entry => {
                                const totalLift = entry.bench + entry.squat + entry.dead_lift;
                                return (
                                    <tr key={entry.id}>
                                        <td>{new Date(entry.date + "T12:00:00").toLocaleDateString()}</td>
                                        <td>{entry.person_weight}</td>
                                        <td>{entry.bench}</td>
                                        <td>{entry.squat}</td>
                                        <td>{entry.dead_lift}</td>
                                        <td><strong>{totalLift}</strong></td>
                                        <td>
                                            <button
                                                onClick={() => setDeleteEntryId(entry.id)}
                                                className="btn-danger btn-small"
                                                disabled={loading}
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteEntryId !== null && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3>Confirm Delete</h3>
                            <button
                                className="close-button"
                                onClick={() => setDeleteEntryId(null)}
                            >
                                ×
                            </button>
                        </div>
                        <p>Are you sure you want to delete this progress entry? This action cannot be undone.</p>
                        <div className="flex gap-10">
                            <button
                                onClick={() => confirmDelete(deleteEntryId)}
                                className="btn-danger"
                                disabled={loading}
                            >
                                {loading ? 'Deleting...' : 'Yes, Delete'}
                            </button>
                            <button
                                onClick={() => setDeleteEntryId(null)}
                                className="btn-secondary"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Progress Charts */}
            {chartData.length > 1 && (
                <div className="chart-container">
                    <h3>Progress Over Time - {chartView === 'line' ? 'Trend View' : 'Comparison View'}</h3>
                    <ResponsiveContainer width="100%" height={400}>
                        {chartView === 'line' ? (
                            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#555" />
                                <XAxis dataKey="date" stroke="#888" />
                                <YAxis stroke="#888" />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#3a3a3c',
                                        border: 'none',
                                        borderRadius: '8px',
                                        color: 'white'
                                    }}
                                />
                                <Legend />
                                <Line type="monotone" dataKey="person_weight" name="Weight" stroke="#8884d8" strokeWidth={2} />
                                <Line type="monotone" dataKey="bench" name="Bench" stroke="#82ca9d" strokeWidth={2} />
                                <Line type="monotone" dataKey="squat" name="Squat" stroke="#ffc658" strokeWidth={2} />
                                <Line type="monotone" dataKey="dead_lift" name="Deadlift" stroke="#ff8042" strokeWidth={2} />
                                <Line type="monotone" dataKey="total_lift" name="Total Lift" stroke="#ff6b9d" strokeWidth={3} strokeDasharray="5 5" />
                            </LineChart>
                        ) : (
                            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#555" />
                                <XAxis dataKey="date" stroke="#888" />
                                <YAxis stroke="#888" />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#3a3a3c',
                                        border: 'none',
                                        borderRadius: '8px',
                                        color: 'white'
                                    }}
                                />
                                <Legend />
                                <Bar dataKey="bench" name="Bench" fill="#82ca9d" />
                                <Bar dataKey="squat" name="Squat" fill="#ffc658" />
                                <Bar dataKey="dead_lift" name="Deadlift" fill="#ff8042" />
                            </BarChart>
                        )}
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
});

ProgressTracker.displayName = 'ProgressTracker';

export default ProgressTracker;