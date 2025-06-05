import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import './CalendarHistory.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const TooltipPortal = ({ tooltip }) => {
    if (!tooltip) return null;

    const tooltipElement = (
        <div
            style={{
                position: 'fixed',
                left: `${tooltip.position.x}px`,
                top: `${tooltip.position.y}px`,
                transform: 'translateX(-50%)',
                backgroundColor: 'white',
                color: '#374151',
                padding: '12px 16px',
                borderRadius: '12px',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
                zIndex: 999999,
                minWidth: '250px',
                maxWidth: '350px',
                border: '1px solid #d1d5db',
                fontSize: '0.8rem',
                lineHeight: 1.5,
                pointerEvents: 'none'
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    top: '-6px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    borderLeft: '6px solid transparent',
                    borderRight: '6px solid transparent',
                    borderBottom: '6px solid white'
                }}
            />
            <div dangerouslySetInnerHTML={{ __html: tooltip.content }} />
        </div>
    );

    return ReactDOM.createPortal(tooltipElement, document.body);
};

const CalendarHistory = React.memo(() => {
    const [weekOptions, setWeekOptions] = useState([]);
    const [weekStart, setWeekStart] = useState(null);
    const [selectedWeekStartStr, setSelectedWeekStartStr] = useState('');
    const [weekDates, setWeekDates] = useState([]);
    const [entriesByDay, setEntriesByDay] = useState({});
    const [progressByDay, setProgressByDay] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [activeTooltip, setActiveTooltip] = useState(null);

    const getAuthHeaders = useCallback(() => {
        const token = localStorage.getItem('authToken');
        return {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        };
    }, []);

    useEffect(() => {
        const startDate = new Date('2025-01-01');
        const today = new Date();
        const weeks = [];

        let current = new Date(startDate);
        current.setDate(current.getDate() - current.getDay());

        while (current <= today) {
            weeks.push(new Date(current));
            current.setDate(current.getDate() + 7);
        }

        setWeekOptions(weeks.reverse());

        const currentSunday = new Date();
        currentSunday.setDate(currentSunday.getDate() - currentSunday.getDay());
        const currentSundayStr = currentSunday.toISOString().split('T')[0];

        const matched = weeks.find(week => week.toISOString().split('T')[0] === currentSundayStr);
        if (matched) {
            setWeekStart(matched);
            setSelectedWeekStartStr(matched.toISOString());
        }
    }, []);

    const fetchWeekData = useCallback(async (startDate) => {
        if (!startDate) return;

        try {
            setLoading(true);
            setError(null);

            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 6);

            const startDateStr = startDate.toISOString().split('T')[0];
            const endDateStr = endDate.toISOString().split('T')[0];

            const [entriesResponse, progressResponse] = await Promise.all([
                fetch(`${API_BASE_URL}/entries/date-range?start_date=${startDateStr}&end_date=${endDateStr}`, {
                    headers: getAuthHeaders()
                }),
                fetch(`${API_BASE_URL}/progress/date-range?start_date=${startDateStr}&end_date=${endDateStr}`, {
                    headers: getAuthHeaders()
                })
            ]);

            if (!entriesResponse.ok || !progressResponse.ok) {
                throw new Error('Failed to fetch week data');
            }

            const entriesData = await entriesResponse.json();
            const progressData = await progressResponse.json();

            setEntriesByDay(entriesData);
            setProgressByDay(progressData);
        } catch (err) {
            setError('Failed to load week data. Please try again.');
            console.error('Error fetching week data:', err);
        } finally {
            setLoading(false);
        }
    }, [getAuthHeaders]);

    useEffect(() => {
        if (!weekStart) return;

        const week = Array.from({ length: 7 }, (_, i) => {
            const date = new Date(weekStart);
            date.setDate(date.getDate() + i);
            return date;
        });

        setWeekDates(week);
        fetchWeekData(weekStart);
    }, [weekStart, fetchWeekData]);

    const getTotals = useCallback((entries) => {
        return entries.reduce((acc, e) => ({
            calories: acc.calories + e.calories,
            protein: acc.protein + e.protein,
            carbs: acc.carbs + e.carbs,
            fat: acc.fat + e.fat
        }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
    }, []);

    const weeklyStats = useMemo(() => {
        const allEntries = Object.values(entriesByDay).flat();
        const allProgress = Object.values(progressByDay).flat();

        if (allEntries.length === 0) return null;

        const totals = getTotals(allEntries);
        const avgDaily = {
            calories: totals.calories / 7,
            protein: totals.protein / 7,
            carbs: totals.carbs / 7,
            fat: totals.fat / 7
        };

        const latestWeight = allProgress.length > 0
            ? Math.max(...allProgress.map(p => p.person_weight))
            : null;

        return {
            totals,
            avgDaily,
            latestWeight,
            totalEntries: allEntries.length,
            daysWithEntries: Object.keys(entriesByDay).filter(date => entriesByDay[date].length > 0).length
        };
    }, [entriesByDay, progressByDay, getTotals]);

    const handleWeekChange = (e) => {
        const newStr = e.target.value;
        setSelectedWeekStartStr(newStr);
        setWeekStart(new Date(newStr));
    };

    const navigateWeek = (direction) => {
        if (!weekStart) return;

        const newWeekStart = new Date(weekStart);
        newWeekStart.setDate(newWeekStart.getDate() + (direction * 7));

        const newWeekStr = newWeekStart.toISOString();
        const foundWeek = weekOptions.find(week => week.toISOString() === newWeekStr);

        if (foundWeek) {
            setWeekStart(newWeekStart);
            setSelectedWeekStartStr(newWeekStr);
        }
    };

    const isToday = (date) => {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    };

    const showTooltip = useCallback((event, tooltipId, content) => {
        const rect = event.currentTarget.getBoundingClientRect();

        let x = rect.left + (rect.width / 2);
        let y = rect.bottom + 8;

        const tooltipWidth = 350;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (x + tooltipWidth / 2 > viewportWidth - 20) {
            x = viewportWidth - tooltipWidth / 2 - 20;
        }
        if (x - tooltipWidth / 2 < 20) {
            x = tooltipWidth / 2 + 20;
        }

        if (y + 200 > viewportHeight) {
            y = rect.top - 8;
        }

        const tooltipData = {
            id: tooltipId,
            content,
            position: { x, y }
        };
        setActiveTooltip(tooltipData);
    }, []);

    const hideTooltip = useCallback(() => {
        setActiveTooltip(null);
    }, []);

    const DayCell = React.memo(({ date, entries, progress }) => {
        const dateStr = date.toISOString().split('T')[0];
        const totals = getTotals(entries);
        const isCurrentDay = isToday(date);

        const handleNutritionHover = (e) => {
            if (entries.length === 0) return;

            const content = `
                <strong>Daily Totals:</strong><br/>
                <strong>Calories:</strong> ${totals.calories.toFixed(1)} kcal<br/>
                <strong>Protein:</strong> ${totals.protein.toFixed(1)}g<br/>
                <strong>Carbs:</strong> ${totals.carbs.toFixed(1)}g<br/>
                <strong>Fat:</strong> ${totals.fat.toFixed(1)}g<br/>
                <br/>
                <strong>Food Items:</strong><br/>
                ${entries.map(entry =>
                    ` ${entry.name} (${entry.calories.toFixed(0)} kcal)`
                ).join('<br/>')}
            `;
            showTooltip(e, `nutrition-${dateStr}`, content);
        };

        const handleProgressHover = (e) => {
            if (progress.length === 0) return;

            const content = progress.map(p => `
                <strong>Weight:</strong> ${p.person_weight} lbs<br/>
                <strong>Bench:</strong> ${p.bench} lbs<br/>
                <strong>Squat:</strong> ${p.squat} lbs<br/>
                <strong>Deadlift:</strong> ${p.dead_lift} lbs<br/>
                <strong>Total Lift:</strong> ${(p.bench + p.squat + p.dead_lift)} lbs
            `).join('<hr style="margin: 8px 0"/>');

            showTooltip(e, `progress-${dateStr}`, content);
        };

        return (
            <div
                className={`day-cell ${isCurrentDay ? 'current-day' : ''}`}
                style={isCurrentDay ? { borderColor: '#48bb78' } : {}}
            >
                <h3>
                    {date.toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric'
                    })}
                    {isCurrentDay && ' (Today)'}
                </h3>

                {entries.length > 0 ? (
                    <div
                        className="hover-box macro-box"
                        onMouseEnter={handleNutritionHover}
                        onMouseLeave={hideTooltip}
                        style={{ cursor: 'pointer' }}
                    >
                        Nutrition ({entries.length} items)
                    </div>
                ) : (
                    <div className="hover-box macro-box" style={{
                        opacity: 0.6,
                        background: 'var(--secondary-200)',
                        color: 'var(--secondary-600)',
                        borderColor: 'var(--secondary-300)'
                    }}>
                        No nutrition data
                    </div>
                )}

                {progress.length > 0 ? (
                    <div
                        className="hover-box progress-box"
                        onMouseEnter={handleProgressHover}
                        onMouseLeave={hideTooltip}
                        style={{ cursor: 'pointer' }}
                    >
                        Workout Progress
                    </div>
                ) : (
                    <div className="hover-box progress-box" style={{
                        opacity: 0.6,
                        background: 'var(--secondary-200)',
                        color: 'var(--secondary-600)',
                        borderColor: 'var(--secondary-300)'
                    }}>
                        No workout logged
                    </div>
                )}

                {entries.length > 0 && (
                    <div style={{
                        marginTop: '10px',
                        fontSize: '11px',
                        color: '#888',
                        lineHeight: '1.3'
                    }}>
                        {totals.calories.toFixed(0)} cal  {totals.protein.toFixed(0)}p
                    </div>
                )}
            </div>
        );
    });

    DayCell.displayName = 'DayCell';

    if (loading && weekDates.length === 0) {
        return (
            <div className="calendar-history">
                <div className="loading">Loading calendar data...</div>
            </div>
        );
    }

    return (
        <div className="calendar-history">
            <div className="flex-between">
                <h2>Weekly Nutrition & Progress</h2>
                <button
                    onClick={() => fetchWeekData(weekStart)}
                    className="btn-secondary btn-small"
                    disabled={loading}
                >
                    {loading ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>

            {error && <div className="error">{error}</div>}

            <div className="week-selector">
                <button
                    onClick={() => navigateWeek(-1)}
                    className="btn-secondary"
                    disabled={loading || weekOptions.findIndex(w => w.toISOString() === selectedWeekStartStr) >= weekOptions.length - 1}
                >
                    Previous Week
                </button>

                <div className="flex gap-10">
                    <label>Week: </label>
                    <select
                        value={selectedWeekStartStr}
                        onChange={handleWeekChange}
                        disabled={loading}
                    >
                        {weekOptions.map(date => (
                            <option key={date.toISOString()} value={date.toISOString()}>
                                Week of {date.toLocaleDateString()}
                            </option>
                        ))}
                    </select>
                </div>

                <button
                    onClick={() => navigateWeek(1)}
                    className="btn-secondary"
                    disabled={loading || weekOptions.findIndex(w => w.toISOString() === selectedWeekStartStr) <= 0}
                >
                    Next Week
                </button>
            </div>

            {weeklyStats && (
                <div className="totals mb-20">
                    <h3>Weekly Summary</h3>
                    <div className="flex-between">
                        <div>
                            <p><strong>Total Calories:</strong> {weeklyStats.totals.calories.toFixed(0)} kcal</p>
                            <p><strong>Avg Daily:</strong> {weeklyStats.avgDaily.calories.toFixed(0)} kcal</p>
                        </div>
                        <div>
                            <p><strong>Active Days:</strong> {weeklyStats.daysWithEntries}/7</p>
                            <p><strong>Total Entries:</strong> {weeklyStats.totalEntries}</p>
                        </div>
                        {weeklyStats.latestWeight && (
                            <div>
                                <p><strong>Latest Weight:</strong> {weeklyStats.latestWeight} lbs</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="week-grid">
                {weekDates.map(date => {
                    const dateStr = date.toISOString().split('T')[0];
                    const entries = entriesByDay[dateStr] || [];
                    const progress = progressByDay[dateStr] || [];

                    return (
                        <DayCell
                            key={dateStr}
                            date={date}
                            entries={entries}
                            progress={progress}
                        />
                    );
                })}
            </div>

            <TooltipPortal tooltip={activeTooltip} />

            {loading && weekDates.length > 0 && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '12px',
                    zIndex: 100
                }}>
                    <div className="loading">Updating week data...</div>
                </div>
            )}
        </div>
    );
});

CalendarHistory.displayName = 'CalendarHistory';

export default CalendarHistory;