pub fn bit(map: &[u8; 8], index: u16) -> bool {
    let i = index as usize;
    let byte = i / 8;
    let bit = i % 8;
    if byte >= map.len() {
        return false;
    }
    (map[byte] & (1 << bit)) != 0
}

pub fn set_bit(map: &mut [u8; 8], index: u16) {
    let i = index as usize;
    let byte = i / 8;
    let bit = i % 8;
    if byte < map.len() {
        map[byte] |= 1 << bit;
    }
}

pub fn clear_bit(map: &mut [u8; 8], index: u16) {
    let i = index as usize;
    let byte = i / 8;
    let bit = i % 8;
    if byte < map.len() {
        map[byte] &= !(1 << bit);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip_bits() {
        let mut m = [0u8; 8];
        assert!(!bit(&m, 0));
        set_bit(&mut m, 0);
        set_bit(&mut m, 9);
        assert!(bit(&m, 0));
        assert!(bit(&m, 9));
        clear_bit(&mut m, 0);
        assert!(!bit(&m, 0));
        assert!(bit(&m, 9));
    }
}
