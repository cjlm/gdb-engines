/**
 * How a month-on-month rank change is shown, shared by every template that shows one.
 *
 * `rankDelta1m` comes from gdb-engines-rankings (src/score.ts): the change in position, so
 * NEGATIVE means the engine rose (#7 → #5 is -2) and positive means it fell. Each template
 * used to format this itself and the comparison pages read the sign backwards.
 */
export type RankDelta = number | 'new' | null | undefined;

export interface RankMovement {
  text: string;
  cls: '' | 'delta-new' | 'delta-flat' | 'delta-up' | 'delta-down';
}

export function rankMovement(delta: RankDelta): RankMovement {
  if (delta === 'new') return { text: 'new', cls: 'delta-new' };
  if (delta === null || delta === undefined) return { text: '', cls: '' };
  if (delta === 0) return { text: '=', cls: 'delta-flat' };
  return delta < 0
    ? { text: `▲${Math.abs(delta)}`, cls: 'delta-up' }
    : { text: `▼${delta}`, cls: 'delta-down' };
}
