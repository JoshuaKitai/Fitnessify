import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const CalorieTracker = React.memo(() => {
    const [entries, setEntries] = useState([]);
    const [goals, setGoals] = useState({
        daily_calories: 2000,
        daily_protein: 150,
        daily_carbs: 250,
        daily_fat: 65
    });
    const [query, setQuery] = useState('');
    const [lookupData, setLookupData] = useState(null);
    const [showTable, setShowTable] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [lookupLoading, setLookupLoading] = useState(false);
    const [deleteEntryId, setDeleteEntryId] = useState(null);

    // Helper function to get auth headers
    const getAuthHeaders = useCallback(() => {
        const token = localStorage.getItem('authToken');
        return {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        };
    }, []);

    const fetchEntries = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API_BASE_URL}/entries/today`, {
                headers: getAuthHeaders()
            });
            if (!res.ok) throw new Error('Failed to fetch entries');
            const data = await res.json();
            setEntries(data);
            setError(null);
        } catch (err) {
            setError('Failed to load food entries. Please try again.');
            console.error('Error fetching entries:', err);
        } finally {
            setLoading(false);
        }
    }, [getAuthHeaders]);

    const fetchGoals = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/goals`, {
                headers: getAuthHeaders()
            });
            if (!res.ok) throw new Error('Failed to fetch goals');
            const data = await res.json();
            setGoals(data);
        } catch (err) {
            console.error('Error fetching goals:', err);
            // Keep default goals if fetch fails
        }
    }, [getAuthHeaders]);

    useEffect(() => {
        fetchEntries();
        fetchGoals();
    }, [fetchEntries, fetchGoals]);

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

    const handleLookup = async (e) => {
        e.preventDefault();
        if (!query.trim()) return;

        try {
            setLookupLoading(true);
            setError(null);

            const res = await fetch(`${API_BASE_URL}/api/nutritionix`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ query: query.trim() })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to lookup nutrition information');
            }

            if (data.error) {
                throw new Error(data.error);
            }

            setLookupData(data);
        } catch (err) {
            setError(err.message || 'Failed to lookup nutrition information');
            setLookupData(null);
        } finally {
            setLookupLoading(false);
        }
    };

    const handleAddFood = async () => {
        if (!lookupData || lookupData.error) return;

        try {
            setLoading(true);
            const res = await fetch(`${API_BASE_URL}/entries`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    name: lookupData.food_name,
                    calories: lookupData.calories,
                    protein: lookupData.protein,
                    carbs: lookupData.carbs,
                    fat: lookupData.fat
                })
            });

            const responseData = await res.json();

            if (!res.ok) {
                throw new Error(responseData.error || 'Failed to add food entry');
            }

            await fetchEntries();
            setLookupData(null);
            setQuery('');
            setSuccess('Food added successfully!');
        } catch (err) {
            setError(err.message || 'Failed to add food entry');
        } finally {
            setLoading(false);
        }
    };

    // Updated delete function to use modal confirmation
    const confirmDelete = async (id) => {
        try {
            setLoading(true);
            const res = await fetch(`${API_BASE_URL}/entries/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Failed to delete entry');
            }

            await fetchEntries();
            setSuccess('Entry deleted successfully!');
        } catch (err) {
            setError(err.message || 'Failed to delete entry');
        } finally {
            setLoading(false);
            setDeleteEntryId(null); // Close modal
        }
    };

    // Memoized calculations
    const totals = useMemo(() => {
        return entries.reduce((acc, e) => ({
            calories: acc.calories + e.calories,
            protein: acc.protein + e.protein,
            carbs: acc.carbs + e.carbs,
            fat: acc.fat + e.fat
        }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
    }, [entries]);

    const macroData = useMemo(() => [
        { name: 'Protein', value: totals.protein, color: '#82ca9d' },
        { name: 'Carbs', value: totals.carbs, color: '#ffc658' },
        { name: 'Fat', value: totals.fat, color: '#ff8042' }
    ], [totals]);

    const ProgressBar = ({ current, goal, label, unit }) => {
        const percentage = Math.min((current / goal) * 100, 100);
        const isOverGoal = current > goal;

        return (
            <div className="mb-10">
                <div className="flex-between">
                    <span>{label}</span>
                    <span className="goal-text">
                        {current.toFixed(1)}{unit} / {goal}{unit}
                    </span>
                </div>
                <div className="progress-bar">
                    <div
                        className={`progress-fill ${isOverGoal ? 'over-goal' : ''}`}
                        style={{ width: `${percentage}%` }}
                    />
                </div>
                <div className="goal-text">
                    {percentage.toFixed(1)}% of daily goal
                    {isOverGoal && ` (${(current - goal).toFixed(1)}${unit} over)`}
                </div>
            </div>
        );
    };

    // Get the entry name for the delete confirmation modal
    const entryToDelete = entries.find(entry => entry.id === deleteEntryId);

    return (
        <div className="calorie-tracker">
            <h2>Calorie Tracker</h2>

            {error && <div className="error">{error}</div>}
            {success && <div className="success">{success}</div>}

            <div className="lookup-form">
                <form onSubmit={handleLookup}>
                    <div className="form-group">
                        <input
                            type="text"
                            placeholder="Enter food item (e.g., 1 cup of rice, 6 oz chicken breast)"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            disabled={lookupLoading}
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="btn-primary"
                        disabled={lookupLoading || !query.trim()}
                    >
                        {lookupLoading ? 'Looking up...' : 'Lookup Nutrition'}
                    </button>
                </form>

                {lookupData && !lookupData.error && (
                    <div className="lookup-result">
                        <h4>Found: {lookupData.food_name}</h4>
                        <p>
                            <strong>Serving:</strong> {lookupData.serving_qty} {lookupData.serving_unit}
                        </p>
                        <div className="flex gap-20">
                            <span><strong>{lookupData.calories}</strong> kcal</span>
                            <span><strong>{lookupData.protein}g</strong> protein</span>
                            <span><strong>{lookupData.carbs}g</strong> carbs</span>
                            <span><strong>{lookupData.fat}g</strong> fat</span>
                        </div>
                        <button
                            onClick={handleAddFood}
                            className="btn-primary mt-10"
                            disabled={loading}
                        >
                            {loading ? 'Adding...' : 'Add Food'}
                        </button>
                    </div>
                )}
            </div>

            {/* Daily Progress */}
            <div className="totals">
                <h3>Daily Progress</h3>
                <ProgressBar
                    current={totals.calories}
                    goal={goals.daily_calories}
                    label="Calories"
                    unit=" kcal"
                />
                <ProgressBar
                    current={totals.protein}
                    goal={goals.daily_protein}
                    label="Protein"
                    unit="g"
                />
                <ProgressBar
                    current={totals.carbs}
                    goal={goals.daily_carbs}
                    label="Carbohydrates"
                    unit="g"
                />
                <ProgressBar
                    current={totals.fat}
                    goal={goals.daily_fat}
                    label="Fat"
                    unit="g"
                />
            </div>

            <div className="flex-between">
                <button
                    onClick={() => setShowTable(!showTable)}
                    className="btn-secondary"
                >
                    {showTable ? 'Hide Entries' : 'Show Entries'} ({entries.length})
                </button>
                <button
                    onClick={fetchEntries}
                    className="btn-secondary"
                    disabled={loading}
                >
                    {loading ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>

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
                        <p>
                            Are you sure you want to delete <strong>"{entryToDelete?.name}"</strong>?
                            This action cannot be undone.
                        </p>
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

            {showTable && (
                <>
                    <h3>Today's Food Entries</h3>
                    {loading && entries.length === 0 ? (
                        <div className="loading">Loading entries...</div>
                    ) : entries.length === 0 ? (
                        <p>No food entries for today. Add some food above!</p>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Food</th>
                                        <th>Calories</th>
                                        <th>Protein (g)</th>
                                        <th>Carbs (g)</th>
                                        <th>Fat (g)</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {entries.map(entry => (
                                        <tr key={entry.id}>
                                            <td>{entry.name}</td>
                                            <td>{entry.calories.toFixed(1)}</td>
                                            <td>{entry.protein.toFixed(1)}</td>
                                            <td>{entry.carbs.toFixed(1)}</td>
                                            <td>{entry.fat.toFixed(1)}</td>
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
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Macronutrient Chart */}
                    {entries.length > 0 && (
                        <div className="chart-container">
                            <h3>Macronutrient Breakdown</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={macroData}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={80}
                                        label={({ name, value }) => `${name}: ${value.toFixed(1)}g`}
                                    >
                                        {macroData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value) => `${value.toFixed(1)}g`} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </>
            )}
        </div>
    );
});

CalorieTracker.displayName = 'CalorieTracker';

export default CalorieTracker;