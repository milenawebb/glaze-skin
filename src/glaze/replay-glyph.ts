// Geometry for the replay bubble's icon: one circular arrow that curves clockwise.
// The arc begins at the top of the ring and sweeps clockwise (large arc flag and sweep
// flag both set, so the 270 degree way round) through the right side and the bottom, and
// ends at the left side. The filled head sits on that end with its base centred on the
// arc's end point and its tip pointing up, which is the clockwise tangent there, so the
// arrow reads as turning clockwise. Both open ends of the stroke are round.
export const REPLAY_ARC = "M12.9 5A7 7 0 1 1 5.9 12";
export const REPLAY_HEAD = "M5.9 9 4 12 7.8 12Z";
