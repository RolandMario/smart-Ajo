import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G, Text as SvgText } from "react-native-svg";
import { colors, radii, spacing, typography } from "../theme";
import type { PopulatedContribution, GroupMemberUser } from "../types/api";

/**
 * Cycle ring — the Kolo cycle visual on the light forest canvas: a dashed
 * orbit with one node per contributor, rotation position 1 at the top and
 * moving clockwise, and a pot-total overlay in the centre.
 *
 * Node language (matches the design mock):
 *  - gold fill + soft gold halo → the cycle's recipient
 *  - ✓ on a green chip → that member's contribution is paid
 *  - the member's rotation number on a plain chip → contribution pending
 *  - ✗ on a red chip → that member's contribution defaulted
 *  - a thin forest ring around "your" node
 *
 * Circles with more than `MAX_RING_MEMBERS` accepted members fall back to a
 * wrapped chip grid (ajo-server allows up to 200 slots, where a legible
 * ring stops well before that).
 */

export type RingNodeState = "pending" | "paid" | "recipient" | "defaulted";

export interface MemberRingNode {
  id: string;
  /** Rotation slot (1-based). The recipient's slot equals `cycleNumber`. */
  position: number;
  /** Display name or phone for accessibility labels. */
  name: string;
  state: RingNodeState;
  isMe: boolean;
}

/** The subset of a group member the ring needs to resolve rotation slots. */
export interface RingMemberSource {
  _id: string;
  position: number | null;
  user: GroupMemberUser;
}

export interface BuildRingNodesParams {
  contributions: Pick<
    PopulatedContribution,
    "_id" | "member" | "user" | "status"
  >[];
  /** Group roster (positions may be null before the rotation is locked). */
  members: RingMemberSource[];
  /** The current cycle's recipient rotation slot, if known. */
  recipientPosition: number | null;
  currentUserId?: string | null;
}

/** Past this many contributors the ring becomes unreadable → chip grid. */
export const MAX_RING_MEMBERS = 20;

/**
 * Pure mapping from cycle contributions + the group roster to ring nodes,
 * one per contribution, positioned at each member's locked rotation slot.
 * Positions resolve through the roster; any contribution without a known
 * member falls into the first unused slot so the ring always has exactly
 * `contributions.length` nodes in positions 1..N.
 */
export function buildRingNodes({
  contributions,
  members,
  recipientPosition,
  currentUserId,
}: BuildRingNodesParams): MemberRingNode[] {
  const positionByMemberId = new Map<string, number>();
  const used = new Set<number>();
  for (const member of members) {
    if (member.position != null && member.position >= 1) {
      positionByMemberId.set(member._id, member.position);
      used.add(member.position);
    }
  }

  const bound = Math.max(
    contributions.length,
    members.length,
    recipientPosition ?? 0,
  );
  const pool: number[] = [];
  for (let slot = 1; slot <= bound; slot += 1) {
    if (!used.has(slot)) pool.push(slot);
  }

  const nodes = contributions.map((contribution, index) => {
    let position = contribution.member
      ? positionByMemberId.get(contribution.member)
      : undefined;
    if (position == null) {
      position = pool.length > 0 ? pool.shift()! : index + 1;
    }

    const isRecipient =
      recipientPosition != null && position === recipientPosition;
    const state: RingNodeState = isRecipient
      ? "recipient"
      : contribution.status === "defaulted"
        ? "defaulted"
        : contribution.status === "paid"
          ? "paid"
          : "pending";

    return {
      id: contribution._id,
      position,
      name: contribution.user.name ?? contribution.user.phone,
      state,
      isMe:
        currentUserId != null && contribution.user._id === currentUserId,
    };
  });

  return nodes.sort((a, b) => a.position - b.position);
}

interface MemberRingProps {
  nodes: MemberRingNode[];
  /**
   * Centre overlay for the orbit (pot total + subline in practice). In grid
   * (fallback) mode it is rendered as a header above the chips instead.
   */
  center?: React.ReactNode;
}

/** Visuals for a node state: chip fill, rim and its reading. */
function paintForNode(
  node: MemberRingNode,
): { fill: string; stroke?: string; foreground: string; fontSize: number } {
  const numberFontSize = 11;
  const glyphFontSize = 13;
  switch (node.state) {
    case "recipient":
      return {
        fill: colors.gold,
        stroke: undefined,
        foreground: colors.onGold,
        fontSize: numberFontSize,
      };
    case "paid":
      return {
        fill: colors.successSoft,
        stroke: colors.success,
        foreground: colors.success,
        fontSize: glyphFontSize,
      };
    case "defaulted":
      return {
        fill: colors.dangerSoft,
        stroke: colors.danger,
        foreground: colors.danger,
        fontSize: glyphFontSize,
      };
    default:
      return {
        fill: colors.white,
        stroke: colors.forestLightLine,
        foreground: colors.forestLightInkFaint,
        fontSize: numberFontSize,
      };
  }
}

function nodeGlyph(node: MemberRingNode): string {
  switch (node.state) {
    case "paid":
      return "\u2713";
    case "defaulted":
      return "\u2717";
    default:
      return String(node.position);
  }
}

function nodeAccessibilityLabel(node: MemberRingNode): string {
  const stateLabel: Record<RingNodeState, string> = {
    pending: "contribution pending",
    paid: "contribution paid",
    recipient: "receiving this cycle",
    defaulted: "contribution defaulted",
  };
  const you = node.isMe ? " (you)" : "";
  return `${node.name}${you} — ${stateLabel[node.state]}`;
}

const RING_BOX = 280;
const RING_CENTER = RING_BOX / 2;
const ORBIT_RADIUS = 98;
const NODE_RADIUS = 17;

export function MemberRing({ nodes, center }: MemberRingProps) {
  if (nodes.length === 0) return null;

  if (nodes.length > MAX_RING_MEMBERS) {
    return (
      <View style={styles.gridContainer}>
        {center != null ? <View style={styles.gridHeader}>{center}</View> : null}
        <View style={styles.grid}>
          {nodes.map((node) => {
            const paint = paintForNode(node);
            return (
              <View
                key={node.id}
                accessible={false}
                accessibilityLabel={nodeAccessibilityLabel(node)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: paint.fill,
                    borderColor: paint.stroke ?? colors.forestLightLine,
                  },
                  node.isMe && styles.chipMine,
                  node.state === "recipient" && styles.chipRecipient,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: paint.foreground, fontSize: paint.fontSize },
                  ]}
                  adjustsFontSizeToFit
                  numberOfLines={1}
                >
                  {nodeGlyph(node)}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  const step = (2 * Math.PI) / nodes.length;

  return (
    <View style={styles.ringContainer}>
      <Svg
        width={RING_BOX}
        height={RING_BOX}
        viewBox={`0 0 ${RING_BOX} ${RING_BOX}`}
      >
        {/* Dashed orbit */}
        <Circle
          cx={RING_CENTER}
          cy={RING_CENTER}
          r={ORBIT_RADIUS}
          fill="none"
          stroke={colors.forestLightLine}
          strokeWidth={1.5}
          strokeDasharray="2 6"
          strokeLinecap="round"
        />

        {nodes.map((node, index) => {
          // Position 1 at the top; +step per node; SVG's y-axis points down,
          // so increasing the angle sweeps clockwise around the screen.
          const angle = -Math.PI / 2 + index * step;
          const x = RING_CENTER + ORBIT_RADIUS * Math.cos(angle);
          const y = RING_CENTER + ORBIT_RADIUS * Math.sin(angle);
          const paint = paintForNode(node);

          return (
            <G key={node.id}>
              {/* Gold halo behind the cycle's recipient */}
              {node.state === "recipient" ? (
                <Circle
                  cx={x}
                  cy={y}
                  r={NODE_RADIUS + 4}
                  fill={colors.goldSoft}
                  accessible={false}
                  accessibilityLabel={nodeAccessibilityLabel(node)}
                />
              ) : null}

              {/* Thin forest ring marking "your" node */}
              {node.isMe && node.state !== "recipient" ? (
                <Circle
                  cx={x}
                  cy={y}
                  r={NODE_RADIUS + 3.5}
                  fill="none"
                  stroke={colors.forestAction}
                  strokeWidth={2}
                />
              ) : null}

              <Circle
                cx={x}
                cy={y}
                r={NODE_RADIUS}
                fill={paint.fill}
                stroke={paint.stroke ?? "none"}
                strokeWidth={2}
                accessible={false}
                accessibilityLabel={nodeAccessibilityLabel(node)}
              />

              <SvgText
                x={x}
                y={y + Math.ceil(paint.fontSize * 0.4)}
                textAnchor="middle"
                fontSize={paint.fontSize}
                fontWeight={typography.weights.semibold}
                fill={paint.foreground}
              >
                {nodeGlyph(node)}
              </SvgText>
            </G>
          );
        })}
      </Svg>

      {center != null ? (
        <View style={styles.center} pointerEvents="none">
          {center}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ringContainer: {
    width: RING_BOX,
    height: RING_BOX,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  gridContainer: {
    alignItems: "center",
    marginBottom: spacing.md,
  },
  gridHeader: {
    alignItems: "center",
    marginBottom: spacing.md,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.sm,
  },
  chip: {
    width: 34,
    height: 34,
    borderRadius: radii.full,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  chipMine: {
    borderColor: colors.forestAction,
  },
  chipRecipient: {
    borderColor: colors.gold,
  },
  chipText: {
    fontWeight: typography.weights.semibold,
  },
});