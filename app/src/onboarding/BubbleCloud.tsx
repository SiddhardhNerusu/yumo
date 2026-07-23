import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, TextInput, useWindowDimensions } from 'react-native';
import {
  forceSimulation,
  forceManyBody,
  forceCollide,
  forceX,
  forceY,
  type Simulation,
  type SimulationNodeDatum,
} from 'd3-force';
import { useTheme } from '../theme';
import { RELATED } from '../data/food-graph';

/**
 * Dynamic bubble-selection cloud (§2.2). Parent foods float; tapping one
 * fans its related foods out around it with a d3-force collision simulation
 * (Apple-Music / Pinterest style). Tap again to collapse. Selection tracks
 * the food *label*. Runs entirely in JS (d3-force) — no native code.
 */
interface Node extends SimulationNodeDatum {
  id: string; // unique node key (compound for children)
  label: string; // the food name = selection value
  kind: 'parent' | 'child';
  parentId?: string;
  r: number;
}

const clampN = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const PARENT_R = 45;
const CHILD_R = 38;

export function BubbleCloud({
  parents,
  selected,
  onToggle,
  max,
  height = 500,
}: {
  parents: string[];
  selected: string[];
  onToggle: (label: string) => void;
  max?: number;
  height?: number;
}) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const W = width - 40;
  const H = height;
  const cx = W / 2;
  const cy = H / 2;

  const nodesRef = useRef<Node[]>([]);
  const simRef = useRef<Simulation<Node, undefined> | null>(null);
  const frame = useRef(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [, setTick] = useState(0);
  const [query, setQuery] = useState('');

  // every food reachable from the cloud (parents + their related children), for search.
  const vocab = useMemo(() => {
    const set = new Set<string>(parents);
    for (const p of parents) for (const ch of RELATED[p] ?? []) set.add(ch);
    return [...set];
  }, [parents]);
  const q = query.trim().toLowerCase();
  const results = q ? vocab.filter((v) => v.toLowerCase().includes(q)) : [];

  // Build parent bubbles + start the simulation once.
  useEffect(() => {
    const parentNodes: Node[] = parents.map((p, i) => {
      const a = (i / parents.length) * Math.PI * 2;
      return { id: p, label: p, kind: 'parent', r: PARENT_R, x: cx + Math.cos(a) * W * 0.32, y: cy + Math.sin(a) * H * 0.3 };
    });
    nodesRef.current = parentNodes;
    const sim = forceSimulation<Node>(parentNodes)
      .alphaDecay(0.045)
      .force('charge', forceManyBody<Node>().strength(-6))
      .force('x', forceX<Node>(cx).strength(0.035))
      .force('y', forceY<Node>(cy).strength(0.05))
      .force('collide', forceCollide<Node>().radius((d) => d.r + 4).strength(0.9))
      .on('tick', () => {
        for (const n of nodesRef.current) {
          n.x = clampN(n.x ?? cx, n.r, W - n.r);
          n.y = clampN(n.y ?? cy, n.r, H - n.r);
        }
        frame.current += 1;
        if (frame.current % 2 === 0) setTick((t) => t + 1); // render ~30fps while hot
      });
    simRef.current = sim;
    return () => {
      sim.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Add/remove child bubbles when a parent expands/collapses.
  useEffect(() => {
    const sim = simRef.current;
    if (!sim) return;
    const want = new Set<string>();
    for (const p of expanded) for (const ch of RELATED[p] ?? []) want.add(`${p}›${ch}`);

    const cur = nodesRef.current;
    const next = cur.filter((n) => n.kind === 'parent' || want.has(n.id));
    const have = new Set(next.map((n) => n.id));
    for (const p of expanded) {
      const parent = cur.find((n) => n.id === p);
      const kids = RELATED[p] ?? [];
      kids.forEach((ch, i) => {
        const id = `${p}›${ch}`;
        if (have.has(id)) return;
        const a = (i / Math.max(1, kids.length)) * Math.PI * 2;
        next.push({
          id,
          label: ch,
          kind: 'child',
          parentId: p,
          r: CHILD_R,
          x: (parent?.x ?? cx) + Math.cos(a) * 8,
          y: (parent?.y ?? cy) + Math.sin(a) * 8,
        });
      });
    }
    nodesRef.current = next;
    sim.nodes(next);
    sim.alpha(0.9).restart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  const atMax = max != null && selected.length >= max;
  const trySelect = (label: string) => {
    if (!selected.includes(label) && atMax) return;
    onToggle(label);
  };
  const onTap = (n: Node) => {
    if (n.kind === 'parent') {
      setExpanded((prev) => {
        const s = new Set(prev);
        if (s.has(n.id)) s.delete(n.id);
        else s.add(n.id);
        return s;
      });
    }
    trySelect(n.label);
  };

  return (
    <View>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search foods…"
        placeholderTextColor={c('textMuted')}
        autoCorrect={false}
        style={{ backgroundColor: c('surface'), borderWidth: 1, borderColor: c('border'), borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: c('textPrimary'), fontSize: 14, marginBottom: 12 }}
      />
      {q ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, minHeight: 120 }}>
          {results.length === 0 ? (
            <Text style={{ color: c('textMuted'), fontSize: 13, paddingVertical: 6 }}>Nothing matches.</Text>
          ) : results.map((label) => {
            const sel = selected.includes(label);
            const disabled = !sel && atMax;
            return (
              <Pressable
                key={label}
                onPress={() => trySelect(label)}
                style={{ backgroundColor: sel ? c('accent') : c('surface'), borderWidth: 1, borderColor: sel ? c('accent') : c('border'), borderRadius: 999, paddingVertical: 9, paddingHorizontal: 15, opacity: disabled ? 0.4 : 1 }}
              >
                <Text style={{ color: sel ? c('accentText') : c('textSecondary'), fontSize: 14, fontWeight: '600' }}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
    <View style={{ height: H, width: W, alignSelf: 'center' }}>
      {nodesRef.current.map((n) => {
        const sel = selected.includes(n.label);
        const isParent = n.kind === 'parent';
        return (
          <Pressable
            key={n.id}
            onPress={() => onTap(n)}
            style={{
              position: 'absolute',
              left: (n.x ?? cx) - n.r,
              top: (n.y ?? cy) - n.r,
              width: n.r * 2,
              height: n.r * 2,
              borderRadius: n.r,
              alignItems: 'center',
              justifyContent: 'center',
              padding: 6,
              backgroundColor: sel ? c('accent') : isParent ? c('surface') : c('surfaceSunken'),
              borderWidth: sel ? 0 : 1,
              borderColor: c('border'),
            }}
          >
            <Text
              numberOfLines={2}
              style={{
                color: sel ? c('accentText') : c('textPrimary'),
                fontWeight: isParent ? '700' : '600',
                fontSize: n.label.length > 9 ? 11 : 13,
                textAlign: 'center',
              }}
            >
              {n.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
      )}
    </View>
  );
}
