//! Rarity-weighted vault fill (TEE-local entropy).
//!
//! Per-slot target mix (sum 100):
//!   Common 45 · Silver 30 · Shiny 21 · Gold 3 · Legendary 1
//! Gold+Legendary ≈ 4% of slots → ~once per ~10 locker packs (3 slots).
//! Odds are intentional; do not surface them in the product UI.

use crate::constants::MAX_ITEMS_POOL;

/// Weights out of 100 for rarity tiers 0..=4.
pub const RARITY_WEIGHTS: [u64; 5] = [45, 30, 21, 3, 1];

/// Pick `need` item indices without replacement, rarity-weighted.
/// `free` is a mutable list of available pool indices; returns selected indices
/// in draw order (also removes them from conceptual free set via swap-remove).
pub fn weighted_pick(
    free: &mut Vec<u16>,
    rarities: &[u8; MAX_ITEMS_POOL],
    need: usize,
    entropy: &[u8; 32],
) -> Option<Vec<u16>> {
    if free.len() < need {
        return None;
    }
    let mut out = Vec::with_capacity(need);
    for k in 0..need {
        let roll = u64::from_le_bytes(
            crate::util::hash::hashv(&[entropy, &[k as u8], b"rarity-tier"])[..8]
                .try_into()
                .ok()?,
        );
        let tier = choose_tier(free, rarities, roll % 100);
        let candidates: Vec<usize> = free
            .iter()
            .enumerate()
            .filter(|(_, &idx)| {
                let r = rarities[idx as usize] as usize;
                r == tier
            })
            .map(|(i, _)| i)
            .collect();
        if candidates.is_empty() {
            return None;
        }
        let pick_roll = u64::from_le_bytes(
            crate::util::hash::hashv(&[entropy, &[k as u8], b"item-pick"])[..8]
                .try_into()
                .ok()?,
        );
        let ci = candidates[(pick_roll as usize) % candidates.len()];
        let idx = free.swap_remove(ci);
        out.push(idx);
    }
    Some(out)
}

/// Choose a rarity tier that still has free items, preferring the weighted roll.
fn choose_tier(free: &[u16], rarities: &[u8; MAX_ITEMS_POOL], roll: u64) -> usize {
    let mut present = [false; 5];
    for &idx in free {
        let r = rarities[idx as usize] as usize;
        if r < 5 {
            present[r] = true;
        }
    }
    // Cumulative among present tiers only (renormalize so empty tiers don't eat probability).
    let mut weight_sum = 0u64;
    for t in 0..5 {
        if present[t] {
            weight_sum += RARITY_WEIGHTS[t];
        }
    }
    if weight_sum == 0 {
        return 0;
    }
    let mut cursor = roll % weight_sum;
    for t in 0..5 {
        if !present[t] {
            continue;
        }
        if cursor < RARITY_WEIGHTS[t] {
            return t;
        }
        cursor -= RARITY_WEIGHTS[t];
    }
    // Fallback: first present
    present.iter().position(|&p| p).unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hot_tiers_are_scarce_over_many_draws() {
        let mut rarities = [0u8; MAX_ITEMS_POOL];
        // 12/14/8/4/2 mirror warehouse
        let mut n = 0usize;
        for (tier, count) in [(0, 12), (1, 14), (2, 8), (3, 4), (4, 2)] {
            for _ in 0..count {
                rarities[n] = tier;
                n += 1;
            }
        }
        let mut hot = 0u32;
        let mut total_slots = 0u32;
        for seed_byte in 0u8..200 {
            let mut free: Vec<u16> = (0..40u16).collect();
            let mut entropy = [0u8; 32];
            entropy[0] = seed_byte;
            entropy[1] = seed_byte.wrapping_mul(3);
            let picked = weighted_pick(&mut free, &rarities, 3, &entropy).expect("pick");
            for idx in picked {
                total_slots += 1;
                if rarities[idx as usize] >= 3 {
                    hot += 1;
                }
            }
        }
        let pct = (hot as f64) * 100.0 / (total_slots as f64);
        // Target ~4%; allow noise band for 600 slots
        assert!(
            pct > 1.0 && pct < 10.0,
            "hot slot rate {pct}% out of band (want ~4%)"
        );
    }
}
