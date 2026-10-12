import { useState } from 'react';
import {
  AlertTriangle,
  Plus,
  Trash2,
  Sparkles,
  Zap,
  RotateCcw,
  ShieldAlert,
  Info,
} from 'lucide-react';
import type {
  Disruption,
  DisruptionType,
  GraphResponse,
  ScenarioSummary,
} from '../types/models';

interface DisruptionControlCenterProps {
  graph: GraphResponse | null;
  scenario: ScenarioSummary | null;
  stagedDisruptions: Disruption[];
  onAddDisruption: (disruption: Disruption) => void;
  onRemoveDisruption: (id: string) => void;
  onClearDisruptions: () => void;
  onApplyPreset: (disruptions: Disruption[]) => void;
}

export function DisruptionControlCenter({
  graph,
  scenario,
  stagedDisruptions,
  onAddDisruption,
  onRemoveDisruption,
  onClearDisruptions,
  onApplyPreset,
}: DisruptionControlCenterProps) {
  const [selectedType, setSelectedType] = useState<DisruptionType>('route_closure');
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [magnitude, setMagnitude] = useState<number>(1.0);
  const [startPeriod, setStartPeriod] = useState<number>(2);
  const [durationPeriods, setDurationPeriods] = useState<number>(6);
  const [description, setDescription] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!graph || !scenario) return null;

  // Derive valid targets based on disruption type
  const isRouteTarget =
    selectedType === 'route_closure' || selectedType === 'lead_time_increase';

  const isRetailerOnly = selectedType === 'demand_surge';

  const validTargets = isRouteTarget
    ? graph.edges.map((e) => ({
        id: e.id,
        name: `${e.id} (${e.source} → ${e.target})`,
      }))
    : isRetailerOnly
      ? graph.nodes
          .filter((n) => n.facility_type === 'retailer')
          .map((n) => ({ id: n.id, name: `${n.name} (${n.id})` }))
      : graph.nodes.map((n) => ({ id: n.id, name: `${n.name} (${n.id})` }));

  const horizon = scenario.planning_horizon_periods;

  const handleTypeChange = (newType: DisruptionType) => {
    setSelectedType(newType);
    setSelectedTarget('');
    setValidationError(null);

    // Set sensible default magnitudes
    if (newType === 'capacity_reduction') {
      setMagnitude(0.5);
    } else if (newType === 'demand_surge') {
      setMagnitude(1.75);
    } else if (newType === 'lead_time_increase') {
      setMagnitude(3.0);
    } else {
      setMagnitude(1.0);
    }
  };

  const handleAdd = () => {
    setValidationError(null);

    if (!selectedTarget) {
      setValidationError('Please select a valid target facility or route.');
      return;
    }

    if (startPeriod < 0 || startPeriod >= horizon) {
      setValidationError(`Start period must be between 0 and ${horizon - 1}.`);
      return;
    }

    if (durationPeriods <= 0) {
      setValidationError('Duration periods must be at least 1.');
      return;
    }

    if (selectedType === 'capacity_reduction' && (magnitude <= 0 || magnitude > 1)) {
      setValidationError('Capacity reduction magnitude must be between 0.01 and 1.0 (fraction reduced).');
      return;
    }

    if (selectedType === 'demand_surge' && magnitude < 1.0) {
      setValidationError('Demand surge multiplier must be >= 1.0 (e.g. 1.5 = 150% demand).');
      return;
    }

    if (selectedType === 'lead_time_increase' && magnitude <= 0) {
      setValidationError('Lead time increase must be > 0 additional periods.');
      return;
    }

    const newId = `disr_${selectedType}_${selectedTarget}_${Date.now().toString().slice(-4)}`;

    const newDisruption: Disruption = {
      id: newId,
      disruption_type: selectedType,
      target_id: selectedTarget,
      magnitude: Number(magnitude),
      start_period: Number(startPeriod),
      duration_periods: Number(durationPeriods),
      description:
        description.trim() ||
        `${selectedType.replace('_', ' ').toUpperCase()} on ${selectedTarget}`,
    };

    onAddDisruption(newDisruption);
    setDescription('');
  };

  // Preset Handlers for Instant Demonstrations
  const handleLoadElectronicsPreset = () => {
    const p1: Disruption = {
      id: 'preset_taiwan_route_cut',
      disruption_type: 'route_closure',
      target_id: 'r_taiwan_shenzhen',
      magnitude: 1.0,
      start_period: 2,
      duration_periods: 6,
      description: 'Taiwan Strait Sea-Lane Maritime Blockade',
    };
    const p2: Disruption = {
      id: 'preset_shenzhen_cap_reduction',
      disruption_type: 'capacity_reduction',
      target_id: 'fac_shenzhen',
      magnitude: 0.6,
      start_period: 3,
      duration_periods: 5,
      description: 'Shenzhen Assembly Plant 60% Capacity Throttling',
    };
    onApplyPreset([p1, p2]);
  };

  const handleLoadPharmaPreset = () => {
    const p1: Disruption = {
      id: 'preset_frankfurt_cold_hub_outage',
      disruption_type: 'facility_shutdown',
      target_id: 'dc_frankfurt_cold',
      magnitude: 1.0,
      start_period: 3,
      duration_periods: 6,
      description: 'Frankfurt Deep-Freeze Depot Grid Collapse (Facility Shutdown)',
    };
    const p2: Disruption = {
      id: 'preset_paris_vaccine_surge',
      disruption_type: 'demand_surge',
      target_id: 'ret_hosp_paris',
      magnitude: 2.0,
      start_period: 2,
      duration_periods: 8,
      description: 'Paris Hospital Consortium 2.0x Biologics Demand Surge',
    };
    onApplyPreset([p1, p2]);
  };

  return (
    <div className="deck-card disruption-control-card">
      <div className="deck-card-header">
        <div className="card-title-group">
          <ShieldAlert size={18} className="deck-icon icon-red" />
          <div>
            <h3>Disruption Control Center</h3>
            <span className="card-subtitle">
              Configure multi-tier operational shocks to test supply chain resilience
            </span>
          </div>
        </div>

        <div className="preset-quick-actions">
          <span className="preset-label">
            <Sparkles size={13} /> Quick Scenarios:
          </span>
          <button
            className="btn-preset-chip"
            onClick={
              scenario.id === 'pharma_cold_chain'
                ? handleLoadPharmaPreset
                : handleLoadElectronicsPreset
            }
            title="Load benchmark disruption stress test"
          >
            <Zap size={12} /> {scenario.id === 'pharma_cold_chain' ? 'Cold Storage Outage + Paris Surge' : 'Strait Blockade + Cap Cut'}
          </button>
        </div>
      </div>

      <div className="deck-card-body">
        {/* Form to configure new disruption */}
        <div className="disruption-builder-grid">
          {/* Disruption Category */}
          <div className="form-field-group">
            <label className="field-label">Disruption Category</label>
            <select
              className="field-select"
              value={selectedType}
              onChange={(e) => handleTypeChange(e.target.value as DisruptionType)}
            >
              <option value="route_closure">Route Closure (100% Lane Cut)</option>
              <option value="facility_shutdown">Facility Shutdown (100% Outage)</option>
              <option value="capacity_reduction">Capacity Throttling (Partial Cut)</option>
              <option value="lead_time_increase">Transit Delay (+Added Lead Time)</option>
              <option value="demand_surge">Demand Surge (Volume Multiplier)</option>
            </select>
          </div>

          {/* Target Selection */}
          <div className="form-field-group">
            <label className="field-label">
              Target {isRouteTarget ? 'Transport Route' : 'Facility'}
            </label>
            <select
              className="field-select"
              value={selectedTarget}
              onChange={(e) => setSelectedTarget(e.target.value)}
            >
              <option value="">-- Choose target entity --</option>
              {validTargets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Magnitude Input */}
          <div className="form-field-group">
            <label className="field-label">
              {selectedType === 'capacity_reduction' && 'Capacity Cut Fraction (0.1 to 1.0)'}
              {selectedType === 'demand_surge' && 'Demand Multiplier (>= 1.0x)'}
              {selectedType === 'lead_time_increase' && 'Transit Delay (+Periods)'}
              {(selectedType === 'facility_shutdown' || selectedType === 'route_closure') &&
                'Severity (Fixed 1.0 Outage)'}
            </label>
            <input
              type="number"
              className="field-input"
              value={magnitude}
              onChange={(e) => setMagnitude(parseFloat(e.target.value) || 0)}
              step={selectedType === 'capacity_reduction' ? 0.05 : 0.5}
              min={0}
              disabled={
                selectedType === 'facility_shutdown' || selectedType === 'route_closure'
              }
            />
          </div>

          {/* Start Period */}
          <div className="form-field-group">
            <label className="field-label">Start Period (0 to {horizon - 1})</label>
            <input
              type="number"
              className="field-input"
              value={startPeriod}
              onChange={(e) => setStartPeriod(parseInt(e.target.value, 10) || 0)}
              min={0}
              max={horizon - 1}
            />
          </div>

          {/* Duration */}
          <div className="form-field-group">
            <label className="field-label">Duration (Periods)</label>
            <input
              type="number"
              className="field-input"
              value={durationPeriods}
              onChange={(e) => setDurationPeriods(parseInt(e.target.value, 10) || 1)}
              min={1}
              max={horizon}
            />
          </div>

          {/* Optional Rationale Description */}
          <div className="form-field-group field-span-2">
            <label className="field-label">Disruption Context / Description</label>
            <input
              type="text"
              className="field-input"
              placeholder="e.g. Extreme typhoon closes Taiwan seaport"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Submit Action */}
          <div className="form-actions-group">
            <button className="btn-add-disruption" onClick={handleAdd}>
              <Plus size={15} />
              <span>Stage Disruption</span>
            </button>
          </div>
        </div>

        {/* Validation Warning */}
        {validationError && (
          <div className="validation-alert">
            <AlertTriangle size={14} />
            <span>{validationError}</span>
          </div>
        )}

        {/* Staged Disruptions Queue */}
        <div className="staged-disruptions-container">
          <div className="staged-header">
            <h4>
              Staged Disruption Queue ({stagedDisruptions.length})
            </h4>
            {stagedDisruptions.length > 0 && (
              <button
                className="btn-clear-staged"
                onClick={onClearDisruptions}
                title="Remove all staged disruptions"
              >
                <RotateCcw size={13} />
                <span>Reset All</span>
              </button>
            )}
          </div>

          {stagedDisruptions.length === 0 ? (
            <div className="staged-empty-box">
              <Info size={14} className="inline-icon icon-muted" />
              <span>
                No disruptions staged. The simulation will run in pristine Baseline state unless shocks are added.
              </span>
            </div>
          ) : (
            <div className="staged-chips-list">
              {stagedDisruptions.map((d) => (
                <div key={d.id} className="disruption-chip-card">
                  <div className="chip-meta">
                    <span className="chip-badge-type">{d.disruption_type.replace('_', ' ')}</span>
                    <strong className="chip-target">{d.target_id}</strong>
                    <span className="chip-timing">
                      Periods t = {d.start_period} to{' '}
                      {d.duration_periods ? d.start_period + d.duration_periods - 1 : 'end'}
                    </span>
                    <span className="chip-magnitude">
                      Magnitude: {d.magnitude}
                    </span>
                    {d.description && (
                      <span className="chip-desc">"{d.description}"</span>
                    )}
                  </div>
                  <button
                    className="btn-remove-chip"
                    onClick={() => onRemoveDisruption(d.id)}
                    title="Remove disruption"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
