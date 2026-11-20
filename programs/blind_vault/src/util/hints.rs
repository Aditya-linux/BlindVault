use anchor_lang::prelude::*;
use crate::error::ErrorCode;
use crate::state::{Hint, PoolLedger, VaultContents, VaultHints};

/// Compute and release hint `i` from private contents (spec §7.6).
pub fn release_hint(
    h: &mut VaultHints,
    i: usize,
    c: &VaultContents,
    p: &PoolLedger,
    now: i64,
) -> Result<()> {
    require!(i < 4, ErrorCode::InvalidHint);
    require!(!h.hints[i].released, ErrorCode::HintAlreadyReleased);
    require!(c.len > 0, ErrorCode::NotEnoughItems);

    let items = &c.items[..c.len as usize];
    let (a, b) = match h.hints[i].kind {
        0 => {
            // DominantCategory
            let mut cnt = [0u8; 5];
            for &x in items {
                let cat = p.categories[x as usize] as usize;
                if cat < 5 {
                    cnt[cat] = cnt[cat].saturating_add(1);
                }
            }
            let best = (0..5)
                .max_by_key(|&k| (cnt[k], 5u8.saturating_sub(k as u8)))
                .unwrap_or(0);
            (best as u32, cnt[best] as u32)
        }
        1 => {
            // RarityFloor
            let min = items
                .iter()
                .map(|&x| p.rarities[x as usize])
                .min()
                .unwrap_or(0);
            (min as u32, 0)
        }
        2 => {
            // ValueBand
            let w: u32 = if c.len <= 3 { 50 } else { 100 };
            let lo = (c.total_value / w) * w;
            (lo, lo.saturating_add(w))
        }
        3 => {
            // TopTier: Epic or better?
            let max = items
                .iter()
                .map(|&x| p.rarities[x as usize])
                .max()
                .unwrap_or(0);
            ((max >= 3) as u32, 0)
        }
        _ => return err!(ErrorCode::InvalidHint),
    };

    h.hints[i] = Hint {
        kind: h.hints[i].kind,
        released: true,
        a,
        b,
        released_ts: now,
    };
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::constants::MAX_ITEMS_POOL;

    fn ledger() -> PoolLedger {
        let mut p = PoolLedger {
            house: Pubkey::default(),
            reserved: [0; 8],
            sold: [0; 8],
            item_count: 3,
            values: [0; MAX_ITEMS_POOL],
            rarities: [0; MAX_ITEMS_POOL],
            categories: [0; MAX_ITEMS_POOL],
            bump: 0,
        };
        p.values[0] = 2;
        p.values[1] = 90;
        p.values[2] = 8;
        p.rarities[0] = 0;
        p.rarities[1] = 3;
        p.rarities[2] = 1;
        p.categories[0] = 0;
        p.categories[1] = 0;
        p.categories[2] = 1;
        p
    }

    #[test]
    fn dominant_category_and_top_tier() {
        let p = ledger();
        let c = VaultContents {
            vault: Pubkey::default(),
            items: [0, 1, 2, 0, 0, 0, 0, 0],
            len: 3,
            total_value: 100,
            seed: [0; 32],
            filled: true,
            revealed: false,
            bump: 0,
        };
        let mut h = VaultHints {
            vault: Pubkey::default(),
            hints: [
                Hint {
                    kind: 0,
                    ..Default::default()
                },
                Hint {
                    kind: 1,
                    ..Default::default()
                },
                Hint {
                    kind: 2,
                    ..Default::default()
                },
                Hint {
                    kind: 3,
                    ..Default::default()
                },
            ],
            bump: 0,
        };
        release_hint(&mut h, 0, &c, &p, 1).unwrap();
        assert!(h.hints[0].released);
        assert_eq!(h.hints[0].a, 0); // Toys dominant
        release_hint(&mut h, 1, &c, &p, 2).unwrap();
        assert_eq!(h.hints[1].a, 0); // floor junk
        release_hint(&mut h, 3, &c, &p, 3).unwrap();
        assert_eq!(h.hints[3].a, 1); // epic present
    }
}
