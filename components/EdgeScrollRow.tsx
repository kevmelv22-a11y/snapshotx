/**
 * Horizontal ScrollView with visible "more" affordances: when content is hidden on an edge a shaded
 * chevron button appears there (tap = scroll one page). `activeKey` scrolls the active child into
 * view, e.g. when the staff bell jumps to the last tab. Pure maths in lib/scroll-affordance.ts.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { hiddenEdges, pageStep, revealOffset, type ScrollMetrics } from '../lib/scroll-affordance';

type Item = { key: string; node: React.ReactNode };

export function EdgeScrollRow({ items, activeKey, style, contentContainerStyle, background, iconColor }: {
  items: Item[]; activeKey?: string; style?: StyleProp<ViewStyle>; contentContainerStyle?: StyleProp<ViewStyle>; background: string; iconColor: string;
}) {
  const ref = useRef<ScrollView>(null);
  const [m, setM] = useState<ScrollMetrics>({ offset: 0, viewport: 0, content: 0 });
  const boxes = useRef<Record<string, { x: number; width: number }>>({});
  const edges = hiddenEdges(m);

  const scrollTo = useCallback((x: number) => { ref.current?.scrollTo({ x, animated: true }); }, []);
  useEffect(() => {
    if (!activeKey) return;
    const box = boxes.current[activeKey];
    if (!box) return;
    const next = revealOffset(box.x, box.width, m);
    if (next != null) scrollTo(next);
    // Only react to a change of the active tab, not to every scroll event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, scrollTo]);

  const onItemLayout = (key: string) => (e: LayoutChangeEvent) => { boxes.current[key] = { x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width }; };

  return <View style={[style, s.wrap]}>
    <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={contentContainerStyle} scrollEventThrottle={32}
      onLayout={e => { const viewport = e.nativeEvent.layout.width; setM(v => ({ ...v, viewport })); }}
      style={s.scroll} onContentSizeChange={content => setM(v => ({ ...v, content }))}
      onScroll={e => { const offset = e.nativeEvent.contentOffset.x; setM(v => (Math.abs(v.offset - offset) < 1 ? v : { ...v, offset })); }}>
      {items.map(item => <View key={item.key} onLayout={onItemLayout(item.key)}>{item.node}</View>)}
    </ScrollView>
    {edges.left && <Pressable onPress={() => scrollTo(pageStep(-1, m))} style={[s.edge, s.left]} accessibilityRole="button" accessibilityLabel="Vorige tabbladen tonen">
      <View style={[s.solid, { backgroundColor: background }]}><Ionicons name="chevron-back" size={16} color={iconColor} /></View>
      <View style={[s.fade, { backgroundColor: background, opacity: 0.75 }]} /><View style={[s.fade, { backgroundColor: background, opacity: 0.4 }]} />
    </Pressable>}
    {edges.right && <Pressable onPress={() => scrollTo(pageStep(1, m))} style={[s.edge, s.right]} accessibilityRole="button" accessibilityLabel="Meer tabbladen tonen">
      <View style={[s.fade, { backgroundColor: background, opacity: 0.4 }]} /><View style={[s.fade, { backgroundColor: background, opacity: 0.75 }]} />
      <View style={[s.solid, { backgroundColor: background }]}><Ionicons name="chevron-forward" size={16} color={iconColor} /></View>
    </Pressable>}
  </View>;
}

const s = StyleSheet.create({
  wrap: { position: 'relative' },
  scroll: { flexGrow: 0 },
  // Solid chevron cell plus two translucent strips: a cheap fade without a gradient dependency.
  edge: { position: 'absolute', top: 0, bottom: 1, flexDirection: 'row' },
  left: { left: 0 },
  right: { right: 0 },
  solid: { width: 30, alignItems: 'center', justifyContent: 'center' },
  fade: { width: 9 },
});
