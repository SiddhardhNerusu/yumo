import type { ReactNode } from 'react';
import Svg, { Path, Circle, Rect, Ellipse, Polygon, Line, Text as SvgText } from 'react-native-svg';
import { categoryFor } from '../../data/shelf-life';

/**
 * §2.3 illustrated ingredient glyphs — flat duotone SVGs (body + accent), no
 * photography. A starter set keyed by token/category; anything unknown gets a
 * serif-monogram fallback so the shelf never looks broken. Grows over time.
 */
type GlyphFn = (body: string, accent: string) => ReactNode;

const G: Record<string, GlyphFn> = {
  poultry: (b, a) => (
    <>
      <Path d="M7 15c-2 0-3-2-2-4 1-3 4-5 7-5 4 0 7 3 6 7-1 3-4 4-7 4" fill={b} />
      <Circle cx={17} cy={7} r={2.4} fill={a} />
      <Line x1={7} y1={15} x2={5} y2={19} stroke={a} strokeWidth={2.2} strokeLinecap="round" />
    </>
  ),
  red_meat: (b, a) => (
    <>
      <Path d="M6 12c0-3 3-5 7-5s7 2 7 5-3 6-7 6-7-3-7-6z" fill={b} />
      <Circle cx={13} cy={12} r={2.6} fill={a} />
    </>
  ),
  fish: (b, a) => (
    <>
      <Ellipse cx={12} cy={12} rx={7} ry={4.2} fill={b} />
      <Polygon points="19,12 23,8 23,16" fill={b} />
      <Circle cx={8} cy={11} r={1.2} fill={a} />
    </>
  ),
  dairy_milk: (b, a) => (
    <>
      <Path d="M8 9h8v11H8z" fill={b} />
      <Path d="M8 9l4-3 4 3z" fill={a} />
    </>
  ),
  dairy_soft: (b, a) => (
    <>
      <Path d="M7 9h10l-1 10H8z" fill={b} />
      <Rect x={9} y={6} width={6} height={3} rx={1} fill={a} />
    </>
  ),
  dairy_hard: (b, a) => (
    <>
      <Polygon points="5,17 19,17 19,9" fill={b} />
      <Circle cx={13} cy={14} r={1} fill={a} />
      <Circle cx={16} cy={12.5} r={0.9} fill={a} />
    </>
  ),
  eggs: (b, a) => (
    <>
      <Ellipse cx={12} cy={13} rx={5} ry={6.5} fill={b} />
      <Circle cx={12} cy={13} r={2.4} fill={a} />
    </>
  ),
  leafy: (b, a) => (
    <>
      <Path d="M6 18c0-7 6-11 12-12-1 8-6 12-12 12z" fill={b} />
      <Path d="M8 16c3-4 6-6 9-8" stroke={a} strokeWidth={1.6} fill="none" strokeLinecap="round" />
    </>
  ),
  veg: (b, a) => (
    <>
      <Circle cx={9} cy={9} r={3.2} fill={b} />
      <Circle cx={14} cy={8} r={3.2} fill={b} />
      <Circle cx={12} cy={12} r={3.2} fill={b} />
      <Rect x={11} y={13} width={2} height={6} rx={1} fill={a} />
    </>
  ),
  root: (b, a) => (
    <>
      <Circle cx={12} cy={13} r={6} fill={b} />
      <Path d="M12 7v-3M9 8l-2-2M15 8l2-2" stroke={a} strokeWidth={1.6} strokeLinecap="round" />
    </>
  ),
  carrot: (b, a) => (
    <>
      <Polygon points="8,10 16,10 12,20" fill={a} />
      <Path d="M10 10c0-3 1-5 2-5s2 2 2 5" fill={b} />
    </>
  ),
  banana: (b, a) => (
    <>
      <Path d="M5 8c1 8 7 12 14 10-2-1-3-3-3-5 0 0-5 2-8-1S6 8 5 8z" fill={a} />
    </>
  ),
  apple: (b, a) => (
    <>
      <Circle cx={12} cy={14} r={6} fill={b} />
      <Path d="M12 8V5" stroke={a} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M12 6c2-2 4-1 4 1-2 0-4 0-4-1z" fill={a} />
    </>
  ),
  bread: (b, a) => (
    <>
      <Path d="M5 12c0-3 3-5 7-5s7 2 7 5v6H5z" fill={b} />
      <Line x1={9} y1={11} x2={9} y2={17} stroke={a} strokeWidth={1.4} strokeLinecap="round" />
      <Line x1={13} y1={11} x2={13} y2={17} stroke={a} strokeWidth={1.4} strokeLinecap="round" />
    </>
  ),
  tofu: (b, a) => (
    <>
      <Path d="M6 10l6-3 6 3v7l-6 3-6-3z" fill={b} />
      <Path d="M6 10l6 3 6-3M12 13v7" stroke={a} strokeWidth={1.4} fill="none" />
    </>
  ),
  dry: (b, a) => (
    <>
      <Path d="M6 12h12l-1 7H7z" fill={b} />
      <Path d="M6 12c0-2 2.5-3 6-3s6 1 6 3" fill={a} />
    </>
  ),
  tinned: (b, a) => (
    <>
      <Rect x={8} y={8} width={8} height={11} rx={1} fill={b} />
      <Ellipse cx={12} cy={8} rx={4} ry={1.6} fill={a} />
    </>
  ),
  nut: (b, a) => (
    <>
      <Ellipse cx={12} cy={12} rx={4} ry={5.5} fill={b} />
      <Path d="M12 7v10" stroke={a} strokeWidth={1.4} strokeLinecap="round" />
    </>
  ),
  condiment: (b, a) => (
    <>
      <Rect x={9} y={9} width={6} height={10} rx={2} fill={b} />
      <Rect x={10.5} y={5} width={3} height={4} rx={1} fill={a} />
    </>
  ),
  legume_dry: (b, a) => (
    <>
      <Circle cx={9} cy={13} r={2.4} fill={b} />
      <Circle cx={14} cy={11} r={2.4} fill={b} />
      <Circle cx={13} cy={15} r={2.4} fill={a} />
    </>
  ),
  frozen: (b, a) => (
    <>
      <Path d="M12 4v16M5 8l14 8M19 8L5 16" stroke={b} strokeWidth={2} strokeLinecap="round" />
      <Circle cx={12} cy={12} r={2} fill={a} />
    </>
  ),
};

/** Token substring → glyph key, for specifics that share a category. */
const SPECIAL: Array<[RegExp, string]> = [
  [/banana/, 'banana'],
  [/apple|pear/, 'apple'],
  [/carrot/, 'carrot'],
  [/yogurt|yoghurt/, 'dairy_soft'],
];

function pick(token: string): GlyphFn | null {
  const t = token.toLowerCase();
  for (const [re, key] of SPECIAL) if (re.test(t)) return G[key] ?? null;
  const cat = categoryFor(t);
  return cat && G[cat] ? G[cat] : null;
}

export function Glyph({ token, size = 26, body, accent, mono }: { token: string; size?: number; body: string; accent: string; mono: string }) {
  const fn = pick(token);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {fn ? (
        fn(body, accent)
      ) : (
        <SvgText x={12} y={17} fontSize={15} fontWeight="600" fill={mono} textAnchor="middle" fontFamily="Newsreader_500Medium">
          {(token.trim()[0] ?? '?').toUpperCase()}
        </SvgText>
      )}
    </Svg>
  );
}
