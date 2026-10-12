import { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  RotateCcw,
  Tag,
  Maximize2,
  Box as BoxIcon,
  Factory,
  Building2,
  Store,
  AlertTriangle,
} from 'lucide-react';
import type {
  GraphEdge,
  GraphNode,
  GraphResponse,
  ShipmentRecord,
} from '../types/models';

interface NetworkDigitalTwin3DProps {
  graph: GraphResponse | null;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  selectedEdgeId: string | null;
  onSelectEdge: (edgeId: string | null) => void;
  disruptedNodeIds?: Set<string>;
  disruptedEdgeIds?: Set<string>;
  activeShipments?: ShipmentRecord[];
}

// Facility styling mapping
const FACILITY_CONFIG: Record<
  string,
  { color: string; label: string; icon: typeof BoxIcon }
> = {
  supplier: { color: '#0284c7', label: 'Supplier', icon: BoxIcon },
  factory: { color: '#6366f1', label: 'Factory', icon: Factory },
  distribution_center: { color: '#0d9488', label: 'Distribution Center', icon: Building2 },
  warehouse: { color: '#0f766e', label: 'Warehouse', icon: Building2 },
  retailer: { color: '#059669', label: 'Retail Demand', icon: Store },
};

/**
 * 3D Facility Node representation with custom geometric shapes per tier
 */
function FacilityMeshNode({
  node,
  isSelected,
  isDisrupted,
  showLabels,
  onSelect,
}: {
  node: GraphNode;
  isSelected: boolean;
  isDisrupted: boolean;
  showLabels: boolean;
  onSelect: (id: string) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const config = FACILITY_CONFIG[node.facility_type] || {
    color: '#64748b',
    label: node.facility_type,
    icon: BoxIcon,
  };

  const nodeColor = isDisrupted
    ? '#ef4444'
    : isSelected
      ? '#f59e0b'
      : hovered
        ? '#38bdf8'
        : config.color;

  useFrame((_, delta) => {
    if (meshRef.current && (isDisrupted || isSelected)) {
      meshRef.current.rotation.y += delta * 1.2;
    }
  });

  return (
    <group position={[node.position.x, node.position.y, node.position.z]}>
      {/* Selection / Disruption Aura Ring */}
      {(isSelected || isDisrupted) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.2, 0]}>
          <ringGeometry args={[2.5, 3.2, 32]} />
          <meshBasicMaterial
            color={isDisrupted ? '#ef4444' : '#f59e0b'}
            side={THREE.DoubleSide}
            transparent
            opacity={0.65}
          />
        </mesh>
      )}

      {/* Geometry based on facility tier */}
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(node.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'auto';
        }}
      >
        {node.facility_type === 'supplier' && (
          <cylinderGeometry args={[1.6, 1.6, 2.0, 6]} />
        )}
        {node.facility_type === 'factory' && (
          <boxGeometry args={[2.2, 2.2, 2.2]} />
        )}
        {(node.facility_type === 'distribution_center' ||
          node.facility_type === 'warehouse') && (
          <cylinderGeometry args={[2.0, 2.0, 1.8, 16]} />
        )}
        {node.facility_type === 'retailer' && (
          <octahedronGeometry args={[1.9, 0]} />
        )}

        <meshStandardMaterial
          color={nodeColor}
          metalness={0.25}
          roughness={0.35}
          emissive={isSelected ? '#d97706' : isDisrupted ? '#b91c1c' : '#000000'}
          emissiveIntensity={isSelected || isDisrupted ? 0.4 : 0.0}
        />
      </mesh>

      {/* HTML Label & Badge */}
      {showLabels && (
        <Html
          position={[0, 2.5, 0]}
          center
          distanceFactor={50}
          className="node-3d-html-container"
        >
          <div
            className={`node-badge-card ${isSelected ? 'badge-selected' : ''} ${
              isDisrupted ? 'badge-disrupted' : ''
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(node.id);
            }}
          >
            <div className="badge-name">{node.name}</div>
            <div className="badge-sub">
              {node.location || config.label}
              {node.demand > 0 && ` • Dem: ${node.demand}`}
              {node.supply_capacity > 0 && ` • Cap: ${node.supply_capacity}`}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

/**
 * 3D Directed Route Link with Quadratic Curve and Direction Arrow
 */
function TransportRouteCurve({
  edge,
  sourcePos,
  targetPos,
  isSelected,
  isDisrupted,
  onSelect,
}: {
  edge: GraphEdge;
  sourcePos: [number, number, number];
  targetPos: [number, number, number];
  isSelected: boolean;
  isDisrupted: boolean;
  onSelect: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  // Compute curved 3D trajectory
  const { curve, midPoint, tangent } = useMemo(() => {
    const vSource = new THREE.Vector3(...sourcePos);
    const vTarget = new THREE.Vector3(...targetPos);

    // Subtle arch in Y and Z to avoid collision
    const distance = vSource.distanceTo(vTarget);
    const archHeight = Math.min(distance * 0.12, 4.0);

    const vMid = new THREE.Vector3()
      .addVectors(vSource, vTarget)
      .multiplyScalar(0.5);
    vMid.y += archHeight;
    vMid.z += (Math.sin(distance) * 2.0);

    const qCurve = new THREE.QuadraticBezierCurve3(vSource, vMid, vTarget);
    const midTangent = qCurve.getTangent(0.5);

    return { curve: qCurve, midPoint: vMid, tangent: midTangent };
  }, [sourcePos, targetPos]);

  // Compute tube geometry with cleanup
  const tubeGeometry = useMemo(() => {
    const radius = isSelected ? 0.45 : hovered ? 0.35 : 0.22;
    return new THREE.TubeGeometry(curve, 32, radius, 8, false);
  }, [curve, isSelected, hovered]);

  useEffect(() => {
    return () => {
      tubeGeometry.dispose();
    };
  }, [tubeGeometry]);

  // Arrow orientation towards destination
  const arrowRotation = useMemo(() => {
    const dir = tangent.clone().normalize();
    const arrow = new THREE.ArrowHelper(dir, midPoint);
    return arrow.rotation;
  }, [tangent, midPoint]);

  const lineColor = isDisrupted
    ? '#ef4444'
    : isSelected
      ? '#f59e0b'
      : hovered
        ? '#0284c7'
        : '#94a3b8';

  return (
    <group>
      <mesh
        geometry={tubeGeometry}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(edge.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'auto';
        }}
      >
        <meshStandardMaterial
          color={lineColor}
          roughness={0.4}
          metalness={0.2}
          transparent={!isSelected && !isDisrupted}
          opacity={isDisrupted ? 1.0 : isSelected ? 1.0 : 0.65}
        />
      </mesh>

      {/* Midpoint Directional Arrow */}
      <mesh position={midPoint} rotation={arrowRotation}>
        <coneGeometry args={[0.7, 1.4, 8]} />
        <meshStandardMaterial
          color={isDisrupted ? '#ef4444' : isSelected ? '#f59e0b' : '#64748b'}
        />
      </mesh>
    </group>
  );
}

/**
 * Animated Shipment Particle traversing a route curve
 */
function AnimatedShipmentMarker({
  sourcePos,
  targetPos,
  progressOffset,
}: {
  sourcePos: [number, number, number];
  targetPos: [number, number, number];
  progressOffset: number;
}) {
  const markerRef = useRef<THREE.Mesh>(null);

  const curve = useMemo(() => {
    const vSource = new THREE.Vector3(...sourcePos);
    const vTarget = new THREE.Vector3(...targetPos);
    const vMid = new THREE.Vector3().addVectors(vSource, vTarget).multiplyScalar(0.5);
    vMid.y += Math.min(vSource.distanceTo(vTarget) * 0.12, 4.0);
    return new THREE.QuadraticBezierCurve3(vSource, vMid, vTarget);
  }, [sourcePos, targetPos]);

  useFrame(({ clock }) => {
    if (markerRef.current) {
      const t = (clock.getElapsedTime() * 0.35 + progressOffset) % 1.0;
      const point = curve.getPoint(t);
      markerRef.current.position.copy(point);
    }
  });

  return (
    <mesh ref={markerRef}>
      <sphereGeometry args={[0.55, 12, 12]} />
      <meshStandardMaterial
        color="#0284c7"
        emissive="#38bdf8"
        emissiveIntensity={0.8}
      />
    </mesh>
  );
}

export function NetworkDigitalTwin3D({
  graph,
  selectedNodeId,
  onSelectNode,
  selectedEdgeId,
  onSelectEdge,
  disruptedNodeIds = new Set(),
  disruptedEdgeIds = new Set(),
  activeShipments = [],
}: NetworkDigitalTwin3DProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const [showLabels, setShowLabels] = useState(true);

  // Map nodes by ID for fast coordinate lookup
  const nodeMap = useMemo(() => {
    if (!graph) return new Map<string, GraphNode>();
    return new Map(graph.nodes.map((n) => [n.id, n]));
  }, [graph]);

  // Reset Camera View to frame the network
  const handleResetCamera = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
      controlsRef.current.target.set(0, 0, 0);
    }
  };

  if (!graph) {
    return (
      <div className="canvas-empty-state">
        <AlertTriangle size={32} className="dim-icon" />
        <p>No network graph loaded. Select a benchmark scenario above.</p>
      </div>
    );
  }

  return (
    <div className="digital-twin-viewport-container">
      {/* Floating 3D Control Bar */}
      <div className="viewport-overlay-controls">
        <button
          className="viewport-btn"
          onClick={handleResetCamera}
          title="Reset Camera & Center View"
        >
          <RotateCcw size={14} />
          <span>Reset Camera</span>
        </button>

        <button
          className={`viewport-btn ${showLabels ? 'active' : ''}`}
          onClick={() => setShowLabels(!showLabels)}
          title="Toggle Node Text Labels"
        >
          <Tag size={14} />
          <span>{showLabels ? 'Hide Labels' : 'Show Labels'}</span>
        </button>

        <button
          className="viewport-btn"
          onClick={() => {
            onSelectNode(null);
            onSelectEdge(null);
          }}
          title="Clear active node or route selection"
        >
          <Maximize2 size={14} />
          <span>Deselect All</span>
        </button>
      </div>

      {/* Floating 3D Legend */}
      <div className="viewport-legend-card">
        <div className="legend-title">Network Legend</div>
        <div className="legend-items">
          <div className="legend-row">
            <span className="legend-dot" style={{ backgroundColor: '#0284c7' }} />
            <span>Tier 0: Suppliers</span>
          </div>
          <div className="legend-row">
            <span className="legend-dot" style={{ backgroundColor: '#6366f1' }} />
            <span>Tier 1: Factories</span>
          </div>
          <div className="legend-row">
            <span className="legend-dot" style={{ backgroundColor: '#0d9488' }} />
            <span>Tier 2: DCs & Hubs</span>
          </div>
          <div className="legend-row">
            <span className="legend-dot" style={{ backgroundColor: '#059669' }} />
            <span>Tier 3: Retailers</span>
          </div>
          <div className="legend-row">
            <span className="legend-dot" style={{ backgroundColor: '#ef4444' }} />
            <span>Disrupted / Closed</span>
          </div>
          <div className="legend-row">
            <span className="legend-dot" style={{ backgroundColor: '#f59e0b' }} />
            <span>Selected Element</span>
          </div>
        </div>
      </div>

      {/* Main React Three Fiber Canvas */}
      <Canvas
        camera={{ position: [0, -4, 82], fov: 42 }}
        className="r3f-network-canvas"
        onPointerMissed={() => {
          onSelectNode(null);
          onSelectEdge(null);
        }}
      >
        <ambientLight intensity={0.85} />
        <directionalLight position={[20, 40, 30]} intensity={1.1} castShadow />
        <directionalLight position={[-20, -20, 20]} intensity={0.4} />

        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.08}
          minDistance={15}
          maxDistance={180}
          target={[0, 0, 0]}
        />

        {/* Render Directed Routes */}
        {graph.edges.map((edge) => {
          const sNode = nodeMap.get(edge.source);
          const tNode = nodeMap.get(edge.target);
          if (!sNode || !tNode) return null;

          const isDisrupted = disruptedEdgeIds.has(edge.id);
          const isSelected = selectedEdgeId === edge.id;

          return (
            <TransportRouteCurve
              key={edge.id}
              edge={edge}
              sourcePos={[sNode.position.x, sNode.position.y, sNode.position.z]}
              targetPos={[tNode.position.x, tNode.position.y, tNode.position.z]}
              isSelected={isSelected}
              isDisrupted={isDisrupted}
              onSelect={onSelectEdge}
            />
          );
        })}

        {/* Render Facility Nodes */}
        {graph.nodes.map((node) => {
          const isSelected = selectedNodeId === node.id;
          const isDisrupted = disruptedNodeIds.has(node.id);

          return (
            <FacilityMeshNode
              key={node.id}
              node={node}
              isSelected={isSelected}
              isDisrupted={isDisrupted}
              showLabels={showLabels}
              onSelect={onSelectNode}
            />
          );
        })}

        {/* Render Active Animated Shipment Markers during Playback */}
        {activeShipments.slice(0, 30).map((shipment, idx) => {
          const sNode = nodeMap.get(shipment.source_id);
          const tNode = nodeMap.get(shipment.target_id);
          if (!sNode || !tNode) return null;

          return (
            <AnimatedShipmentMarker
              key={`ship-${shipment.shipment_id || idx}`}
              sourcePos={[sNode.position.x, sNode.position.y, sNode.position.z]}
              targetPos={[tNode.position.x, tNode.position.y, tNode.position.z]}
              progressOffset={(idx * 0.17) % 1.0}
            />
          );
        })}
      </Canvas>
    </div>
  );
}
