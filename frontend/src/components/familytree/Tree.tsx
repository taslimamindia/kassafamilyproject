import React, { useEffect, useState, useCallback } from 'react';
import ReactFlow, {
    useNodesState,
    useEdgesState,
    Handle,
    Position,
    Background,
    Controls,
    MarkerType,
    useReactFlow,
    ReactFlowProvider,
    type Node
} from 'reactflow';
import dagre from 'dagre';
import { fetchRawUsers, type RawUser } from '@src/services/tree';
import 'reactflow/dist/style.css';
import './Tree.css';

const UserAvatar = ({ url, firstname, lastname, size = 60 }: { url: string | null, firstname: string, lastname: string, size?: number }) => {
    const style: React.CSSProperties = {
        width: size,
        height: size,
        objectFit: 'cover',
        borderRadius: '50%',
        border: '3px solid #fff',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        display: 'block'
    }

    if (url) {
        return <img src={url} alt={firstname} className={`node-avatar rounded-circle ${size > 100 ? 'large-avatar' : ''}`} style={style} />;
    }
    const initials = `${firstname.charAt(0)}${lastname.charAt(0)}`.toUpperCase();
    return (
        <div className={`node-avatar-placeholder rounded-circle d-flex align-items-center justify-content-center bg-secondary text-white ${size > 100 ? 'large-avatar' : ''}`} style={style}>
            {initials}
        </div>
    );
};

export const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return isMobile;
};

const FamilyNode = ({ data }: any) => {
    return (
        <div className="family-card card shadow-sm text-center">
            <div className="card-body p-2 d-flex flex-column align-items-center">
                <div className="mb-2 avatar-container">
                    <UserAvatar url={data.image_url} firstname={data.firstname} lastname={data.lastname} />
                </div>

                <h6 className="card-title mb-0 text-dark fw-bold" style={{ fontSize: '0.9rem' }}>
                    {data.firstname} {data.lastname}
                </h6>

                <button className="btn btn-sm btn-outline-primary py-0 px-2" style={{ fontSize: '0.7rem' }}>
                    Voir détails
                </button>
            </div>

            <Handle type="target" position={Position.Top} className="custom-handle" />
            <Handle type="source" position={Position.Bottom} className="custom-handle" />
        </div>
    );
};

const nodeTypes = { familyNode: FamilyNode };

// Extract year from date string
const getYear = (dateStr: string | null): number | null => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return null;
    return date.getUTCFullYear();
};

// Recursive move (used by children magnet)
const moveSubtree = (
    rootId: string,
    dx: number,
    nodesMap: Record<string, { x: number; y: number; data: RawUser }>,
    allUsers: RawUser[]
) => {
    const queue = [rootId];
    const visited = new Set<string>();

    while (queue.length > 0) {
        const currentId = queue.shift()!;
        if (visited.has(currentId)) continue;
        visited.add(currentId);

        if (nodesMap[currentId]) {
            nodesMap[currentId].x += dx;
        }

        const children = allUsers.filter(u =>
            u.id_father?.toString() === currentId ||
            u.id_mother?.toString() === currentId
        );
        children.forEach(child => queue.push(child.id.toString()));
    }
};

// Main layout function
const getLayoutedElements = (users: RawUser[], isMobile: boolean) => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    // Dimensions and spacing
    const nodeWidth = isMobile ? 140 : 180;
    const nodeHeight = isMobile ? 160 : 180;
    const rankSep = isMobile ? 100 : 120;
    const nodeSep = isMobile ? 40 : 80;

    // STEP 0: Sort by family
    const sortedUsers = [...users].sort((a, b) => {
        const fatherA = a.id_father || 0;
        const fatherB = b.id_father || 0;
        if (fatherA !== fatherB) return fatherA - fatherB;
        return (a.id_mother || 0) - (b.id_mother || 0);
    });

    dagreGraph.setGraph({ rankdir: 'TB', nodesep: nodeSep, ranksep: rankSep });
    sortedUsers.forEach((u) => dagreGraph.setNode(u.id.toString(), { width: nodeWidth, height: nodeHeight }));

    const initialEdges: any[] = [];
    sortedUsers.forEach((u) => {
        if (u.id_father) initialEdges.push({ id: `f-${u.id}`, source: u.id_father.toString(), target: u.id.toString(), className: 'edge-father' });
        if (u.id_mother) initialEdges.push({ id: `m-${u.id}`, source: u.id_mother.toString(), target: u.id.toString(), className: 'edge-mother' });
    });
    initialEdges.forEach((edge) => dagreGraph.setEdge(edge.source, edge.target));

    // STEP 1: Initial dagre layout
    dagre.layout(dagreGraph);

    const nodesMap: Record<string, { x: number; y: number; data: RawUser }> = {};
    sortedUsers.forEach(u => {
        const pos = dagreGraph.node(u.id.toString());
        nodesMap[u.id] = { x: pos.x, y: pos.y, data: u };
    });

    // STEP 2: Generational alignment for orphans
    Object.keys(nodesMap).forEach((id) => {
        const node = nodesMap[id];
        const hasNoParents = !node.data.id_father && !node.data.id_mother;
        const myYear = getYear(node.data.birthday);

        if (hasNoParents && myYear) {
            let closestY = node.y;
            let minDiff = Infinity;
            Object.values(nodesMap).forEach((other) => {
                if (other.data.id === node.data.id) return;
                if (!other.data.id_father && !other.data.id_mother) return;
                const otherYear = getYear(other.data.birthday);
                if (otherYear) {
                    const diff = Math.abs(myYear - otherYear);
                    if (diff < minDiff) { minDiff = diff; closestY = other.y; }
                }
            });
            if (minDiff < 15) node.y = closestY;
        }
    });

    // STEP 2.5: Bring parents closer when they form a couple
    const processedCouples = new Set<string>();

    sortedUsers.forEach(u => {
        if (u.id_father && u.id_mother) {
            const coupleKey = [u.id_father, u.id_mother].sort().join('-');

            if (!processedCouples.has(coupleKey)) {
                processedCouples.add(coupleKey);

                const nodeA = nodesMap[u.id_father];
                const nodeB = nodesMap[u.id_mother];

                if (nodeA && nodeB && Math.abs(nodeA.y - nodeB.y) < nodeHeight) {
                    const currentDist = Math.abs(nodeA.x - nodeB.x);
                    const idealDist = nodeWidth + (isMobile ? 20 : 40);

                    if (currentDist > idealDist) {
                        const center = (nodeA.x + nodeB.x) / 2;
                        const targetDistHalved = idealDist / 2;

                        if (nodeA.x < nodeB.x) {
                            nodeA.x = center - targetDistHalved;
                            nodeB.x = center + targetDistHalved;
                        } else {
                            nodeB.x = center - targetDistHalved;
                            nodeA.x = center + targetDistHalved;
                        }
                    }
                }
            }
        }
    });

    // STEP 3: Children magnet (align children under parents)
    const parents = sortedUsers.filter(u =>
        sortedUsers.some(child => child.id_father === u.id || child.id_mother === u.id)
    );

    parents.forEach(parent => {
        const children = sortedUsers.filter(u => u.id_father === parent.id || u.id_mother === parent.id);
        if (children.length === 0) return;

        // Compute parent center (consider spouse if aligned)
        let parentCenterX = nodesMap[parent.id].x;
        const spouseId = children[0].id_father === parent.id ? children[0].id_mother : children[0].id_father;
        if (spouseId && nodesMap[spouseId]) {
            if (Math.abs(nodesMap[parent.id].y - nodesMap[spouseId].y) < 50) {
                parentCenterX = (nodesMap[parent.id].x + nodesMap[spouseId].x) / 2;
            }
        }

        // Compute children center
        let minChildX = Infinity, maxChildX = -Infinity;
        children.forEach(c => {
            const cx = nodesMap[c.id].x;
            if (cx < minChildX) minChildX = cx;
            if (cx > maxChildX) maxChildX = cx;
        });
        const childrenCenterX = (minChildX + maxChildX) / 2;

        const shiftX = parentCenterX - childrenCenterX;

        if (Math.abs(shiftX) > 1) {
            children.forEach(child => {
                moveSubtree(child.id.toString(), shiftX, nodesMap, sortedUsers);
            });
        }
    });

    // STEP 4: Ensure children are below parents vertically
    for (let i = 0; i < 3; i++) {
        initialEdges.forEach((edge) => {
            const parentNode = nodesMap[edge.source];
            const childNode = nodesMap[edge.target];
            if (parentNode && childNode) {
                const minChildY = parentNode.y + rankSep;
                if (childNode.y < minChildY) childNode.y = minChildY;
            }
        });
    }

    // STEP 4.5: Global vertical expansion to avoid overlapping rows
    const rows: Record<number, RawUser[]> = {};
    const TOLERANCE = 10;

    Object.values(nodesMap).forEach(node => {
        let foundRowY = Object.keys(rows).map(Number).find(y => Math.abs(y - node.y) < TOLERANCE);

        if (foundRowY === undefined) {
            foundRowY = node.y;
            rows[foundRowY] = [];
        }
        rows[foundRowY].push(node.data);
    });

    const sortedRowYs = Object.keys(rows).map(Number).sort((a, b) => a - b);

    let currentShiftY = 0;
    const MIN_ROW_GAP = nodeHeight + (isMobile ? 40 : 80);

    for (let i = 1; i < sortedRowYs.length; i++) {
        const prevY = sortedRowYs[i - 1];
        const currY = sortedRowYs[i];

        const idealY = prevY + MIN_ROW_GAP;

        if (currY < idealY) {
            const neededShift = idealY - currY;
            currentShiftY += neededShift;
        }

        if (currentShiftY > 0) {
            rows[currY].forEach(u => {
                nodesMap[u.id].y += currentShiftY;
            });
            sortedRowYs[i] += currentShiftY;
        }
    }

    // STEP 5: Resolve horizontal collisions
    const nodeList = Object.values(nodesMap);
    nodeList.sort((a, b) => {
        if (Math.abs(a.y - b.y) < nodeHeight) return a.x - b.x;
        return a.y - b.y;
    });

    for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < nodeList.length - 1; i++) {
            const current = nodeList[i];
            const next = nodeList[i + 1];

            const areOnSameLevel = Math.abs(current.y - next.y) < nodeHeight;

            if (areOnSameLevel) {
                const minDistance = nodeWidth + (isMobile ? 30 : 60);
                const currentDistance = next.x - current.x;

                if (currentDistance < minDistance) {
                    const shift = minDistance - currentDistance;
                    next.x += shift;
                    if (Math.abs(current.y - next.y) < 50) next.y = current.y;
                }
            }
        }
    }

    // FINALIZATION
    const layoutedNodes = sortedUsers.map((u) => {
        const pos = nodesMap[u.id];
        return {
            id: u.id.toString(),
            type: 'familyNode',
            data: { ...u },
            position: {
                x: pos.x - (nodeWidth / 2),
                y: pos.y - (nodeHeight / 2),
            },
            style: { width: nodeWidth }
        };
    });

    const layoutedEdges = initialEdges.map((edge) => ({
        ...edge,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, color: edge.className === 'edge-father' ? '#0d6efd' : '#d63384' },
    }));

    return { nodes: layoutedNodes, edges: layoutedEdges };
};

const TreeContent = () => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    const [showModal, setShowModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState<RawUser | null>(null);

    const { fitView } = useReactFlow();
    const isMobile = useIsMobile();

    useEffect(() => {
        fetchRawUsers().then((rawData) => {
            const { nodes: lNodes, edges: lEdges } = getLayoutedElements(rawData, isMobile);
            setNodes(lNodes);
            setEdges(lEdges);
            setTimeout(() => fitView({ padding: 0.2 }), 100);
        });
    }, [isMobile, fitView, setNodes, setEdges]);

    const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
        setSelectedUser(node.data);
        setShowModal(true);
    }, []);

    const closeModal = () => setShowModal(false);

    return (
        <>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                fitView
                minZoom={0.5}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                zoomOnDoubleClick={false}
            >
                <Controls showInteractive={!isMobile} />
                <Background color="#ffffff" gap={0} />
            </ReactFlow>

            {showModal && selectedUser && (
                <>
                    <div className="modal fade show d-block" tabIndex={-1} role="dialog" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)' }}>
                        <div className="modal-dialog modal-dialog-centered" role="document">
                            <div className="modal-content border-0 shadow rounded-4">
                                <div className="modal-header border-0">
                                    <h5 className="modal-title fw-bold">Détails de {selectedUser.firstname}</h5>
                                    <button type="button" className="btn-close" onClick={closeModal}></button>
                                </div>
                                <div className="modal-body px-4">
                                    <div className="text-center mb-4">
                                        <UserAvatar url={selectedUser.image_url} firstname={selectedUser.firstname} lastname={selectedUser.lastname} size={200} />
                                        <h3 className="mt-3 fw-bold">{selectedUser.firstname} {selectedUser.lastname}</h3>
                                    </div>

                                    <div className="card border-0 bg-light rounded-4">
                                        <div className="card-body p-3">
                                            <div className="d-flex align-items-center mb-3 p-2 bg-white rounded shadow-sm">
                                                <div className="me-3 fs-3">🎂</div>
                                                <div>
                                                    <small className="text-muted fw-bold d-block" style={{ fontSize: '0.75rem' }}>DATE DE NAISSANCE</small>
                                                    <span className="fw-medium">{selectedUser.birthday || 'N/A'}</span>
                                                </div>
                                            </div>
                                            <div className="d-flex align-items-center mb-3 p-2 bg-white rounded shadow-sm">
                                                <div className="me-3 fs-3">👨‍👦</div>
                                                <div>
                                                    <small className="text-muted fw-bold d-block" style={{ fontSize: '0.75rem' }}>PÈRE</small>
                                                    <span className="fw-medium">{selectedUser.father_name || 'Non renseigné'}</span>
                                                </div>
                                            </div>
                                            <div className="d-flex align-items-center p-2 bg-white rounded shadow-sm">
                                                <div className="me-3 fs-3">👩‍👦</div>
                                                <div>
                                                    <small className="text-muted fw-bold d-block" style={{ fontSize: '0.75rem' }}>MÈRE</small>
                                                    <span className="fw-medium">{selectedUser.mother_name || 'Non renseigné'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer border-0 justify-content-center pb-4">
                                    <button type="button" className="btn btn-primary px-5 rounded-pill fw-bold shadow-sm" onClick={closeModal}>Fermer</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="modal-backdrop show" onClick={closeModal} style={{ zIndex: -1 }}></div>
                </>
            )}
        </>
    );
};

const Tree = () => (
    <div className="tree-wrapper">
        <ReactFlowProvider>
            <TreeContent />
        </ReactFlowProvider>
    </div>
);

export default Tree;
