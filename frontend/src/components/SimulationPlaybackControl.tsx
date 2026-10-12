import { useEffect } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Clock,
  AlertOctagon,
} from 'lucide-react';
import type { PeriodMetrics, SimulationResult } from '../types/models';

interface SimulationPlaybackControlProps {
  simulationResult: SimulationResult | null;
  currentPeriod: number;
  onPeriodChange: (period: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  playbackSpeed: number;
  onSpeedChange: (speed: number) => void;
}

export function SimulationPlaybackControl({
  simulationResult,
  currentPeriod,
  onPeriodChange,
  isPlaying,
  onTogglePlay,
  playbackSpeed,
  onSpeedChange,
}: SimulationPlaybackControlProps) {
  const horizon = simulationResult ? simulationResult.planning_horizon_periods : 14;
  const periodUnit = simulationResult ? simulationResult.period_unit : 'days';

  // Timer effect for playback stepping
  useEffect(() => {
    if (!isPlaying) return;

    const intervalTime = Math.max(250, 1000 / playbackSpeed);
    const timer = setInterval(() => {
      onPeriodChange(currentPeriod >= horizon - 1 ? 0 : currentPeriod + 1);
    }, intervalTime);

    return () => clearInterval(timer);
  }, [isPlaying, currentPeriod, horizon, playbackSpeed, onPeriodChange]);

  if (!simulationResult) return null;

  // Extract metrics for the currently selected period
  const activeMetrics: PeriodMetrics | undefined =
    simulationResult.period_metrics.find((m) => m.period === currentPeriod) ||
    simulationResult.period_metrics[currentPeriod];

  return (
    <div className="deck-card playback-dock-card">
      <div className="playback-top-bar">
        {/* Playback Controls Group */}
        <div className="playback-controls-cluster">
          <button
            className="ctrl-btn"
            onClick={() => onPeriodChange(0)}
            title="Reset to period 0"
          >
            <RotateCcw size={14} />
          </button>

          <button
            className="ctrl-btn"
            onClick={() => onPeriodChange(Math.max(0, currentPeriod - 1))}
            title="Step back 1 period"
          >
            <SkipBack size={15} />
          </button>

          <button
            className={`ctrl-btn btn-play ${isPlaying ? 'playing' : ''}`}
            onClick={onTogglePlay}
            title={isPlaying ? 'Pause simulation playback' : 'Play simulation playback'}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>

          <button
            className="ctrl-btn"
            onClick={() => onPeriodChange(Math.min(horizon - 1, currentPeriod + 1))}
            title="Step forward 1 period"
          >
            <SkipForward size={15} />
          </button>

          {/* Speed Selector */}
          <div className="speed-pills-group">
            {[0.5, 1, 2].map((s) => (
              <button
                key={s}
                className={`speed-pill ${playbackSpeed === s ? 'active' : ''}`}
                onClick={() => onSpeedChange(s)}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Current Period Indicator */}
        <div className="period-counter-badge">
          <Clock size={15} className="inline-icon icon-blue" />
          <span>
            Simulation Period: <strong>t = {currentPeriod}</strong> of {horizon - 1} ({periodUnit})
          </span>
        </div>
      </div>

      {/* Scrubber Timeline Slider */}
      <div className="scrubber-track-wrapper">
        <input
          type="range"
          min={0}
          max={horizon - 1}
          value={currentPeriod}
          onChange={(e) => onPeriodChange(parseInt(e.target.value, 10))}
          className="scrubber-range-slider"
        />

        <div className="timeline-ticks">
          {Array.from({ length: horizon }).map((_, idx) => (
            <span
              key={idx}
              className={`timeline-tick ${idx === currentPeriod ? 'current' : ''}`}
              onClick={() => onPeriodChange(idx)}
            >
              {idx % Math.ceil(horizon / 8) === 0 ? `t=${idx}` : '•'}
            </span>
          ))}
        </div>
      </div>

      {/* Real Period Operational Metrics Strip */}
      {activeMetrics && (
        <div className="period-metrics-strip">
          <div className="period-metric-box">
            <span className="p-label">Period Demand</span>
            <span className="p-val">{activeMetrics.requested_demand.toLocaleString()} units</span>
          </div>

          <div className="period-metric-box">
            <span className="p-label">Delivered Units</span>
            <span className="p-val highlight-green">{activeMetrics.delivered_units.toLocaleString()} units</span>
          </div>

          <div className="period-metric-box">
            <span className="p-label">Unmet Shortage</span>
            <span className={`p-val ${activeMetrics.unmet_demand > 0 ? 'highlight-red' : ''}`}>
              {activeMetrics.unmet_demand.toLocaleString()} units
            </span>
          </div>

          <div className="period-metric-box">
            <span className="p-label">Period SLA</span>
            <span className="p-val highlight-blue">{activeMetrics.service_level_pct.toFixed(1)}%</span>
          </div>

          <div className="period-metric-box">
            <span className="p-label">Period Cost</span>
            <span className="p-val">${activeMetrics.transport_cost.toLocaleString()}</span>
          </div>

          <div className="period-metric-box">
            <span className="p-label">Shipments Flow</span>
            <span className="p-val">
              {activeMetrics.shipments_dispatched} out / {activeMetrics.shipments_delivered} in
            </span>
          </div>

          {/* Active Disruptions at this period */}
          <div className="period-metric-box field-span-disruptions">
            <span className="p-label">Active Shocks at t={currentPeriod}</span>
            {activeMetrics.active_disruptions.length === 0 ? (
              <span className="p-val text-dim">None (Nominal)</span>
            ) : (
              <div className="active-shocks-chips">
                {activeMetrics.active_disruptions.map((disrId, i) => (
                  <span key={i} className="shock-tag">
                    <AlertOctagon size={11} /> {disrId}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
